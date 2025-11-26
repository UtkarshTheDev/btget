import * as fs from "fs/promises";
import type { Peer, Torrent } from "../types/index";
import { getPeers } from "../tracker/tracker";
import Queue from "../queue/Queue";
import Pieces from "../pieces/Pieces";
import { size } from "../protocol/parser";
import { FileWriter } from "./modules/FileWriter";
import { EndgameManager } from "./modules/EndgameManager";
import { MessageHandler } from "./handlers/MessageHandler";
import { ProgressTracker } from "./modules/ProgressTracker";
import { TimeoutManager } from "./modules/TimeoutManager";
import { PeerManager } from "../peers/PeerManager";
import { DistributedHashTable } from "../dht/DistributedHashTable";
import { infoHash } from "../protocol/parser";

/**
 * Download a torrent file
 */
export async function downloadTorrent(
	torrent: Torrent,
	outputDirPath: string,
	options: { dhtOnly?: boolean; onProgress?: (data: any) => void } = {},
): Promise<void> {
	const torrentName = torrent.info.name.toString("utf8");
	const totalSize = size(torrent);
	const totalPieces = torrent.info.pieces.length / 20;

	if (!options.onProgress) {
		console.log(`🚀 Starting reliable download: ${torrentName}`);
		console.log(
			`📦 Size: ${(Number(totalSize) / (1024 * 1024)).toFixed(2)} MB`,
		);
		console.log(`🧩 Initialized ${totalPieces} pieces`);
	}

	// Create output directory
	await fs.mkdir(outputDirPath, { recursive: true });

	// Initialize modules
	const fileWriter = new FileWriter(torrent);
	const endgameManager = new EndgameManager();
	const messageHandler = new MessageHandler(
		torrent,
		fileWriter,
		endgameManager,
	);
	const progressTracker = new ProgressTracker();
	const timeoutManager = new TimeoutManager();
	const dht = new DistributedHashTable();

	// Initialize files
	await fileWriter.initialize(outputDirPath, torrentName);

	return new Promise((resolve, reject) => {
		let downloadComplete = false;

		// Setup pieces and queue
		const pieces = new Pieces(torrent);
		const queue = new Queue(torrent);

		// Initialize queue with all pieces
		for (let i = 0; i < totalPieces; i++) {
			queue.queue(i);
		}

		// Initialize peer manager
		const peerManager = new PeerManager(
			torrent,
			pieces,
			queue,
			messageHandler,
			endgameManager,
		);

		// Start timeout management
		timeoutManager.startBlockTimeoutCheck(
			() => peerManager.getActiveSockets(),
			pieces,
			queue,
			(socket) => peerManager.requestPieces(socket),
		);

		timeoutManager.startDownloadTimeout(15 * 60 * 1000, () => {
			if (!downloadComplete) {
				downloadComplete = true;
				progressTracker.stop();
				const progress =
					(messageHandler.getTotalDownloaded() / Number(totalSize)) * 100;
				if (!options.onProgress)
					console.log(`\n❌ Download timeout at ${progress.toFixed(1)}%`);
				fileWriter
					.cleanup()
					.then(() =>
						reject(new Error(`Download timeout at ${progress.toFixed(1)}%`)),
					);
			}
		});

		// Progress monitoring
		const progressInterval = setInterval(() => {
			if (downloadComplete) {
				clearInterval(progressInterval);
				return;
			}

			const downloaded = messageHandler.getTotalDownloaded();
			const connectedPeers = peerManager.getConnectedPeers();
			const progress = (downloaded / Number(totalSize)) * 100;

			// Update progress
			progressTracker.update(downloaded, connectedPeers, {
				seeds: currentSeeds,
				leechers: currentLeechers,
			});

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
		}, 1000);

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

		let currentSeeds = 0;
		let currentLeechers = 0;

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
