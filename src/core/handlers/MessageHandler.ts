import type Pieces from "../../pieces/Pieces";
import { buildHave } from "../../protocol/messages";
import type Queue from "../../queue/Queue";
import type { Torrent } from "../../types/index";
import type { EndgameManager, ExtendedSocket } from "../modules/EndgameManager";
import type { FileWriter } from "../modules/FileWriter";
import type { UploadManager } from "../modules/UploadManager";

// Helper to create unique block identifier
function blockId(block: { index: number; begin: number }): string {
	return `${block.index}:${block.begin}`;
}

/**
 * MessageHandler processes BitTorrent protocol messages
 */
export class MessageHandler {
	private totalDownloaded = 0;
	private totalPieces: number;

	// Constants for message IDs
	private readonly MSG_CHOKE = 0;
	private readonly MSG_UNCHOKE = 1;
	private readonly MSG_HAVE = 4;
	private readonly MSG_BITFIELD = 5;
	private readonly MSG_REQUEST = 6;
	private readonly MSG_PIECE = 7;
	private readonly MSG_LENGTH_BYTES = 4;
	private readonly MSG_ID_BYTES = 1;
	private readonly MSG_INDEX_OFFSET = 1;
	private readonly MSG_BEGIN_OFFSET = 5;
	private readonly MSG_LENGTH_OFFSET = 9;
	private readonly HASH_LENGTH = 20;
	private readonly REQUEST_ARGS_COUNT = 3;
	private readonly EMA_ALPHA = 0.3;
	private readonly EMA_DECAY = 0.7;
	private readonly RTT_FAST_THRESHOLD = 300;
	private readonly RTT_SLOW_THRESHOLD = 800;
	private readonly MAX_PIPELINE = 100;
	private readonly MIN_PIPELINE = 8;
	private readonly MS_PER_SEC = 1000;
	private readonly BITS_PER_BYTE = 8;

	constructor(
		torrent: Torrent,
		private fileWriter: FileWriter,
		private endgameManager: EndgameManager,
		private uploadManager: UploadManager,
	) {
		this.totalPieces = torrent.info.pieces.length / this.HASH_LENGTH;
	}

	/**
	 * Process messages from buffer
	 */
	processMessages(
		socket: ExtendedSocket,
		buffer: Buffer,
		pieces: Pieces,
		queue: Queue,
		allSockets: Map<string, ExtendedSocket>,
		requestMorePieces?: (socket: ExtendedSocket) => void,
	): number {
		let offset = 0;

		while (offset + this.MSG_LENGTH_BYTES <= buffer.length) {
			const messageLength = buffer.readUInt32BE(offset);

			if (messageLength === 0) {
				// Keep-alive
				offset += this.MSG_LENGTH_BYTES;
				continue;
			}

			if (offset + this.MSG_LENGTH_BYTES + messageLength > buffer.length) {
				// Incomplete message, wait for more data
				break;
			}

			const messageId = buffer[offset + this.MSG_LENGTH_BYTES];
			if (messageId === undefined) break; // Safety check
			const messageData = buffer.slice(
				offset + this.MSG_LENGTH_BYTES,
				offset + this.MSG_LENGTH_BYTES + messageLength,
			);

			try {
				this.handleMessage(
					socket,
					messageId,
					messageData,
					pieces,
					queue,
					allSockets,
					requestMorePieces,
				);
			} catch (_error) {
				// Silently ignore message processing errors
			}

			offset += this.MSG_LENGTH_BYTES + messageLength;
		}

		return offset; // Return number of bytes consumed
	}

	/**
	 * Handle individual message by type
	 */
	private handleMessage(
		socket: ExtendedSocket,
		messageId: number,
		data: Buffer,
		pieces: Pieces,
		queue: Queue,
		allSockets: Map<string, ExtendedSocket>,
		requestMorePieces?: (socket: ExtendedSocket) => void,
	): void {
		switch (messageId) {
			case this.MSG_CHOKE: // choke
				socket.choked = true;
				socket.pendingRequests = 0;
				break;

			case this.MSG_UNCHOKE: // unchoke
				socket.choked = false;
				break;

			case this.MSG_HAVE: // have
				if (data.length >= this.MSG_ID_BYTES + this.MSG_LENGTH_BYTES) {
					const pieceIndex = data.readUInt32BE(this.MSG_INDEX_OFFSET);
					if (!socket.availablePieces) socket.availablePieces = new Set();
					socket.availablePieces.add(pieceIndex);
					if (socket.peerId) {
						queue.updatePeerPieces(socket.peerId, socket.availablePieces);
					}
				}
				break;

			case this.MSG_BITFIELD: // bitfield
				socket.bitfield = data.slice(this.MSG_ID_BYTES);
				socket.availablePieces = this.parseBitfield(socket.bitfield);
				if (socket.peerId) {
					queue.updatePeerPieces(socket.peerId, socket.availablePieces);
				}
				break;

			case this.MSG_REQUEST: // request
				if (
					data.length >=
					this.MSG_ID_BYTES + this.MSG_LENGTH_BYTES * this.REQUEST_ARGS_COUNT
				) {
					const request = {
						index: data.readUInt32BE(this.MSG_INDEX_OFFSET),
						begin: data.readUInt32BE(this.MSG_BEGIN_OFFSET),
						length: data.readUInt32BE(this.MSG_LENGTH_OFFSET),
					};
					this.uploadManager.handlePeerRequest(socket, request);
				}
				break;

			case this.MSG_PIECE: // piece
				this.handlePiece(socket, data, pieces, allSockets, requestMorePieces);
				break;
		}
	}

