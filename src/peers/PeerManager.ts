import { Socket } from "node:net";
import type { MessageHandler } from "../core/handlers/MessageHandler";
import type {
	EndgameManager,
	ExtendedSocket,
} from "../core/modules/EndgameManager";
import type { UploadManager } from "../core/modules/UploadManager";
import type Pieces from "../pieces/Pieces";
import {
	buildHandshake,
	buildInterested,
	buildKeepAlive,
	buildRequest,
} from "../protocol/messages";
import type Queue from "../queue/Queue";
import type { Peer, Torrent } from "../types/index";

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
	private connectionInterval: NodeJS.Timeout;
	private keepAliveInterval: NodeJS.Timeout;
	private healthCheckInterval: NodeJS.Timeout;
	private readonly CONNECTION_CHECK_INTERVAL = 1000;
	private readonly KEEP_ALIVE_INTERVAL = 90000;
	private readonly HEALTH_CHECK_INTERVAL = 30000;
	private readonly SOCKET_TIMEOUT = 120000;
	private readonly HANDSHAKE_LENGTH = 68;
	private readonly PROTOCOL_ID_LENGTH = 19;
	private readonly PROTOCOL_STRING_START = 1;
	private readonly PROTOCOL_STRING_END = 20;
	private readonly PROTOCOL_STRING = "BitTorrent protocol";
	private readonly REQUEST_TIMEOUT_MS = 100;

	constructor(
		private torrent: Torrent,
		private pieces: Pieces,
		private queue: Queue,
		private messageHandler: MessageHandler,
		private endgameManager: EndgameManager,
		private uploadManager: UploadManager,
	) {
		// Provide upload manager with socket reference for choke/unchoke messages
		this.uploadManager.setActiveSockets(this.activeSockets);

		// Start connection manager loop
		this.connectionInterval = setInterval(
			() => this.manageConnections(),
			this.CONNECTION_CHECK_INTERVAL,
		);

		// Start keep-alive sender (every 90 seconds)
		this.keepAliveInterval = setInterval(
			() => this.sendKeepAlives(),
			this.KEEP_ALIVE_INTERVAL,
		);

		// Start peer health monitoring (every 30 seconds)
		this.healthCheckInterval = setInterval(
			() => this.monitorPeerHealth(),
			this.HEALTH_CHECK_INTERVAL,
		);
	}

	/**
	 * Stop peer manager
	 */
	stop(): void {
		clearInterval(this.connectionInterval);
		clearInterval(this.keepAliveInterval);
		clearInterval(this.healthCheckInterval);
		this.activeSockets.forEach((socket) => {
			socket.destroy();
		});
		this.activeSockets.clear();
		this.uploadManager.stop();
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
		// Fix 2: Initialize adaptive pipelining fields
		socket.maxPipeline = 10; // Start with default, will adapt based on RTT
		socket.rollingLatency = undefined;
		socket.requestTimestamps = new Map();

		// Configure socket
		socket.setKeepAlive(true, this.HEALTH_CHECK_INTERVAL);
		socket.setNoDelay(true);
		socket.setTimeout(this.SOCKET_TIMEOUT); // Increased from 30s to 120s for large files

		let handshakeComplete = false;
		let messageBuffer = Buffer.alloc(0);

		// Connect event
		socket.on("connect", () => {
			this.activePeers++;
			this.activeSockets.set(peerId, socket);
			socket.write(buildHandshake(this.torrent));
			// Register peer with upload manager
			this.uploadManager.registerPeer(peerId);
		});

		// Data event
		socket.on("data", (data: Buffer) => {
			socket.lastData = Date.now();
			messageBuffer = Buffer.concat([messageBuffer, data]);

			// Handle handshake
			if (!handshakeComplete && messageBuffer.length >= this.HANDSHAKE_LENGTH) {
				const handshakeData = messageBuffer.slice(0, this.HANDSHAKE_LENGTH);
				if (
					handshakeData[0] === this.PROTOCOL_ID_LENGTH &&
					handshakeData.toString(
						"utf8",
						this.PROTOCOL_STRING_START,
						this.PROTOCOL_STRING_END,
					) === this.PROTOCOL_STRING
				) {
					handshakeComplete = true;
					this.connectedPeers++;
					messageBuffer = messageBuffer.slice(this.HANDSHAKE_LENGTH);
					socket.write(buildInterested());

					setTimeout(() => {
						if (!socket.destroyed) {
							this.requestPieces(socket);
						}
					}, this.REQUEST_TIMEOUT_MS);
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
					// Fix 1: Pass requestPieces callback for immediate request triggering
					(s) => this.requestPieces(s),
				);
				messageBuffer = messageBuffer.slice(consumed);

				// Send choke/unchoke messages based on upload manager decisions
				this.uploadManager.sendChokeMessages(this.activeSockets);

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

			// Remove peer from upload manager
			this.uploadManager.removePeer(peerId);

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
		if (!socket.requestTimestamps) socket.requestTimestamps = new Map();

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
					// Fix 2: Track request timestamp for RTT measurement
					socket.requestTimestamps.set(blockKey, Date.now());
					this.pieces.addRequested(pieceBlock);
					socket.pendingRequests = (socket.pendingRequests ?? 0) + 1;
				} catch (_error) {
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
	 * Get total upload speed (bytes/sec)
	 */
	getUploadSpeed(): number {
		return this.uploadManager.getUploadSpeed();
	}

	/**
	 * Get total uploaded bytes
	 */
	getTotalUploaded(): number {
		return this.uploadManager.getTotalUploaded();
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
				} catch (_error) {
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

		this.activeSockets.forEach((socket) => {
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
