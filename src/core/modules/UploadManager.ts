import type { RequestPayload } from "../../protocol/messages";
import { buildChoke, buildPiece, buildUnchoke } from "../../protocol/messages";
import Logger from "../../utils/logger";
import type { ExtendedSocket } from "./EndgameManager";
import type { FileWriter } from "./FileWriter";

/**
 * PeerUploadStats tracks upload/download statistics for tit-for-tat algorithm
 */
interface PeerUploadStats {
	peerId: string;
	downloadRate: number; // Bytes/sec this peer is uploading to us
	lastDownloadTime: number;
	bytesDownloadedFromPeer: number;
	bytesUploadedToPeer: number;
	uploadRate: number; // Bytes/sec we're uploading to this peer
	lastUploadTime: number;
	isChoked: boolean;
	// FIX #14: Track last sent state to prevent redundant messages
	lastSentChokeState?: boolean; // undefined = never sent, true = sent CHOKE, false = sent UNCHOKE
}

/**
 * UploadManager handles seeding logic using tit-for-tat and optimistic unchoking
 * to maximize download speed while minimizing upload bandwidth
 */
export class UploadManager {
	private peerStats = new Map<string, PeerUploadStats>();
	private totalUploaded = 0;
	private chokingInterval: NodeJS.Timer | null = null;
	private optimisticInterval: NodeJS.Timer | null = null;
	private currentOptimisticPeer: string | null = null;
	private allSockets: Map<string, ExtendedSocket> | null = null; // Reference to active sockets

	// Configuration for maximum download speed
	private readonly TIT_FOR_TAT_SLOTS = 4; // Peers who upload fastest to us
	private readonly OPTIMISTIC_SLOTS = 2; // Random peers for discovery
	private readonly CHOKING_ROUND_INTERVAL = 10000; // 10 seconds
	private readonly OPTIMISTIC_UNCHOKE_INTERVAL = 30000; // 30 seconds
	private readonly EMA_ALPHA = 0.3;
	private readonly EMA_DECAY = 0.7;
	private readonly MS_PER_SEC = 1000;
	private readonly RANDOM_SORT_OFFSET = 0.5;

	// FIX #10: Request validation constants
	private readonly MAX_BLOCK_SIZE = 32768; // 32 KB
	private readonly MAX_REQUESTS_PER_MINUTE = 1000;
	private peerRequestCounts = new Map<
		string,
		{ count: number; windowStart: number }
	>();

	// FIX #9: Per-peer upload rate limiting
	private readonly RATE_LIMIT_BYTES_PER_SEC = 256 * 1024; // 256 KB/s per peer
	private readonly RATE_LIMIT_WINDOW_MS = 1000; // 1 second window
	private peerUploadRates = new Map<
		string,
		{ bytesThisWindow: number; windowStart: number }
	>();

	// FIX #10: Request queueing instead of dropping
	private readonly MAX_QUEUE_SIZE = 1000;
	private requestQueue: Array<{
		socket: ExtendedSocket;
		request: RequestPayload;
	}> = [];

	constructor(private fileWriter: FileWriter) {
		this.startChokingAlgorithm();
	}

	/**
	 * Set reference to active sockets (called by PeerManager)
	 */
	setActiveSockets(sockets: Map<string, ExtendedSocket>): void {
		this.allSockets = sockets;
	}

	/**
	 * Track download rate from a peer (for tit-for-tat prioritization)
	 */
	trackPeerDownloadRate(peerId: string, bytesReceived: number): void {
		const now = Date.now();
		let stats = this.peerStats.get(peerId);

		if (!stats) {
			stats = {
				peerId,
				downloadRate: 0,
				lastDownloadTime: now,
				bytesDownloadedFromPeer: 0,
				bytesUploadedToPeer: 0,
				uploadRate: 0,
				lastUploadTime: now,
				isChoked: true,
			};
			this.peerStats.set(peerId, stats);
		}

		stats.bytesDownloadedFromPeer += bytesReceived;

		// Calculate download rate (exponential moving average)
		const timeDelta = (now - stats.lastDownloadTime) / this.MS_PER_SEC; // seconds
		if (timeDelta > 0) {
			const instantRate = bytesReceived / timeDelta;
			// EMA with alpha = 0.3 for smoothing
			stats.downloadRate =
				stats.downloadRate * this.EMA_DECAY + instantRate * this.EMA_ALPHA;
			stats.lastDownloadTime = now;
		}
	}

