import type { RequestPayload } from "../../protocol/messages";
import { buildChoke, buildPiece, buildUnchoke } from "../../protocol/messages";
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

		try {
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
	 */
	sendChokeMessages(allSockets: Map<string, ExtendedSocket>): void {
		console.log(
			`\n🔄 Sending choke/unchoke messages to ${this.peerStats.size} peers`,
		);
		let chokedCount = 0;
		let unchokedCount = 0;

		for (const [peerId, stats] of this.peerStats.entries()) {
			const socket = allSockets.get(peerId);
			if (!socket || socket.destroyed) {
				console.log(`⚠️  Peer ${peerId} has no socket or destroyed`);
				continue;
			}

			try {
				if (stats.isChoked) {
					socket.write(buildChoke());
					chokedCount++;
					console.log(`📤 Sent CHOKE to ${peerId}`);
				} else {
					socket.write(buildUnchoke());
					unchokedCount++;
					console.log(`📤 Sent UNCHOKE to ${peerId}`);
				}
			} catch (error) {
				console.error(`❌ Error sending message to ${peerId}: ${error}`);
			}
		}

		console.log(`Summary: ${unchokedCount} unchoked, ${chokedCount} choked\n`);
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
