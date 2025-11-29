import * as crypto from "node:crypto";
import type { Torrent } from "../types/index";

interface PieceBuffer {
	index: number;
	length: number;
	hash: Buffer;
	blocks: Map<number, Buffer>; // offset -> data
	receivedBytes: number;
	requested: Set<number>; // Track requested block offsets
}

export class PieceAssembler {
	private pieces: Map<number, PieceBuffer> = new Map();
	public completedPieces: Set<number> = new Set();
	public totalPieces: number;
	private pieceLength: number;
	private totalLength: bigint;

	private readonly HASH_LENGTH = 20;
	private readonly PERCENTAGE_MULTIPLIER = 100;
	private readonly ENDGAME_THRESHOLD = 95;

	constructor(private torrent: Torrent) {
		const pieceHashes = this.extractPieceHashes(this.torrent.info.pieces);
		this.totalPieces = pieceHashes.length;
		this.pieceLength = this.torrent.info["piece length"] as number;
		this.totalLength = this.calculateTotalLength(this.torrent);

		// Initialize piece buffers
		pieceHashes.forEach((hash, index) => {
			const length = this.calculatePieceSize(index);
			this.pieces.set(index, {
				index,
				length,
				hash,
				blocks: new Map(),
				receivedBytes: 0,
				requested: new Set(),
			});
		});

		console.log(
			`🧩 Initialized ${this.totalPieces} pieces (${this.pieceLength} bytes each, last: ${this.calculatePieceSize(this.totalPieces - 1)} bytes)`,
		);
	}

	/**
	 * Extract individual piece hashes from the pieces buffer
	 */
	private extractPieceHashes(piecesBuffer: Buffer): Buffer[] {
		const hashes: Buffer[] = [];
		for (let i = 0; i < piecesBuffer.length; i += this.HASH_LENGTH) {
			hashes.push(piecesBuffer.slice(i, i + this.HASH_LENGTH));
		}
		return hashes;
	}

	/**
	 * Calculate total torrent length
	 */
	private calculateTotalLength(torrent: Torrent): bigint {
		if (torrent.info.files) {
			return torrent.info.files.reduce(
				(sum, file) => sum + BigInt(file.length),
				BigInt(0),
			);
		} else {
			return BigInt(torrent.info.length || 0);
		}
	}

	/**
	 * Calculate actual piece size (last piece may be smaller)
	 */
	private calculatePieceSize(index: number): number {
		if (index === this.totalPieces - 1) {
			const lastPieceSize = Number(this.totalLength % BigInt(this.pieceLength));
			return lastPieceSize === 0 ? this.pieceLength : lastPieceSize;
		}
		return this.pieceLength;
	}

	/**
	 * Mark a block as requested
	 */
	markRequested(pieceIndex: number, begin: number): void {
		const piece = this.pieces.get(pieceIndex);
		if (piece && !this.completedPieces.has(pieceIndex)) {
			piece.requested.add(begin);
		}
	}

	/**
	 * Add a received block to the piece buffer
	 */
	addBlock(pieceIndex: number, begin: number, data: Buffer): boolean {
		const piece = this.pieces.get(pieceIndex);
		if (!piece || this.completedPieces.has(pieceIndex)) {
			return false; // Piece already complete or invalid
		}

		// Remove from requested set
		piece.requested.delete(begin);

		// Check if block already received (duplicate)
		if (piece.blocks.has(begin)) {
			return false;
		}

		// Add block
		piece.blocks.set(begin, data);
		piece.receivedBytes += data.length;

		// Check if piece is complete
		if (piece.receivedBytes >= piece.length) {
			return this.verifyAndCompletePiece(pieceIndex);
		}

		return false;
	}