	/**
	 * Register peer early (before they send requests)
	 * This prevents "peer not registered" errors
	 */
	registerPeerEarly(peerId: string): void {
		if (!this.peerStats.has(peerId)) {
			const now = Date.now();
			this.peerStats.set(peerId, {
				peerId,
				downloadRate: 0,
				lastDownloadTime: now,
				bytesDownloadedFromPeer: 0,
				bytesUploadedToPeer: 0,
				uploadRate: 0,
				lastUploadTime: now,
				isChoked: true, // Start choked, will be unchoked by choking round
			});
			console.log(
				`✅ Early registered peer ${peerId}. Total peers: ${this.peerStats.size}`,
			);
		}
	}

	/**
	 * Quickly unchoke a specific peer (for bootstrap)
	 */
	quickUnchokePeer(peerId: string): void {
		const stats = this.peerStats.get(peerId);
		if (stats) {
			stats.isChoked = false;
			console.log(`🔓 Quick unchoked peer ${peerId}`);

			// Send unchoke message immediately
			if (this.allSockets) {
				const socket = this.allSockets.get(peerId);
				if (socket && !socket.destroyed) {
					socket.write(buildUnchoke());
					console.log(`📤 Sent UNCHOKE to ${peerId}`);
				}
			}
		}
	}

	/**
	 * Handle incoming REQUEST message from peer
	 * FIX #10: Add request validation
	 */
	async handlePeerRequest(
		socket: ExtendedSocket,
		request: RequestPayload,
	): Promise<void> {
		console.log(
			`📥 REQUEST from ${socket.peerId}: piece ${request.index}, begin ${request.begin}, length ${request.length}`,
		);

		if (!socket.peerId) {
			console.log(`❌ No peerId on socket`);
			return;
		}

		// FIX #10: Validate block size
		if (request.length > this.MAX_BLOCK_SIZE || request.length <= 0) {
			console.warn(
				`❌ Invalid block size ${request.length} from ${socket.peerId} - disconnecting`,
			);
			socket.destroy();
			return;
		}

		// FIX #10: Rate limiting
		if (!this.checkRateLimit(socket.peerId)) {
			console.warn(
				`❌ Rate limit exceeded for ${socket.peerId} - disconnecting`,
			);
			socket.destroy();
			return;
		}

		// FIX #4: Register peer early if not already registered
		let stats = this.peerStats.get(socket.peerId);
		if (!stats) {
			console.log(`⚠️  Peer ${socket.peerId} not registered, registering early`);
			this.registerPeerEarly(socket.peerId);
			stats = this.peerStats.get(socket.peerId);
		}

		if (!stats) {
			console.log(`❌ Failed to register peer ${socket.peerId}`);
			return;
		}

		// Only serve pieces to unchoked peers
		if (stats.isChoked) {
			console.log(`❌ Peer ${socket.peerId} is CHOKED - rejecting request`);
			return;
		}

		console.log(`✅ Peer ${socket.peerId} is UNCHOKED - serving request`);

		// FIX #9: Check per-peer rate limit before sending
		if (!this.canUploadToPeer(socket.peerId)) {
			console.log(`⚠️  Peer ${socket.peerId} hit rate limit - queueing request`);
			// FIX #10: Queue this request for later
			if (this.requestQueue.length < this.MAX_QUEUE_SIZE) {
				this.requestQueue.push({ socket, request });
			}
			return;
		}

		try {
			// FIX #10: Validate bounds before reading
			// This is handled by fileWriter.readPieceBlock which will throw if invalid

			// Read the requested block from disk
			const block = await this.fileWriter.readPieceBlock(
				request.index,
				request.begin,
				request.length,
			);

			console.log(`✅ Read block successfully, sending ${block.length} bytes`);

			// Send PIECE message
			const pieceMessage = buildPiece({
				index: request.index,
				begin: request.begin,
				block: block,
				length: block.length,
			});

			socket.write(pieceMessage);

			// Update upload statistics
			this.totalUploaded += block.length;
			stats.bytesUploadedToPeer += block.length;

			// FIX #9: Record upload for rate limiting
			this.recordUploadToPeer(socket.peerId, block.length);

			console.log(
				`📤 UPLOADED ${block.length} bytes. Total: ${this.totalUploaded}`,
			);

			const now = Date.now();
			const timeDelta = (now - stats.lastUploadTime) / this.MS_PER_SEC;
			if (timeDelta > 0) {
				const instantRate = block.length / timeDelta;
				stats.uploadRate =
					stats.uploadRate * this.EMA_DECAY + instantRate * this.EMA_ALPHA;
				stats.lastUploadTime = now;
			}
		} catch (error) {
			console.error(`❌ Upload error for ${socket.peerId}: ${error}`);
		}
	}

