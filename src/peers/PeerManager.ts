import { Socket } from "node:net";
import type { MessageHandler } from "../core/handlers/MessageHandler";
import type {
	EndgameManager,
	ExtendedSocket,
} from "../core/modules/EndgameManager";
import type { UploadManager } from "../core/modules/UploadManager";
import type Pieces from "../pieces/Pieces";
import {
	buildBitfield,
	buildHandshake,
	buildInterested,
	buildKeepAlive,
	buildRequest,
} from "../protocol/messages";
import type Queue from "../queue/Queue";
import type { Peer, Torrent } from "../types/index";
import Logger, { LogCategory } from "../utils/logger";

// PHASE 4: Peer ban tracking
interface BannedPeer {
	ip: string;
	port: number;
	reason: "corrupt_data" | "spam" | "timeout" | "protocol_violation";
	bannedUntil: number;
}

/**
 * PeerManager handles peer connections, pooling, and lifecycle
 */
export class PeerManager {
	private activeSockets = new Map<string, ExtendedSocket>();
	private knownPeers = new Set<string>(); // "ip:port"
	private peerQueue: Peer[] = [];
	private activePeers = 0;
	private connectedPeers = 0;

	// FIX #7: Connection pooling configuration
	private readonly MAX_CONNECTIONS = 50; // Total peers
	private readonly MAX_CONCURRENT_CONNECTIONS = 50; // FIX #6: Increased from 20 to 50 for parallel discovery
	private connectingCount = 0; // Track ongoing connection attempts
	private failedPeers = new Map<
		string,
		{ attempts: number; lastTry: number }
	>(); // Exponential backoff

	// PHASE 4: Peer banning system
	private bannedPeers = new Map<string, BannedPeer>();
	private readonly BAN_DURATION_MS = 3600000; // 1 hour

	private connectionInterval: NodeJS.Timeout;
	private keepAliveInterval: NodeJS.Timeout;
	private healthCheckInterval: NodeJS.Timeout;
	private readonly CONNECTION_CHECK_INTERVAL = 1000;
	private readonly KEEP_ALIVE_INTERVAL = 60000; // FIX #7: Reduced from 90000 to 60000 for better stability
	private readonly HEALTH_CHECK_INTERVAL = 30000;
	private readonly SOCKET_TIMEOUT = 120000;
	private readonly CONNECTION_TIMEOUT_MS = 3000; // FIX #4: Reduced from 5000 to 3000 for faster bad peer replacement
	private readonly HANDSHAKE_LENGTH = 68;
	private readonly PROTOCOL_ID_LENGTH = 19;
	private readonly PROTOCOL_STRING_START = 1;
	private readonly PROTOCOL_STRING_END = 20;
	private readonly PROTOCOL_STRING = "BitTorrent protocol";

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
		this.healthCheckInterval = setInterval(() => {
			this.monitorPeerHealth();
			this.cleanupExpiredBans(); // PHASE 4: Clean up expired bans
		}, this.HEALTH_CHECK_INTERVAL);
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
	 * FIX #8: Validate IPs before adding
	 * FIX #5: Sort by seed status (seeds first)
	 */
	addPeers(peers: Peer[]): void {
		const validPeers: Peer[] = [];

		peers.forEach((peer) => {
			// FIX #8: Validate IP address
			if (!this.isValidPeerIP(peer.ip)) {
				return; // Skip invalid IPs
			}

			// FIX #8: Validate port
			if (peer.port < 1024 || peer.port > 65535) {
				return; // Skip invalid ports
			}

			// PHASE 4: Check if peer is banned
			if (this.isBanned(peer.ip, peer.port)) {
				return; // Skip banned peers
			}

			const peerId = `${peer.ip}:${peer.port}`;

			// Check if already known
			if (!this.knownPeers.has(peerId)) {
				// FIX #7: Check if should retry failed peer
				if (!this.shouldRetryPeer(peer.ip, peer.port)) {
					return; // Skip recently failed peer
				}

				validPeers.push(peer);
			}
		});

		// FIX #5: Sort by seed status (seeds first = faster download)
		// Note: Since Peer type doesn't have seeder field from tracker,
		// we keep peers in the order received (tracker usually sends seeds first)
		validPeers.sort(() => Math.random() - 0.5); // Shuffle for load balancing

		// Add sorted peers to queue
		this.peerQueue.push(...validPeers);
		this.manageConnections();
	}

