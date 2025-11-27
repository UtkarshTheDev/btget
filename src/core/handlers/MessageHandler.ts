import type Pieces from "../../pieces/Pieces";
import type Queue from "../../queue/Queue";
import type { Torrent } from "../../types/index";
import { FileWriter } from "../modules/FileWriter";
import { EndgameManager, type ExtendedSocket } from "../modules/EndgameManager";
import { UploadManager } from "../modules/UploadManager";
import { buildHave } from "../../protocol/messages";

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

	constructor(
		private torrent: Torrent,
		private fileWriter: FileWriter,
		private endgameManager: EndgameManager,
		private uploadManager: UploadManager,
	) {
		this.totalPieces = torrent.info.pieces.length / 20;
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
			if (messageId === undefined) break; // Safety check
			const messageData = buffer.slice(offset + 4, offset + 4 + messageLength);

			try {
				this.handleMessage(
					socket,
					messageId,
					messageData,
					pieces,
					queue,
					allSockets,
				);
			} catch (error) {
				// Silently ignore message processing errors
			}

			offset += 4 + messageLength;
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
	): void {
		switch (messageId) {
			case 0: // choke
				socket.choked = true;
				socket.pendingRequests = 0;
				break;

			case 1: // unchoke
				socket.choked = false;
				break;

			case 4: // have
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
				socket.availablePieces = this.parseBitfield(socket.bitfield);
				if (socket.peerId) {
					queue.updatePeerPieces(socket.peerId, socket.availablePieces);
				}
				break;

			case 6: // request
				if (data.length >= 13) {
					const request = {
						index: data.readUInt32BE(1),
						begin: data.readUInt32BE(5),
						length: data.readUInt32BE(9),
					};
					this.uploadManager.handlePeerRequest(socket, request);
				}
				break;

			case 7: // piece
				this.handlePiece(socket, data, pieces, allSockets);
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
	): Promise<void> {
		const pieceIndex = data.readUInt32BE(1);
		const begin = data.readUInt32BE(5);
		const block = data.slice(9);

		const blockKey = blockId({ index: pieceIndex, begin });

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

		// Check if piece is complete and broadcast HAVE
		if (pieces.isPieceDone(pieceIndex)) {
			this.broadcastHave(pieceIndex, allSockets);
		}

		// Write to disk
		await this.fileWriter.writeBlock(pieceIndex, begin, block);

		// Update download counter
		this.totalDownloaded += block.length;

		// Track peer download rate for tit-for-tat
		if (socket.peerId) {
			this.uploadManager.trackPeerDownloadRate(socket.peerId, block.length);
		}

		// Update peer stats
		socket.downloaded = (socket.downloaded ?? 0) + block.length;
		const now = Date.now();
		const duration = (now - (socket.lastMeasureTime ?? now)) / 1000;
		if (duration > 0) {
			// Simple speed calculation (bytes/sec) - exponential moving average could be better but this is simple
			const currentSpeed = block.length / duration;
			socket.speed = currentSpeed; // For now just instantaneous speed of this block
			socket.lastMeasureTime = now;
		} else {
			socket.lastMeasureTime = now;
		}
	}

	/**
	 * Broadcast HAVE message to all connected peers
	 */
	private broadcastHave(
		pieceIndex: number,
		allSockets: Map<string, ExtendedSocket>,
	): void {
		const haveMessage = buildHave(pieceIndex);
		allSockets.forEach((socket) => {
			if (!socket.destroyed && socket.writable) {
				try {
					socket.write(haveMessage);
				} catch (error) {
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
			for (let bit = 0; bit < 8; bit++) {
				const pieceIndex = i * 8 + bit;
				if (pieceIndex >= this.totalPieces) break;
				if (byte & (1 << (7 - bit))) {
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