	/**
	 * Verify piece hash and mark as complete
	 */
	private verifyAndCompletePiece(pieceIndex: number): boolean {
		const piece = this.pieces.get(pieceIndex);
		if (!piece) return false;

		// Assemble complete piece from blocks
		const pieceData = this.assembleBlocks(piece);

		if (pieceData.length !== piece.length) {
			console.error(
				`❌ Piece ${pieceIndex}: size mismatch (got ${pieceData.length}, expected ${piece.length})`,
			);
			// Clear blocks to re-download
			piece.blocks.clear();
			piece.receivedBytes = 0;
			return false;
		}

		// Verify SHA-1 hash
		const hash = crypto.createHash("sha1").update(pieceData).digest();
		if (!hash.equals(piece.hash)) {
			console.error(`❌ Piece ${pieceIndex}: hash verification failed`);
			// Clear blocks to re-download
			piece.blocks.clear();
			piece.receivedBytes = 0;
			return false;
		}

		// Mark as complete
		this.completedPieces.add(pieceIndex);
		console.log(
			`✅ Piece ${pieceIndex} verified and completed (${piece.length} bytes)`,
		);
		return true;
	}

	/**
	 * Assemble blocks into complete piece buffer
	 */
	private assembleBlocks(piece: PieceBuffer): Buffer {
		// Sort blocks by offset
		const offsets = Array.from(piece.blocks.keys()).sort((a, b) => a - b);

		// Create buffer and copy blocks in order
		const pieceBuffer = Buffer.alloc(piece.length);

		for (const offset of offsets) {
			const blockData = piece.blocks.get(offset) || Buffer.alloc(0);
			blockData.copy(pieceBuffer, offset, 0, blockData.length);
		}

		return pieceBuffer;
	}

	/**
	 * Get assembled piece data for writing to disk
	 */
	getPieceData(pieceIndex: number): Buffer | null {
		if (!this.completedPieces.has(pieceIndex)) {
			return null;
		}

		const piece = this.pieces.get(pieceIndex);
		if (!piece) return null;

		return this.assembleBlocks(piece);
	}

	/**
	 * Get pieces that need blocks (for endgame mode)
	 */
	getIncompletePieces(): number[] {
		return Array.from(this.pieces.keys()).filter(
			(index) => !this.completedPieces.has(index),
		);
	}

	/**
	 * Get missing blocks for a piece (for endgame mode)
	 */
	getMissingBlocks(
		pieceIndex: number,
		blockSize: number = 16384,
	): Array<{ begin: number; length: number }> {
		const piece = this.pieces.get(pieceIndex);
		if (!piece || this.completedPieces.has(pieceIndex)) {
			return [];
		}

		const missingBlocks: Array<{ begin: number; length: number }> = [];
		let offset = 0;

		while (offset < piece.length) {
			if (!piece.blocks.has(offset) && !piece.requested.has(offset)) {
				const length = Math.min(blockSize, piece.length - offset);
				missingBlocks.push({ begin: offset, length });
			}
			offset += blockSize;
		}

		return missingBlocks;
	}

	/**
	 * Check if all pieces are complete
	 */
	isDone(): boolean {
		return this.completedPieces.size === this.totalPieces;
	}

	/**
	 * Get completion percentage
	 */
	getProgress(): number {
		return (
			(this.completedPieces.size / this.totalPieces) *
			this.PERCENTAGE_MULTIPLIER
		);
	}

	/**
	 * Get total downloaded bytes
	 */
	getTotalDownloaded(): bigint {
		let total = BigInt(0);
		this.completedPieces.forEach((index) => {
			const piece = this.pieces.get(index);
			if (piece) {
				total += BigInt(piece.length);
			}
		});
		return total;
	}

	/**
	 * Get pieces for endgame mode (95%+ complete)
	 */
	shouldEnterEndgame(): boolean {
		return this.getProgress() >= this.ENDGAME_THRESHOLD;
	}

	/**
	 * Clear piece data after writing to disk (memory optimization)
	 */
	clearPieceData(pieceIndex: number): void {
		const piece = this.pieces.get(pieceIndex);
		if (piece && this.completedPieces.has(pieceIndex)) {
			piece.blocks.clear();
		}
	}

	/**
	 * Get statistics for monitoring
	 */
	getStats() {
		const incomplete = this.getIncompletePieces();
		const totalRequested = Array.from(this.pieces.values()).reduce(
			(sum, piece) => sum + piece.requested.size,
			0,
		);

		return {
			total: this.totalPieces,
			completed: this.completedPieces.size,
			incomplete: incomplete.length,
			totalRequested,
			progress: this.getProgress(),
			downloaded: this.getTotalDownloaded(),
		};
	}
}
