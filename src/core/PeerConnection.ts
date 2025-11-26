import { Socket } from "net";
import type { Peer, Torrent } from "../types/index";
import type { PieceBlock } from "../queue/Queue";
import type Pieces from "../pieces/Pieces";
import type Queue from "../queue/Queue";
import {
	buildHandshake,
	buildInterested,
	buildRequest,
} from "../protocol/messages";
import { MessageHandler } from "./MessageHandler";
import { EndgameManager, type ExtendedSocket } from "./EndgameManager";

/**
 * PeerConnection manages peer connections and requests
 */
export class PeerConnection {
	private activeSockets = new Map<string, ExtendedSocket>();
	private activePeers = 0;
	private connectedPeers = 0;
	private totalPieces: number;

	constructor(
		private torrent: Torrent,
		private pieces: Pieces,
		private queue: Queue,
		private messageHandler: MessageHandler,
		private endgameManager: EndgameManager,
	) {
		this.totalPieces = torrent.info.pieces.length / 20;
	}

	/**
	 * Connect to a peer
	 */
	connectToPeer(peer: Peer): void {
		const socket = new Socket() as ExtendedSocket;
		const peerId = `${peer.ip}:${peer.port}`;

		socket.peerId = peerId;
		socket.pendingRequests = 0;
		socket.lastData = Date.now();
		socket.choked = true;
		socket.activeRequests = new Map();

		// Configure socket
		socket.setKeepAlive(true, 30000);
		socket.setNoDelay(true);
		socket.setTimeout(30000);

		let handshakeComplete = false;
		let messageBuffer = Buffer.alloc(0);

		// Connect event
		socket.on("connect", () => {
			this.activePeers++;
			this.activeSockets.set(peerId, socket);
			socket.write(buildHandshake(this.torrent));
		});

		// Data event
		socket.on("data", (data: Buffer) => {
			socket.lastData = Date.now();
			messageBuffer = Buffer.concat([messageBuffer, data]);

			// Handle handshake
			if (!handshakeComplete && messageBuffer.length >= 68) {
				const handshakeData = messageBuffer.slice(0, 68);
				if (
					handshakeData[0] === 19 &&
					handshakeData.toString("utf8", 1, 20) === "BitTorrent protocol"
				) {
					handshakeComplete = true;
					this.connectedPeers++;
					messageBuffer = messageBuffer.slice(68);
					socket.write(buildInterested());

					setTimeout(() => {
						if (!socket.destroyed) {
							this.requestPieces(socket);
						}
					}, 100);
				} else {
					socket.destroy();
					return;
				}
			}

			// Process messages
			if (handshakeComplete) {
				const consumed = this.messageHandler.processMessages(
					socket,
					messageBuffer,
					this.pieces,
					this.queue,
					this.activeSockets,
				);
				messageBuffer = messageBuffer.slice(consumed);

				// Request more pieces if unchoked
				if (!socket.choked && !socket.destroyed) {
					this.requestPieces(socket);
				}
			}
		});

		// Error event
		socket.on("error", () => {
			// Silently handle errors
		});

		// Timeout event
		socket.on("timeout", () => {
			socket.destroy();
		});

		// Close event
		socket.on("close", () => {
			this.activeSockets.delete(peerId);
			this.activePeers = Math.max(0, this.activePeers - 1);
			if (handshakeComplete) {
				this.connectedPeers = Math.max(0, this.connectedPeers - 1);
			}

			// Remove peer from queue tracking
			if (socket.peerId) {
				this.queue.removePeer(socket.peerId);
			}

			// Re-queue pending requests
			if (socket.activeRequests && socket.activeRequests.size > 0) {
				socket.activeRequests.forEach((req) => {
					this.pieces.removeRequested(req.block);
					this.queue.queueFront(req.block);
				});
				socket.activeRequests.clear();

				// Trigger requests on other peers
				this.activeSockets.forEach((s) => {
					if (!s.destroyed && !s.choked) {
						this.requestPieces(s);
					}
				});
			}
		});

		// Connect
		socket.connect(peer.port, peer.ip);
	}

	/**
	 * Request pieces from a peer
	 */
	requestPieces(socket: ExtendedSocket): void {
		if (!socket.activeRequests) socket.activeRequests = new Map();

		const maxPipeline = this.endgameManager.getMaxPipeline(socket);

		while (
			(socket.pendingRequests ?? 0) < maxPipeline &&
			this.queue.length() > 0
		) {
			const pieceBlock = this.queue.deque(socket.availablePieces);
			if (!pieceBlock) break;

			if (this.pieces.needed(pieceBlock)) {
				const blockKey = `${pieceBlock.index}:${pieceBlock.begin}`;

				if (socket.activeRequests.has(blockKey)) continue;

				try {
					socket.write(buildRequest(pieceBlock));
					socket.activeRequests.set(blockKey, {
						block: pieceBlock,
						requestedAt: Date.now(),
					});
					this.pieces.addRequested(pieceBlock);
					socket.pendingRequests = (socket.pendingRequests ?? 0) + 1;
				} catch (error) {
					this.queue.queueFront(pieceBlock);
					break;
				}
			}
		}
	}

	/**
	 * Get active sockets
	 */
	getActiveSockets(): Map<string, ExtendedSocket> {
		return this.activeSockets;
	}

	/**
	 * Get connected peers count
	 */
	getConnectedPeers(): number {
		return this.connectedPeers;
	}

	/**
	 * Get active peers count
	 */
	getActivePeers(): number {
		return this.activePeers;
	}
}
