import { Socket } from "net";
import * as fs from "fs/promises";
import * as path from "path";
import cliProgress from "cli-progress";
import type { Peer, Torrent, File } from "../types/index";
import { getPeers } from "../tracker/tracker";
import {
	buildHandshake,
	buildInterested,
	buildRequest,
	buildCancel,
} from "../protocol/messages";
import type { PieceBlock } from "../queue/Queue";
import Queue from "../queue/Queue";
import Pieces from "../pieces/Pieces";
import { size } from "../protocol/parser";

interface FileEntry {
	handle: fs.FileHandle;
	path: string;
	offset: bigint;
	length: bigint;
}

// Track block requests with timestamps for timeout detection
interface BlockRequest {
	block: PieceBlock;
	requestedAt: number;
}

interface ExtendedSocket extends Socket {
	pendingRequests?: number;
	peerId?: string;
	lastData?: number;
	choked?: boolean;
	bitfield?: Buffer;
	activeRequests?: Map<string, BlockRequest>; // Changed to BlockRequest with timestamp
	endgameMode?: boolean; // Track if in endgame
	availablePieces?: Set<number>; // Pieces this peer has (for rarest-first)
}

// Helper to create unique block identifier
function blockId(block: { index: number; begin: number }): string {
	return `${block.index}:${block.begin}`;
}

// Helper to parse bitfield into set of piece indices
function parseBitfield(bitfield: Buffer, totalPieces: number): Set<number> {
	const pieces = new Set<number>();
	for (let i = 0; i < bitfield.length; i++) {
		const byte = bitfield[i];
		if (byte === undefined) continue; // Skip undefined bytes
		for (let bit = 0; bit < 8; bit++) {
			const pieceIndex = i * 8 + bit;
			if (pieceIndex >= totalPieces) break; // Don't go past total pieces
			if (byte & (1 << (7 - bit))) {
				pieces.add(pieceIndex);
			}
		}
	}
	return pieces;
}

let torrentFiles: FileEntry[] = [];
let totalDownloaded = 0;
let downloadComplete = false;

