import * as fs from "fs/promises";
import type { Peer, Torrent } from "../types/index";
import { getPeers } from "../tracker/tracker";
import type { PieceBlock } from "../queue/Queue";
import Queue from "../queue/Queue";
import Pieces from "../pieces/Pieces";
import { size } from "../protocol/parser";
import { FileWriter } from "./FileWriter";
import { EndgameManager } from "./EndgameManager";
import { MessageHandler } from "./MessageHandler";
import { ProgressTracker } from "./ProgressTracker";
import { TimeoutManager } from "./TimeoutManager";
import { PeerConnection } from "./PeerConnection";

/**
 * Download a torrent file
 */
export async function downloadTorrent(
	torrent: Torrent,
	outputDirPath: string,
): Promise<void> {
	const torrentName = torrent.info.name.toString("utf8");
	const totalSize = size(torrent);
	const totalPieces = torrent.info.pieces.length / 20;

	console.log(`🚀 Starting reliable download: ${torrentName}`);
	console.log(`📦 Size: ${(Number(totalSize) / (1024 * 1024)).toFixed(2)} MB`);
	console.log(`🧩 Initialized ${totalPieces} pieces`);

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

		// Initialize peer connection manager
		const peerConnection = new PeerConnection(
			torrent,
			pieces,
			queue,
			messageHandler,
			endgameManager,
		);

		// Start timeout management
		timeoutManager.startBlockTimeoutCheck(
			() => peerConnection.getActiveSockets(),
			pieces,
			queue,
			(socket) => peerConnection.requestPieces(socket),
		);

		timeoutManager.startDownloadTimeout(15 * 60 * 1000, () => {
			if (!downloadComplete) {
				downloadComplete = true;
				progressTracker.stop();
				const progress =
					(messageHandler.getTotalDownloaded() / Number(totalSize)) * 100;
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
			const connectedPeers = peerConnection.getConnectedPeers();
			const progress = (downloaded / Number(totalSize)) * 100;

			// Update progress
			progressTracker.update(downloaded, totalSize, connectedPeers);

			// Check for endgame mode
			if (endgameManager.shouldEnterEndgame(progress, queue.length())) {
				endgameManager.enterEndgame(peerConnection.getActiveSockets());
			}

			// Check for completion
			if (pieces.isDone() && !downloadComplete) {
				downloadComplete = true;
				clearInterval(progressInterval);
				timeoutManager.clearAll();
				progressTracker.stop();

				console.log("\n✅ Download completed successfully!");
				fileWriter.cleanup().then(() => {
					console.log(
						`✅ Download completed successfully for '${torrentName}'!`,
					);
					resolve();
				});
			}
		}, 1000);

		// Start peer discovery
		getPeers(torrent, (peers: Peer[]) => {
			if (downloadComplete) return;

			if (peers.length === 0) {
				console.log("❌ No peers found");
				reject(new Error("No peers found"));
				return;
			}

			// Initialize progress bar
			progressTracker.initialize(torrentName, totalSize);

			// Connect to peers
			const maxPeers = Math.min(20, peers.length);
			peers.slice(0, maxPeers).forEach((peer, index) => {
				setTimeout(() => {
					if (!downloadComplete && peerConnection.getConnectedPeers() < 15) {
						peerConnection.connectToPeer(peer);
					}
				}, index * 50);
			});
		});
	});
}