	/**
	 * FIX #9: Check if peer can receive more data this second
	 * @param peerId - Peer identifier
	 * @returns true if within rate limit, false if exceeded
	 */
	private canUploadToPeer(peerId: string): boolean {
		const now = Date.now();
		const rate = this.peerUploadRates.get(peerId) ?? {
			bytesThisWindow: 0,
			windowStart: now,
		};

		// Window expired - reset
		if (now - rate.windowStart >= this.RATE_LIMIT_WINDOW_MS) {
			rate.bytesThisWindow = 0;
			rate.windowStart = now;
		}

		this.peerUploadRates.set(peerId, rate);
		return rate.bytesThisWindow < this.RATE_LIMIT_BYTES_PER_SEC;
	}

	/**
	 * FIX #9: Track bytes uploaded to peer
	 * @param peerId - Peer identifier
	 * @param bytes - Number of bytes uploaded
	 */
	private recordUploadToPeer(peerId: string, bytes: number): void {
		const rate = this.peerUploadRates.get(peerId);
		if (rate) {
			rate.bytesThisWindow += bytes;
		}
	}

	/**
	 * FIX #10: Process queued requests that couldn't be sent due to rate limiting
	 */
	private processQueuedRequests(): void {
		while (this.requestQueue.length > 0) {
			const item = this.requestQueue[0];
			if (!item) break;

			const { socket, request } = item;

			// Check if socket still valid
			if (!socket || socket.destroyed || !socket.peerId) {
				this.requestQueue.shift(); // Remove invalid request
				continue;
			}

			// Check if peer is still unchoked
			const stats = this.peerStats.get(socket.peerId);
			if (!stats || stats.isChoked) {
				this.requestQueue.shift(); // Peer choked, drop request
				continue;
			}

			// Check rate limit
			if (!this.canUploadToPeer(socket.peerId)) {
				break; // Still rate limited, try again later
			}

			// Process this request
			this.requestQueue.shift();
			this.handlePeerRequest(socket, request);
		}
	}

	/**
	 * FIX #10: Check rate limit for peer
	 * @param peerId - Peer identifier
	 * @returns true if within limit, false if exceeded
	 */
	private checkRateLimit(peerId: string): boolean {
		const now = Date.now();
		const windowMs = 60000; // 1 minute

		const rateInfo = this.peerRequestCounts.get(peerId);

		if (!rateInfo || now - rateInfo.windowStart > windowMs) {
			// New window
			this.peerRequestCounts.set(peerId, { count: 1, windowStart: now });
			return true;
		}

		rateInfo.count++;
		return rateInfo.count <= this.MAX_REQUESTS_PER_MINUTE;
	}