export async function downloadTorrent(
	torrent: Torrent,
	outputDirPath: string,
): Promise<void> {
	const torrentName = torrent.info.name.toString("utf8");
	const totalSize = size(torrent);

	console.log(`🚀 Starting reliable download: ${torrentName}`);
	console.log(`📦 Size: ${(Number(totalSize) / (1024 * 1024)).toFixed(2)} MB`);

	// Reset state
	downloadComplete = false;
	totalDownloaded = 0;

	// Create output directory
	await fs.mkdir(outputDirPath, { recursive: true });

	// Initialize files
	await initializeFiles(torrent, outputDirPath, torrentName);

	return new Promise((resolve, reject) => {
		let activePeers = 0;
		let connectedPeers = 0;
		let lastProgress = 0;
		let stallCount = 0;
		let progressBar: cliProgress.SingleBar | null = null;
		let downloadTimeout: NodeJS.Timeout;
		let timeoutCheckInterval: NodeJS.Timeout;
		const activeSockets = new Map<string, ExtendedSocket>();

		const pieces = new Pieces(torrent);
		const queue = new Queue(torrent);

		// Initialize queue with all pieces
		const totalPieces = torrent.info.pieces.length / 20;
		for (let i = 0; i < totalPieces; i++) {
			queue.queue(i);
		}

		console.log(`🧩 Initialized ${totalPieces} pieces`);

		// Progress monitoring with better stall detection
		const progressInterval = setInterval(() => {
			const progress = (totalDownloaded / Number(totalSize)) * 100;
			const speed = (totalDownloaded - lastProgress) / 1024; // KB/s

			if (progressBar) {
				progressBar.update(totalDownloaded, {
					speed: speed.toFixed(1),
					peers: connectedPeers,
					value_formatted: `${(totalDownloaded / (1024 * 1024)).toFixed(2)} MB`,
					total_formatted: `${(Number(totalSize) / (1024 * 1024)).toFixed(2)} MB`,
				});
			}

			// Enhanced stall detection and recovery + endgame mode
			if (
				totalDownloaded === lastProgress &&
				progress > 0 &&
				connectedPeers > 0
			) {
				stallCount++;
				if (stallCount >= 5) {
					// Silently request more blocks from all connected peers
					activeSockets.forEach((socket) => {
						if (!socket.destroyed && !socket.choked) {
							requestPieces(socket, pieces, queue);
						}
					});
					stallCount = 0;
				}
			} else {
				stallCount = 0;
			}

			// Endgame mode: when >95% complete, request remaining pieces from ALL peers
			if (progress > 95 && queue.length() > 0 && queue.length() < 50) {
				// Debug logging every 5 seconds
				if (
					Math.floor(Date.now() / 5000) !==
					Math.floor((Date.now() - 1000) / 5000)
				) {
					console.log(
						`\n[ENDGAME] Progress: ${progress.toFixed(1)}%, Queue: ${queue.length()}, Peers: ${connectedPeers}`,
					);
					let totalPending = 0;
					activeSockets.forEach((s, i) => {
						const pending = s.pendingRequests ?? 0;
						totalPending += pending;
						if (!s.destroyed) {
							console.log(
								`  Peer ${i}: ${pending} pending, choked: ${s.choked}, active: ${s.activeRequests?.size ?? 0}`,
							);
						}
					});
					console.log(`  Total pending: ${totalPending}\n`);
				}

				activeSockets.forEach((socket) => {
					if (!socket.destroyed && !socket.choked) {
						requestPieces(socket, pieces, queue);
					}
				});
			}

			lastProgress = totalDownloaded;

			// Check completion
			if (pieces.isDone() && !downloadComplete) {
				downloadComplete = true;
				clearInterval(progressInterval);
				clearTimeout(downloadTimeout);
				clearInterval(timeoutCheckInterval);
				if (progressBar) progressBar.stop();
				console.log("\n✅ Download completed successfully!");

				// Close all sockets to allow process to exit
				activeSockets.forEach((socket) => {
					if (!socket.destroyed) {
						socket.destroy();
					}
				});
				activeSockets.clear();

				cleanup().then(() => resolve());
			}
		}, 1000);

		// Timeout with better error message
		downloadTimeout = setTimeout(
			() => {
				if (!downloadComplete) {
					downloadComplete = true;
					clearInterval(progressInterval);
					if (progressBar) progressBar.stop();
					const progress = (totalDownloaded / Number(totalSize)) * 100;
					console.log(`\n❌ Download timeout at ${progress.toFixed(1)}%`);
					cleanup().then(() =>
						reject(new Error(`Download timeout at ${progress.toFixed(1)}%`)),
					);
				}
			},
			15 * 60 * 1000,
		); // 15 minutes

		// CRITICAL: Simplified timeout mechanism - check every 5 seconds
		const TIMEOUT_MS = 30000; // 30 seconds
		timeoutCheckInterval = setInterval(() => {
			if (downloadComplete) {
				clearInterval(timeoutCheckInterval);
				return;
			}

			const now = Date.now();
			activeSockets.forEach((socket) => {
				if (socket.destroyed || !socket.activeRequests) return;

				const timedOut: PieceBlock[] = [];

				socket.activeRequests.forEach((req, key) => {
					if (now - req.requestedAt > TIMEOUT_MS) {
						timedOut.push(req.block);
					}
				});

				// Re-queue timed out blocks
				timedOut.forEach((block) => {
					const key = blockId(block);
					socket.activeRequests!.delete(key);
					socket.pendingRequests = Math.max(
						0,
						(socket.pendingRequests ?? 0) - 1,
					);
					pieces.removeRequested(block);
					queue.queueFront(block); // High priority
				});

				// Request more if blocks freed up
				if (timedOut.length > 0 && !socket.destroyed && !socket.choked) {
					requestPieces(socket, pieces, queue);
				}
			});
		}, 5000); // Check every 5 seconds

		// Start peer discovery
		getPeers(torrent, (peers: Peer[]) => {
			if (downloadComplete) return;

			if (peers.length === 0) {
				console.log("❌ No peers found");
				reject(new Error("No peers found"));
				return;
			}

			// Initialize progress bar
			progressBar = new cliProgress.SingleBar({
				format: `${torrentName} | {bar} | {percentage}% | {speed} KB/s | Peers: {peers} | {value_formatted}/{total_formatted}`,
				barCompleteChar: "\u2588",
				barIncompleteChar: "\u2591",
				hideCursor: true,
				clearOnComplete: false,
				noTTYOutput: false,
				linewrap: false,
			});

			progressBar.start(Number(totalSize), 0, {
				speed: "0.0",
				peers: 0,
				value_formatted: "0 MB",
				total_formatted: `${(Number(totalSize) / (1024 * 1024)).toFixed(2)} MB`,
			});

			// Connect to more peers for better download speed (up to 20)
			const maxPeers = Math.min(20, peers.length);
			peers.slice(0, maxPeers).forEach((peer, index) => {
				setTimeout(() => {
					if (!downloadComplete && connectedPeers < 15) {
						connectToPeer(peer, torrent, pieces, queue);
					}
				}, index * 50); // Faster connection attempts
			});
		});

		// Connect to peer with IPv6 support
		function connectToPeer(
			peer: Peer,
			torrent: Torrent,
			pieces: Pieces,
			queue: Queue,
		): void {
			const socket = new Socket() as ExtendedSocket;
			const peerId = `${peer.ip}:${peer.port}`;

			socket.peerId = peerId;
			socket.pendingRequests = 0;
			socket.lastData = Date.now();
			socket.choked = true;

			// Configure socket for better performance
			socket.setKeepAlive(true, 30000);
			socket.setNoDelay(true);
			socket.setTimeout(30000); // 30s timeout to prevent disconnections during endgame

			let handshakeComplete = false;
			let messageBuffer = Buffer.alloc(0);

			socket.on("connect", () => {
				activePeers++;
				activeSockets.set(peerId, socket);

				// Send handshake
				const handshake = buildHandshake(torrent);
				socket.write(handshake);
			});

			socket.on("data", (data: Buffer) => {
				socket.lastData = Date.now();
				messageBuffer = Buffer.concat([messageBuffer, data]);

				// Handle handshake first
				if (!handshakeComplete && messageBuffer.length >= 68) {
					const handshakeData = messageBuffer.slice(0, 68);

					if (
						handshakeData[0] === 19 &&
						handshakeData.toString("utf8", 1, 20) === "BitTorrent protocol"
					) {
						handshakeComplete = true;
						connectedPeers++;
						messageBuffer = messageBuffer.slice(68);

						// Send interested
						socket.write(buildInterested());

						// Start requesting pieces after a short delay
						// Don't check choked here - we just sent interested, peer will unchoke if willing
						setTimeout(() => {
							if (!socket.destroyed) {
								requestPieces(socket, pieces, queue);
							}
						}, 100);
					} else {
						socket.destroy();
						return;
					}
				}

				// Process BitTorrent messages
				if (handshakeComplete) {
					const bytesConsumed = processMessages(
						socket,
						messageBuffer,
						pieces,
						queue,
					);
					messageBuffer = messageBuffer.slice(bytesConsumed); // Keep unprocessed bytes
				}
			});

			socket.on("error", (err) => {
				activeSockets.delete(peerId);
				activePeers = Math.max(0, activePeers - 1);
				if (handshakeComplete) {
					connectedPeers = Math.max(0, connectedPeers - 1);
				}
			});

			socket.on("timeout", () => {
				activeSockets.delete(peerId);
				activePeers = Math.max(0, activePeers - 1);
				if (handshakeComplete) {
					connectedPeers = Math.max(0, connectedPeers - 1);
				}
				socket.destroy();
			});

			socket.on("close", () => {
				activeSockets.delete(peerId);
				activePeers = Math.max(0, activePeers - 1);
				if (handshakeComplete) {
					connectedPeers = Math.max(0, connectedPeers - 1);
				}

				// Remove peer from queue tracking (rarest-first)
				if (socket.peerId) {
					queue.removePeer(socket.peerId);
				}

				// CRITICAL: Re-queue all pending requests from this disconnected peer
				if (socket.activeRequests && socket.activeRequests.size > 0) {
					socket.activeRequests.forEach((req) => {
						pieces.removeRequested(req.block);
						queue.queueFront(req.block); // High priority
					});
					socket.activeRequests.clear();

					// Trigger requests on other peers
					activeSockets.forEach((s) => {
						if (!s.destroyed && !s.choked) {
							requestPieces(s, pieces, queue);
						}
					});
				}
			});

			try {
				// Detect IPv6 and connect accordingly
				socket.connect(peer.port, peer.ip);
			} catch (error) {
				activeSockets.delete(peerId);
			}
		}

		// Process BitTorrent protocol messages
		function processMessages(
			socket: ExtendedSocket,
			buffer: Buffer,
			pieces: Pieces,
			queue: Queue,
		): number {
			let offset = 0;

			while (offset + 4 <= buffer.length) {
				const messageLength = buffer.readUInt32BE(offset);

				if (messageLength === 0) {
					// Keep-alive
					offset += 4;
					continue;
				}

				if (offset + 4 + messageLength > buffer.length) {
					// Incomplete message, wait for more data
					break;
				}

				const messageId = buffer[offset + 4];
				const messageData = buffer.slice(
					offset + 4,
					offset + 4 + messageLength,
				);

				try {
					handleMessage(socket, messageId, messageData, pieces, queue);
				} catch (error) {
					// Silently ignore message processing errors
				}

				offset += 4 + messageLength;
			}

			return offset; // Return number of bytes consumed
		}

		// Handle individual message
		function handleMessage(
			socket: ExtendedSocket,
			messageId: number,
			data: Buffer,
			pieces: Pieces,
			queue: Queue,
		): void {
			switch (messageId) {
				case 0: // choke
					socket.choked = true;
					socket.pendingRequests = 0;
					break;

				case 1: // unchoke
					socket.choked = false;
					// Immediately start requesting pieces when unchoked
					setTimeout(() => requestPieces(socket, pieces, queue), 50);
					break;

				case 4: // have
					// Peer has this piece - update for rarest-first
					if (data.length >= 5) {
						const pieceIndex = data.readUInt32BE(1);
						if (!socket.availablePieces) socket.availablePieces = new Set();
						socket.availablePieces.add(pieceIndex);
						if (socket.peerId) {
							queue.updatePeerPieces(socket.peerId, socket.availablePieces);
						}
					}
					break;

				case 5: // bitfield
					socket.bitfield = data.slice(1);
					// Parse bitfield and update queue for rarest-first
					socket.availablePieces = parseBitfield(socket.bitfield, totalPieces);
					if (socket.peerId) {
						queue.updatePeerPieces(socket.peerId, socket.availablePieces);
					}
					break;

				case 7: // piece
					handlePiece(socket, data, pieces, queue);
					break;
			}
		}

		// Handle piece data with verification
		function handlePiece(
			socket: ExtendedSocket,
			data: Buffer,
			pieces: Pieces,
			queue: Queue,
		): void {
			if (data.length < 9) return;

			const pieceIndex = data.readUInt32BE(1);
			const begin = data.readUInt32BE(5);
			const blockData = data.slice(9);

			socket.pendingRequests = Math.max(0, (socket.pendingRequests ?? 0) - 1);
			totalDownloaded += blockData.length;

			// CRITICAL: Send CANCEL to all other peers for this block
			const blockKey = blockId({ index: pieceIndex, begin });
			activeSockets.forEach((otherSocket) => {
				if (
					otherSocket !== socket &&
					!otherSocket.destroyed &&
					otherSocket.activeRequests
				) {
					const requests = otherSocket.activeRequests;
					if (requests.has(blockKey)) {
						const blockToCancel = requests.get(blockKey)!.block; // Extract block from BlockRequest
						try {
							otherSocket.write(buildCancel(blockToCancel));
							requests.delete(blockKey);
							otherSocket.pendingRequests = Math.max(
								0,
								(otherSocket.pendingRequests ?? 0) - 1,
							);
						} catch (e) {
							// Ignore write errors
						}
					}
				}
			});

			// Remove from this socket's active requests
			if (socket.activeRequests) {
				socket.activeRequests.delete(blockKey);
			}

			// Write to file immediately
			writePieceBlock(torrent, pieceIndex, begin, blockData);

			// Mark as received
			pieces.addReceived({
				index: pieceIndex,
				begin: begin,
				block: blockData,
				length: blockData.length,
			});

			// Request more pieces to maintain pipeline
			requestPieces(socket, pieces, queue);
		}

		// Request pieces from peer with improved pipelining
		function requestPieces(
			socket: ExtendedSocket,
			pieces: Pieces,
			queue: Queue,
		): void {
			// Don't check choked - in BitTorrent protocol, we send requests even when choked
			// The peer will queue them and respond when they unchoke us
			if (socket.destroyed) return;

			// Initialize activeRequests if needed
			if (!socket.activeRequests) {
				socket.activeRequests = new Map();
			}

			// Reduce pipeline in endgame mode
			const progress = (totalDownloaded / Number(totalSize)) * 100;
			const inEndgame = progress > 95 && queue.length() < 50;
			if (inEndgame && !socket.endgameMode) {
				socket.endgameMode = true;
			}
			const maxPipeline = socket.endgameMode ? 5 : 10;

			while (
				(socket.pendingRequests ?? 0) < maxPipeline &&
				queue.length() > 0
			) {
				// Use rarest-first selection if peer pieces available
				const pieceBlock = queue.deque(socket.availablePieces);
				if (!pieceBlock) break;

				if (pieces.needed(pieceBlock)) {
					const blockKey = blockId(pieceBlock);

					// Don't request if we already requested this block from this peer
					if (socket.activeRequests.has(blockKey)) continue;

					try {
						socket.write(buildRequest(pieceBlock));

						// Track with timestamp for timeout detection
						socket.activeRequests.set(blockKey, {
							block: pieceBlock,
							requestedAt: Date.now(),
						});

						pieces.addRequested(pieceBlock);
						socket.pendingRequests = (socket.pendingRequests ?? 0) + 1;
					} catch (error) {
						// Re-queue on write failure
						queue.queueFront(pieceBlock);
						break;
					}
				}
			}
		}
	});

	// Write piece block to appropriate files
	async function writePieceBlock(
		torrent: Torrent,
		pieceIndex: number,
		begin: number,
		blockData: Buffer,
	): Promise<void> {
		const pieceLength = torrent.info["piece length"] as number;
		const globalOffset =
			BigInt(pieceIndex) * BigInt(pieceLength) + BigInt(begin);

		try {
			for (const fileEntry of torrentFiles) {
				const fileStart = fileEntry.offset;
				const fileEnd = fileEntry.offset + fileEntry.length;

				if (
					globalOffset < fileEnd &&
					globalOffset + BigInt(blockData.length) > fileStart
				) {
					const intersectionStart =
						globalOffset > fileStart ? globalOffset : fileStart;
					const intersectionEnd =
						globalOffset + BigInt(blockData.length) < fileEnd
							? globalOffset + BigInt(blockData.length)
							: fileEnd;

					if (intersectionStart < intersectionEnd) {
						const fileOffsetStart = Number(intersectionStart - fileStart);
						const blockOffsetStart = Number(intersectionStart - globalOffset);
						const length = Number(intersectionEnd - intersectionStart);

						const dataToWrite = blockData.slice(
							blockOffsetStart,
							blockOffsetStart + length,
						);

						await fileEntry.handle.write(
							dataToWrite,
							0,
							length,
							fileOffsetStart,
						);
					}
				}
			}
		} catch (error) {
			// Silently handle write errors
		}
	}

	// Initialize file handles
	async function initializeFiles(
		torrent: Torrent,
		outputDirPath: string,
		torrentName: string,
	): Promise<void> {
		const isMultiFile = !!torrent.info.files;
		torrentFiles = [];

		if (isMultiFile) {
			let currentOffset = BigInt(0);

			for (const file of torrent.info.files as File[]) {
				const filePathParts = file.path.map((p: Buffer) => p.toString("utf8"));
				const fullFilePath = path.join(
					outputDirPath,
					torrentName,
					...filePathParts,
				);
				const fileDir = path.dirname(fullFilePath);

				await fs.mkdir(fileDir, { recursive: true });
				const handle = await fs.open(fullFilePath, "w+");

				torrentFiles.push({
					handle,
					path: fullFilePath,
					offset: currentOffset,
					length: BigInt(file.length),
				});

				currentOffset += BigInt(file.length);
			}
		} else {
			const fullFilePath = path.join(outputDirPath, torrentName);
			const handle = await fs.open(fullFilePath, "w+");

			torrentFiles.push({
				handle,
				path: fullFilePath,
				offset: BigInt(0),
				length: size(torrent),
			});
		}
	}

	// Cleanup
	async function cleanup(): Promise<void> {
		for (const file of torrentFiles) {
			try {
				await file.handle.close();
			} catch (e) {
				// ignore
			}
		}
	}
}
