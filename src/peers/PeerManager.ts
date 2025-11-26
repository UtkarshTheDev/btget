import { Socket } from "net";
import type { Peer, Torrent } from "../types/index";
import type { PieceBlock } from "../queue/Queue";
import type Pieces from "../pieces/Pieces";
import type Queue from "../queue/Queue";
import {
	buildHandshake,
	buildInterested,
	buildRequest,
	buildKeepAlive,
} from "../protocol/messages";
import { MessageHandler } from "../core/handlers/MessageHandler";
import {
	EndgameManager,
	type ExtendedSocket,
} from "../core/modules/EndgameManager";

/**
 * PeerManager handles peer connections, pooling, and lifecycle
 */
export class PeerManager {
	private activeSockets = new Map<string, ExtendedSocket>();
	private knownPeers = new Set<string>(); // "ip:port"
	private peerQueue: Peer[] = [];
	private activePeers = 0;
	private connectedPeers = 0;
	private readonly MAX_CONNECTIONS = 50;
	private totalPieces: number;
	private connectionInterval: NodeJS.Timer;
	private keepAliveInterval: NodeJS.Timer;
	private healthCheckInterval: NodeJS.Timer;

	constructor(
		private torrent: Torrent,
		private pieces: Pieces,
		private queue: Queue,
		private messageHandler: MessageHandler,
		private endgameManager: EndgameManager,
	) {
		this.totalPieces = torrent.info.pieces.length / 20;

		// Start connection manager loop
		this.connectionInterval = setInterval(() => this.manageConnections(), 1000);

		// Start keep-alive sender (every 90 seconds)
		this.keepAliveInterval = setInterval(() => this.sendKeepAlives(), 90000);

		// Start peer health monitoring (every 30 seconds)
		this.healthCheckInterval = setInterval(
			() => this.monitorPeerHealth(),
			30000,
		);
	}

	/**
	 * Stop peer manager
	 */
	stop(): void {
		clearInterval(this.connectionInterval);
		clearInterval(this.keepAliveInterval);
		clearInterval(this.healthCheckInterval);
		this.activeSockets.forEach((socket) => socket.destroy());
		this.activeSockets.clear();
	}

	/**
	 * Add new peers to the pool
	 */
	addPeers(peers: Peer[]): void {
		peers.forEach((peer) => {
			const peerId = `${peer.ip}:${peer.port}`;
			if (!this.knownPeers.has(peerId)) {
				this.knownPeers.add(peerId);
				this.peerQueue.push(peer);
			}
		});
		this.manageConnections();
	}

	/**
	 * Manage peer connections (auto-connect if slots available)
	 */
	private manageConnections(): void {
		while (
			this.activePeers < this.MAX_CONNECTIONS &&
			this.peerQueue.length > 0
		) {
			const peer = this.peerQueue.shift();
			if (peer) {
				this.connectToPeer(peer);
			}
		}
	}

	/**
	 * Connect to a peer
	 */
	private connectToPeer(peer: Peer): void {
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
		socket.setTimeout(120000); // Increased from 30s to 120s for large files

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
			if (this.activeSockets.has(peerId)) {
				this.activeSockets.delete(peerId);
				this.activePeers = Math.max(0, this.activePeers - 1);
				if (handshakeComplete) {
					this.connectedPeers = Math.max(0, this.connectedPeers - 1);
				}
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

	/**
	 * Get total download speed (bytes/sec)
	 */
	getDownloadSpeed(): number {
		let totalSpeed = 0;
		this.activeSockets.forEach((socket) => {
			if (socket.speed) {
				totalSpeed += socket.speed;
			}
		});
		return totalSpeed;
	}

	/**
	 * Send keep-alive messages to all active peers
	 * Prevents connections from timing out during slow downloads
	 */
	private sendKeepAlives(): void {
		const keepAliveMsg = buildKeepAlive();
		this.activeSockets.forEach((socket) => {
			if (!socket.destroyed && socket.writable) {
				try {
					socket.write(keepAliveMsg);
				} catch (error) {
					// Silently ignore write errors
				}
			}
		});
	}

	/**
	 * Monitor peer health and identify stalled connections
	 * Peers with no data for 2 minutes are considered stalled
	 */
	private monitorPeerHealth(): void {
		const now = Date.now();
		const STALL_THRESHOLD = 120000; // 2 minutes

		this.activeSockets.forEach((socket, peerId) => {
			if (socket.destroyed) return;

			const timeSinceData = now - (socket.lastData ?? now);

			// If peer hasn't sent data in 2 minutes and has pending requests, it's stalled
			if (
				timeSinceData > STALL_THRESHOLD &&
				socket.activeRequests &&
				socket.activeRequests.size > 0
			) {
				// Peer is stalled - destroy connection to free up slot
				socket.destroy();
			}
		});
	}
}
