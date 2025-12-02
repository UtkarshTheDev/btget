import * as fs from "fs/promises";
import { DistributedHashTable } from "../dht/DistributedHashTable";
import { PeerManager } from "../peers/PeerManager";
import Pieces from "../pieces/Pieces";
import { infoHash, size } from "../protocol/parser";
import Queue from "../queue/Queue";
import { getPeers } from "../tracker/tracker";
import type { Peer, Torrent } from "../types/index";
import { MessageHandler } from "./handlers/MessageHandler";
import { EndgameManager } from "./modules/EndgameManager";
import { FileWriter } from "./modules/FileWriter";
import { ProgressTracker } from "./modules/ProgressTracker";
import { TimeoutManager } from "./modules/TimeoutManager";
import { UploadManager } from "./modules/UploadManager";

/**
 * Download a torrent file
 */
export interface ProgressData {
	downloaded: number;
	uploaded: number;
	downloadSpeed: number;
	uploadSpeed: number;
	peers: number;
	seeds: number;
	leechers: number;
}

/**
 * Download a torrent file
 */
export async function downloadTorrent(
	torrent: Torrent,
	outputDirPath: string,
	options: {
		dhtOnly?: boolean;
		onProgress?: (data: ProgressData) => void;
	} = {},
): Promise<void> {
	const torrentName = torrent.info.name.toString("utf8");
	const totalSize = size(torrent);
	const totalPieces = torrent.info.pieces.length / 20;
	const PROGRESS_INTERVAL_MS = 1000;
	const PERCENTAGE_MULTIPLIER = 100;

	const BYTES_PER_MB = 1024 * 1024;
	const MS_PER_MINUTE = 60 * 1000;
	const STALL_TIME_MS = 5 * 60 * 1000; // 5 minutes
	const MIN_SPEED_BYTES_PER_SEC = 1024; // 1 KB/s
	const MIN_SPEED_DURATION_MS = 600000; // 10 minutes
	const MAX_TOTAL_TIME_MS = 86400000; // 24 hours

	if (!options.onProgress) {
		console.log(`🚀 Starting reliable download: ${torrentName}`);
		console.log(`📦 Size: ${(Number(totalSize) / BYTES_PER_MB).toFixed(2)} MB`);
		console.log(`🧩 Initialized ${totalPieces} pieces`);
	}

	// Create output directory
	await fs.mkdir(outputDirPath, { recursive: true });

	// Initialize modules
	const fileWriter = new FileWriter(torrent);
	const uploadManager = new UploadManager(fileWriter);
	const endgameManager = new EndgameManager();
	const messageHandler = new MessageHandler(
		torrent,
		fileWriter,
		endgameManager,
		uploadManager,
	);
	const progressTracker = new ProgressTracker();
	const timeoutManager = new TimeoutManager();
	const dht = new DistributedHashTable();

	// Initialize files
	await fileWriter.initialize(outputDirPath, torrentName);

	return new Promise((resolve, reject) => {
		let downloadComplete = false;

		// FIX #1: Initialize seed/leech tracking variables at function start
		let currentSeeds = 0;
		let currentLeechers = 0;

		// FIX #5: Initialize PeerManager FIRST (before Pieces callback)
		// This prevents race condition where callback fires before peerManager exists
		const queue = new Queue(torrent);

		// Initialize queue with all pieces
		for (let i = 0; i < totalPieces; i++) {
			queue.queue(i);
		}

		// Create temporary variable to hold peerManager reference
		let peerManager: PeerManager;

		// Setup pieces with callback (now safe - peerManager will be initialized below)
		// 🔒 SECURITY FIX: Pass callback to broadcast HAVE only AFTER SHA1 verification
		// This prevents "swarm poisoning" by ensuring we never advertise corrupt data
		const pieces = new Pieces(torrent, (pieceIndex: number) => {
			// Broadcast HAVE to all connected peers after successful verification
			// FIX #5: peerManager is guaranteed to exist when this callback fires
			messageHandler.broadcastHave(pieceIndex, peerManager.getActiveSockets());
		});

		// Initialize peer manager (now pieces exists, so circular dependency is resolved)
		peerManager = new PeerManager(
			torrent,
			pieces,
			queue,
			messageHandler,
			endgameManager,
			uploadManager,
		);

		// Start timeout management
		timeoutManager.startBlockTimeoutCheck(
			() => peerManager.getActiveSockets(),
			pieces,
			queue,
			(socket) => peerManager.requestPieces(socket),
		);

		// Configure progress-based timeout (replaces fixed 15-minute timeout)
		const fileSizeMB = Number(totalSize) / BYTES_PER_MB;
		const timeoutConfig = {
			stallTimeMs: STALL_TIME_MS, // 5 minutes with no progress = stall
			minSpeedBytesPerSec: MIN_SPEED_BYTES_PER_SEC, // 1 KB/s minimum speed
			minSpeedDurationMs: MIN_SPEED_DURATION_MS, // 10 minutes below minimum speed
			maxTotalTimeMs: Math.max(
				MAX_TOTAL_TIME_MS, // 24 hours absolute maximum
				fileSizeMB * MS_PER_MINUTE, // Or 1 minute per MB, whichever is larger
			),
		};

		timeoutManager.startProgressBasedTimeout(
			() => ({
				downloaded: messageHandler.getTotalDownloaded(),
				speed: peerManager.getDownloadSpeed(),
			}),
			() => {
				if (!downloadComplete) {
					downloadComplete = true;
					progressTracker.stop();
					const progress =
						(messageHandler.getTotalDownloaded() / Number(totalSize)) *
						PERCENTAGE_MULTIPLIER;
					if (!options.onProgress)
						console.log(`\n❌ Download stalled at ${progress.toFixed(1)}%`);
					fileWriter
						.cleanup()
						.then(() =>
							reject(new Error(`Download stalled at ${progress.toFixed(1)}%`)),
						);
				}
			},
			timeoutConfig,
		);

		// Progress monitoring
		const progressInterval = setInterval(() => {
			// FIX #12: Early return if download already complete
			if (downloadComplete) {
				clearInterval(progressInterval);
				return;
			}

			const downloaded = messageHandler.getTotalDownloaded();
			const connectedPeers = peerManager.getConnectedPeers();

			// Use verified pieces for accurate progress (prevents exceeding 100%)
			const verifiedPieces = pieces.getVerifiedCount();
			// FIX #12: Cap progress at 100% to prevent display issues
			const progress = Math.min(
				100,
				(verifiedPieces / totalPieces) * PERCENTAGE_MULTIPLIER,
			);

			// Update progress
			progressTracker.update(downloaded, connectedPeers, {
				seeds: currentSeeds,
				leechers: currentLeechers,
			});

			// Call user progress callback with upload stats
			if (options.onProgress) {
				options.onProgress({
					downloaded,
					uploaded: uploadManager.getTotalUploaded(),
					downloadSpeed: peerManager.getDownloadSpeed(),
					uploadSpeed: uploadManager.getUploadSpeed(),
					peers: connectedPeers,
					seeds: currentSeeds,
					leechers: currentLeechers,
				});
			}

			// Check for endgame mode
			if (endgameManager.shouldEnterEndgame(progress, queue.length())) {
				endgameManager.enterEndgame(peerManager.getActiveSockets());
			}

			// Check for completion
			if (pieces.isDone() && !downloadComplete) {
				downloadComplete = true;
				clearInterval(progressInterval);
				timeoutManager.clearAll();
				progressTracker.stop();
				peerManager.stop();
				uploadManager.stop();
				dht.stop();

				if (!options.onProgress)
					console.log("\n✅ Download completed successfully!");
				fileWriter.cleanup().then(() => {
					if (!options.onProgress)
						console.log(
							`✅ Download completed successfully for '${torrentName}'!`,
						);
					resolve();
				});
			}
		}, PROGRESS_INTERVAL_MS);

		// Start peer discovery
		const discoverySource = options.dhtOnly ? "DHT Only" : "Trackers and DHT";
		if (!options.onProgress)
			console.log(`🔍 Searching for peers via ${discoverySource}...`);

		// Start DHT lookup
		dht.on("peers", (peers: Array<{ ip: string; port: number }>) => {
			peerManager.addPeers(peers);
		});
		dht.lookup(infoHash(torrent));

		// Initialize progress tracker immediately to ensure UI starts if callback provided
		progressTracker.initialize(torrentName, totalSize, options.onProgress);

		// FIX #1: Update tracker stats when received
		if (!options.dhtOnly) {
			getPeers(
				torrent,
				(peers: Peer[], stats?: { seeds: number; leechers: number }) => {
					if (stats) {
						currentSeeds = Math.max(currentSeeds, stats.seeds);
						currentLeechers = Math.max(currentLeechers, stats.leechers);
					}

					if (downloadComplete) return;

					if (peers.length === 0) {
						if (!options.onProgress)
							console.log("⚠️ No peers found from trackers, relying on DHT...");
					} else {
						// Add peers to manager
						peerManager.addPeers(peers);
					}
				},
			);
		}
	});
}