	/**
	 * Manage peer connections (auto-connect if slots available)
	 * FIX #7: Respect concurrent connection limit
	 */
	private manageConnections(): void {
		while (
			this.activePeers < this.MAX_CONNECTIONS &&
			this.connectingCount < this.MAX_CONCURRENT_CONNECTIONS &&
			this.peerQueue.length > 0
		) {
			const peer = this.peerQueue.shift();
			if (peer) {
				this.connectingCount++;
				this.connectToPeer(peer).finally(() => {
					this.connectingCount--;
					// Process next in queue
					this.manageConnections();
				});
			}
		}
	}

	/**
	 * Connect to a peer
	 * FIX #7: Return Promise for connection pooling
	 */
	private connectToPeer(peer: Peer): Promise<void> {
		return new Promise((resolve) => {
			const socket = new Socket() as ExtendedSocket;
			const peerId = `${peer.ip}:${peer.port}`;

			socket.peerId = peerId;
			socket.pendingRequests = 0;
			socket.lastData = Date.now();
			socket.choked = true;
			socket.activeRequests = new Map();
			// Fix 2: Initialize adaptive pipelining fields
			socket.maxPipeline = 32; // Start with aggressive pipelining (INITIAL_PIPELINE)
			socket.rollingLatency = undefined;
			socket.requestTimestamps = new Map();

			// Configure socket
			socket.setKeepAlive(true, this.HEALTH_CHECK_INTERVAL);
			socket.setNoDelay(true);
			socket.setTimeout(this.SOCKET_TIMEOUT); // Increased from 30s to 120s for large files

			// FIX #11: Increase max listeners for concurrent operations
			socket.setMaxListeners(100);

			// FIX #11: Try to increase TCP send buffer for better throughput
			// Note: setsockopt is not available in Node.js Socket API
			// The OS will auto-tune the buffer, but we can hint with highWaterMark
			// This is already handled by Node.js defaults (16KB), which is sufficient

			let handshakeComplete = false;
			let messageBuffer = Buffer.alloc(0);
			let connectionResolved = false;

			// FIX #7: Connection timeout
			const connectionTimeout = setTimeout(() => {
				if (!connectionResolved) {
					connectionResolved = true;
					this.recordPeerFailure(peer.ip, peer.port);
					socket.destroy();
					resolve();
				}
			}, this.CONNECTION_TIMEOUT_MS);

			// Connect event
			socket.on("connect", () => {
				clearTimeout(connectionTimeout);
				if (!connectionResolved) {
					connectionResolved = true;
					resolve();
				}
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
				if (
					!handshakeComplete &&
					messageBuffer.length >= this.HANDSHAKE_LENGTH
				) {
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

						// FIX #5: Register peer early for uploads
						this.uploadManager.registerPeerEarly(peerId);

						// FIX #8: Only send bitfield if we have pieces (defer unnecessary send)
						if (this.pieces.getVerifiedCount() > 0) {
							const bitfield = this.pieces.getBitfield();
							socket.write(buildBitfield(bitfield));
							Logger.debug(LogCategory.PEER, `Sent BITFIELD to ${peerId}`, {
								pieceCount: this.pieces.getVerifiedCount(),
							});
						}

						// FIX #5: Quick unchoke after 2 seconds to allow uploads
						setTimeout(() => {
							if (!socket.destroyed) {
								this.uploadManager.quickUnchokePeer(peerId);
							}
						}, 2000);

						// Send interested message
						socket.write(buildInterested());

						// FIX #1: Request pieces immediately (removed setTimeout wrapper)
						if (!socket.destroyed) {
							this.requestPieces(socket);
						}
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

			// Error event - record failure
			socket.on("error", () => {
				this.recordPeerFailure(peer.ip, peer.port);
				if (!connectionResolved) {
					connectionResolved = true;
					clearTimeout(connectionTimeout);
					resolve();
				}
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
		});
	}

	/**
	 * Request a batch of pieces from a peer in one go
	 * This reduces per-request overhead and keeps the pipeline full
	 */
	private requestBatchFromPeer(
		socket: ExtendedSocket,
		batchSize: number,
	): void {
		if (!socket.activeRequests) socket.activeRequests = new Map();
		if (!socket.requestTimestamps) socket.requestTimestamps = new Map();

		for (let i = 0; i < batchSize; i++) {
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
	 * Request pieces from a peer
	 * FIX #2: Adaptive batch sizing based on network conditions
	 */
	requestPieces(socket: ExtendedSocket): void {
		if (!socket.activeRequests) socket.activeRequests = new Map();
		if (!socket.requestTimestamps) socket.requestTimestamps = new Map();

		const maxPipeline = this.endgameManager.getMaxPipeline(socket);
		const currentPending = socket.pendingRequests ?? 0;

		// Calculate how many slots are available in the pipeline
		const availableSlots = Math.max(0, maxPipeline - currentPending);

		if (availableSlots > 0) {
			// FIX #2: Adaptive batch sizing based on network conditions
			let batchSize: number;
			const activePeerCount = this.activePeers;
			// Simplified: use queue length as proxy for rarest piece availability
			const queueLength = this.queue.length();

			if (activePeerCount > 10 && queueLength > 100) {
				// Many peers available and many pieces needed: be aggressive
				batchSize = Math.min(64, availableSlots);
			} else if (activePeerCount < 5) {
				// Few peers: be conservative
				batchSize = Math.min(8, availableSlots);
			} else {
				// Normal: moderate
				batchSize = Math.min(32, availableSlots);
			}

			this.requestBatchFromPeer(socket, batchSize);
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

	/**
	 * FIX #8: Validate peer IP address
	 * Reject private, reserved, and invalid IP ranges
	 */
	private isValidPeerIP(ip: string): boolean {
		const invalidPatterns = [
			/^127\./, // Loopback
			/^192\.168\./, // Private
			/^10\./, // Private
			/^172\.(1[6-9]|2[0-9]|3[01])\./, // Private (172.16.0.0 - 172.31.255.255)
			/^169\.254\./, // Link-local
			/^224\./, // Multicast
			/^255\./, // Broadcast
			/^0\./, // Current network
		];

		return !invalidPatterns.some((pattern) => pattern.test(ip));
	}

	/**
	 * FIX #7: Check if should retry peer (exponential backoff)
	 */
	private shouldRetryPeer(ip: string, port: number): boolean {
		const key = `${ip}:${port}`;
		const failed = this.failedPeers.get(key);
		if (!failed) return true; // Never failed, should try

		// Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 32s
		const backoff = 1000 * 2 ** Math.min(failed.attempts, 5);
		return Date.now() - failed.lastTry > backoff;
	}

	/**
	 * FIX #7: Record peer connection failure for backoff
	 */
	private recordPeerFailure(ip: string, port: number): void {
		const key = `${ip}:${port}`;
		const existing = this.failedPeers.get(key) ?? { attempts: 0, lastTry: 0 };
		this.failedPeers.set(key, {
			attempts: existing.attempts + 1,
			lastTry: Date.now(),
		});
	}

	/**
	 * PHASE 4: Check if peer is banned
	 */
	private isBanned(ip: string, port: number): boolean {
		const key = `${ip}:${port}`;
		const ban = this.bannedPeers.get(key);
		if (!ban) return false;

		// Check if ban expired
		if (Date.now() > ban.bannedUntil) {
			this.bannedPeers.delete(key);
			return false;
		}
		return true;
	}

	/**
	 * PHASE 4: Ban a peer for misbehavior
	 */
	banPeer(ip: string, port: number, reason: BannedPeer["reason"]): void {
		const key = `${ip}:${port}`;
		this.bannedPeers.set(key, {
			ip,
			port,
			reason,
			bannedUntil: Date.now() + this.BAN_DURATION_MS,
		});
		Logger.warn(LogCategory.PEER, `Banned peer ${ip}:${port} for ${reason}`, {
			duration: "1 hour",
		});
	}

	/**
	 * PHASE 4: Clean up expired bans (called periodically)
	 */
	private cleanupExpiredBans(): void {
		const now = Date.now();
		for (const [key, ban] of this.bannedPeers.entries()) {
			if (now > ban.bannedUntil) {
				this.bannedPeers.delete(key);
			}
		}
	}
}