	/**
	 * Handle piece data
	 */
	private async handlePiece(
		socket: ExtendedSocket,
		data: Buffer,
		pieces: Pieces,
		allSockets: Map<string, ExtendedSocket>,
		requestMorePieces?: (socket: ExtendedSocket) => void,
	): Promise<void> {
		const pieceIndex = data.readUInt32BE(this.MSG_INDEX_OFFSET);
		const begin = data.readUInt32BE(this.MSG_BEGIN_OFFSET);
		const block = data.slice(this.MSG_LENGTH_OFFSET);

		const blockKey = blockId({ index: pieceIndex, begin });

		// Fix 2: Measure RTT for adaptive pipelining
		const now = Date.now();
		if (socket.requestTimestamps?.has(blockKey)) {
			const requestTime = socket.requestTimestamps.get(blockKey);
			if (requestTime === undefined) return;
			const rtt = now - requestTime;

			// Update rolling latency (exponential moving average, alpha = 0.3)
			if (socket.rollingLatency === undefined) {
				socket.rollingLatency = rtt;
			} else {
				socket.rollingLatency =
					socket.rollingLatency * this.EMA_DECAY + rtt * this.EMA_ALPHA;
			}

			// Adaptive pipeline scaling based on RTT
			if (!socket.maxPipeline) socket.maxPipeline = 10; // Initialize

			if (rtt < this.RTT_FAST_THRESHOLD) {
				// Fast peer - increase pipeline (cap at 50)
				socket.maxPipeline = Math.min(
					this.MAX_PIPELINE,
					socket.maxPipeline + 1,
				);
			} else if (rtt > this.RTT_SLOW_THRESHOLD) {
				// Slow peer - decrease pipeline (floor at 2)
				socket.maxPipeline = Math.max(
					this.MIN_PIPELINE,
					socket.maxPipeline - 1,
				);
			}

			// Clean up timestamp
			socket.requestTimestamps.delete(blockKey);
		}

		// Remove from active requests
		if (socket.activeRequests) {
			socket.activeRequests.delete(blockKey);
			socket.pendingRequests = Math.max(0, (socket.pendingRequests ?? 0) - 1);
		}

		// Send CANCEL to other peers in endgame mode
		if (this.endgameManager.isInEndgame()) {
			this.endgameManager.sendCancelMessages(
				socket,
				blockKey,
				{ index: pieceIndex, begin, length: block.length },
				allSockets,
			);
		}

		// Add to pieces
		pieces.addReceived({
			index: pieceIndex,
			begin,
			block,
			length: block.length,
		});

		// 🔒 SECURITY FIX: Check if piece is complete and verify hash
		// The broadcastHave() will be called automatically via callback AFTER verification
		// This prevents "swarm poisoning" by ensuring we never advertise corrupt data
		pieces.isPieceDone(pieceIndex);

		// Write to disk
		await this.fileWriter.writeBlock(pieceIndex, begin, block);

		// Update download counter
		this.totalDownloaded += block.length;

		// Track peer download rate for tit-for-tat
		if (socket.peerId) {
			this.uploadManager.trackPeerDownloadRate(socket.peerId, block.length);
		}

		// Update peer stats - use 1-second rolling window for accurate speed
		socket.downloaded = (socket.downloaded ?? 0) + block.length;

		// Initialize speed tracking if not present
		if (!socket.speedWindowStart) {
			socket.speedWindowStart = now;
			socket.speedWindowBytes = 0;
		}

		// Add bytes to current window
		socket.speedWindowBytes = (socket.speedWindowBytes ?? 0) + block.length;

		// Calculate speed over 1-second window
		const windowDuration = (now - socket.speedWindowStart) / this.MS_PER_SEC;
		if (windowDuration >= 1.0) {
			// We have at least 1 second of data - calculate speed
			socket.speed = socket.speedWindowBytes / windowDuration;
			// Reset window
			socket.speedWindowStart = now;
			socket.speedWindowBytes = 0;
		} else if (!socket.speed) {
			// First block - set initial speed estimate
			socket.speed = 0;
		}

		// Fix 3: Aggressively request multiple batches to eliminate stop-and-wait
		if (requestMorePieces && !socket.choked && !socket.destroyed) {
			for (let i = 0; i < 5; i++) {
				requestMorePieces(socket);
			}
		}
	}

	/**
	 * Broadcast HAVE message to all connected peers
	 * 🔒 SECURITY: Only call this AFTER piece has been SHA1-verified
	 */
	broadcastHave(
		pieceIndex: number,
		allSockets: Map<string, ExtendedSocket>,
	): void {
		const haveMessage = buildHave(pieceIndex);
		allSockets.forEach((socket) => {
			if (!socket.destroyed && socket.writable) {
				try {
					socket.write(haveMessage);
				} catch (_error) {
					// Silently ignore write errors
				}
			}
		});
	}

	/**
	 * Parse bitfield into set of piece indices
	 */
	private parseBitfield(bitfield: Buffer): Set<number> {
		const pieces = new Set<number>();
		for (let i = 0; i < bitfield.length; i++) {
			const byte = bitfield[i];
			if (byte === undefined) continue;
			for (let bit = 0; bit < this.BITS_PER_BYTE; bit++) {
				const pieceIndex = i * this.BITS_PER_BYTE + bit;
				if (pieceIndex >= this.totalPieces) break;
				if (byte & (1 << (this.BITS_PER_BYTE - 1 - bit))) {
					pieces.add(pieceIndex);
				}
			}
		}
		return pieces;
	}

	/**
	 * Get total downloaded bytes
	 */
	getTotalDownloaded(): number {
		return this.totalDownloaded;
	}
}