	/**
	 * Start choking algorithm (tit-for-tat + optimistic unchoking)
	 */
	private startChokingAlgorithm(): void {
		// Regular choking rounds every 10 seconds
		this.chokingInterval = setInterval(() => {
			this.performChokingRound();
			// CRITICAL: Send choke/unchoke messages after each round
			if (this.allSockets) {
				this.sendChokeMessages(this.allSockets);
			}
			// FIX #10: Process queued requests after choking round
			this.processQueuedRequests();
		}, this.CHOKING_ROUND_INTERVAL);

		// Optimistic unchoking every 30 seconds
		this.optimisticInterval = setInterval(() => {
			this.performOptimisticUnchoke();
			// CRITICAL: Send choke/unchoke messages after optimistic unchoke
			if (this.allSockets) {
				this.sendChokeMessages(this.allSockets);
			}
		}, this.OPTIMISTIC_UNCHOKE_INTERVAL);

		// Initial round (will run when first peer registers via registerPeer())
		// No need for setTimeout - messages sent on peer registration
	}

	/**
	 * Perform choking round: select best peers to unchoke
	 */
	private performChokingRound(): void {
		const allPeers = Array.from(this.peerStats.values());

		// Sort by download rate (peers uploading fastest to us get priority)
		const sortedByDownloadRate = allPeers
			.filter((p) => p.downloadRate > 0)
			.sort((a, b) => b.downloadRate - a.downloadRate);

		// Select top peers for tit-for-tat slots
		const titForTatPeers = sortedByDownloadRate.slice(
			0,
			this.TIT_FOR_TAT_SLOTS,
		);

		// Get current optimistic peers (keep them unchoked)
		const optimisticPeers = allPeers.filter(
			(p) => p.peerId === this.currentOptimisticPeer,
		);

		// Combine: tit-for-tat + optimistic
		const peersToUnchoke = new Set<string>();
		titForTatPeers.forEach((p) => {
			peersToUnchoke.add(p.peerId);
		});
		optimisticPeers.forEach((p) => {
			peersToUnchoke.add(p.peerId);
		});

		// Bootstrap: if we have no peers to unchoke (no download activity yet),
		// unchoke a few random peers to start the tit-for-tat cycle
		if (peersToUnchoke.size < this.TIT_FOR_TAT_SLOTS && allPeers.length > 0) {
			const remainingSlots = this.TIT_FOR_TAT_SLOTS - peersToUnchoke.size;
			const availablePeers = allPeers.filter(
				(p) => !peersToUnchoke.has(p.peerId),
			);
			const shuffled = availablePeers.sort(
				() => Math.random() - this.RANDOM_SORT_OFFSET,
			);
			const bootstrapPeers = shuffled.slice(0, remainingSlots);
			bootstrapPeers.forEach((p) => {
				peersToUnchoke.add(p.peerId);
			});
		}

		// Update choke status for all peers
		for (const stats of allPeers) {
			const shouldBeUnchoked = peersToUnchoke.has(stats.peerId);

			if (shouldBeUnchoked && stats.isChoked) {
				// Unchoke this peer
				stats.isChoked = false;
			} else if (!shouldBeUnchoked && !stats.isChoked) {
				// Choke this peer
				stats.isChoked = true;
			}
		}
	}

	/**
	 * Perform optimistic unchoking: randomly select new peers
	 */
	private performOptimisticUnchoke(): void {
		const allPeers = Array.from(this.peerStats.values());

		// Get peers that are currently choked
		const chokedPeers = allPeers.filter((p) => p.isChoked);

		if (chokedPeers.length === 0) return;

		// Randomly select optimistic peers
		const optimisticCount = Math.min(this.OPTIMISTIC_SLOTS, chokedPeers.length);
		const shuffled = chokedPeers.sort(
			() => Math.random() - this.RANDOM_SORT_OFFSET,
		);
		const selectedOptimistic = shuffled.slice(0, optimisticCount);

		// Update current optimistic peer
		if (selectedOptimistic.length > 0 && selectedOptimistic[0]) {
			this.currentOptimisticPeer = selectedOptimistic[0].peerId;

			// Unchoke optimistic peers
			for (const peer of selectedOptimistic) {
				peer.isChoked = false;
			}
		}
	}

	/**
	 * Send choke/unchoke messages to peers based on current state
	 * FIX #14: Only send when state changes
	 */
	sendChokeMessages(allSockets: Map<string, ExtendedSocket>): void {
		Logger.debug(
			`Sending choke/unchoke messages to ${this.peerStats.size} peers`,
		);
		let chokedCount = 0;
		let unchokedCount = 0;
		let skippedCount = 0;

		for (const [peerId, stats] of this.peerStats.entries()) {
			const socket = allSockets.get(peerId);
			if (!socket || socket.destroyed) {
				Logger.debug(`Peer ${peerId} has no socket or destroyed`);
				continue;
			}

			// FIX #14: Only send if state changed
			if (stats.lastSentChokeState === stats.isChoked) {
				skippedCount++;
				continue; // State hasn't changed, skip
			}

			try {
				if (stats.isChoked) {
					socket.write(buildChoke());
					chokedCount++;
					Logger.debug(`Sent CHOKE to ${peerId}`);
				} else {
					socket.write(buildUnchoke());
					unchokedCount++;
					Logger.debug(`Sent UNCHOKE to ${peerId}`);
				}
				// FIX #14: Update last sent state
				stats.lastSentChokeState = stats.isChoked;
			} catch (error) {
				console.error(`❌ Error sending message to ${peerId}: ${error}`);
			}
		}

		Logger.debug(
			`Summary: ${unchokedCount} unchoked, ${chokedCount} choked, ${skippedCount} skipped (no change)`,
		);
	}

	/**
	 * Get total upload speed (bytes/sec)
	 */
	getUploadSpeed(): number {
		let totalSpeed = 0;
		for (const stats of this.peerStats.values()) {
			totalSpeed += stats.uploadRate;
		}
		return totalSpeed;
	}

	/**
	 * Get total uploaded bytes
	 */
	getTotalUploaded(): number {
		return this.totalUploaded;
	}

	/**
	 * Register a new peer
	 */
	registerPeer(peerId: string): void {
		if (!this.peerStats.has(peerId)) {
			const now = Date.now();
			this.peerStats.set(peerId, {
				peerId,
				downloadRate: 0,
				lastDownloadTime: now,
				bytesDownloadedFromPeer: 0,
				bytesUploadedToPeer: 0,
				uploadRate: 0,
				lastUploadTime: now,
				isChoked: true,
			});

			console.error(
				`✅ Registered peer ${peerId}. Total peers: ${this.peerStats.size}`,
			);

			// CRITICAL FIX: Trigger immediate choking round when peer registers
			// This ensures new peers get evaluated and unchoked right away
			// instead of waiting up to 10 seconds for the next interval
			this.performChokingRound();

			// CRITICAL FIX: Send choke/unchoke messages immediately
			// This ensures peers receive UNCHOKE before they timeout
			if (this.allSockets) {
				console.error(
					`🔄 Sending immediate choke/unchoke messages for new peer`,
				);
				this.sendChokeMessages(this.allSockets);
			}
		}
	}

	/**
	 * Remove peer from tracking
	 */
	removePeer(peerId: string): void {
		this.peerStats.delete(peerId);
		if (this.currentOptimisticPeer === peerId) {
			this.currentOptimisticPeer = null;
		}
	}

	/**
	 * Stop upload manager
	 */
	stop(): void {
		if (this.chokingInterval) {
			clearInterval(this.chokingInterval as unknown as number);
			this.chokingInterval = null;
		}
		if (this.optimisticInterval) {
			clearInterval(this.optimisticInterval as unknown as number);
			this.optimisticInterval = null;
		}
		this.peerStats.clear();
	}
}
