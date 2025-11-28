import { BLOCK_LEN, blocksPerPiece } from "../protocol/parser";
import type { Torrent } from "../types/index";
import type { PieceBlock } from "../queue/Queue";
import type { PiecePayload } from "../protocol/messages";
import { PieceVerifier } from "./PieceVerifier";

export default class Pieces {
	_requested: boolean[][];
	_received: boolean[][];
	_torrent: Torrent;
	private _verifier: PieceVerifier; // SHA-1 hash verifier
	private _pieceBuffers: Map<number, Map<number, Buffer>>; // pieceIndex -> (blockOffset -> data)

	constructor(torrent: Torrent) {
		this._torrent = torrent;
		this._verifier = new PieceVerifier(torrent);
		this._pieceBuffers = new Map();

		const buildPiecesArray = (): boolean[][] => {
			const nPieces = torrent.info.pieces ? torrent.info.pieces.length / 20 : 0;
			if (nPieces === 0) return [];

			const arr: boolean[][] = new Array(nPieces)
				.fill(null)
				.map((_, i) => new Array(blocksPerPiece(torrent, i)).fill(false));
			return arr;
		};

		this._requested = buildPiecesArray();
		this._received = buildPiecesArray();
	}

	addRequested(pieceBlock: PieceBlock): void {
		if (
			typeof pieceBlock.index !== "number" ||
			pieceBlock.index < 0 ||
			pieceBlock.index >= this._requested.length
		) {
			return;
		}

		const blockIndex = Math.floor(pieceBlock.begin / BLOCK_LEN);
		const piece = this._requested[pieceBlock.index];
		if (piece && blockIndex >= 0 && blockIndex < piece.length) {
			piece[blockIndex] = true;
		}
	}

	addReceived(piecePayload: PiecePayload): void {
		const { index, begin, block } = piecePayload;

		// Validate piece index
		if (index < 0 || index >= this._received.length) {
			return;
		}

		// Store block data for verification
		let pieceBuffer = this._pieceBuffers.get(index);
		if (!pieceBuffer) {
			pieceBuffer = new Map();
			this._pieceBuffers.set(index, pieceBuffer);
		}

		// Duplicate block detection
		if (pieceBuffer.has(begin)) {
			return; // Already have this block, ignore duplicate
		}

		// Store block data
		pieceBuffer.set(begin, block);

		// Mark as received
		const blockIndex = Math.floor(begin / BLOCK_LEN);
		const piece = this._received[index];
		if (piece && blockIndex >= 0 && blockIndex < piece.length) {
			piece[blockIndex] = true;
		}
	}

	needed(pieceBlock: PieceBlock): boolean {
		if (
			typeof pieceBlock.index !== "number" ||
			pieceBlock.index < 0 ||
			pieceBlock.index >= this._requested.length
		) {
			return false;
		}

		const blockIndex = Math.floor(pieceBlock.begin / BLOCK_LEN);

		const requestedPiece = this._requested[pieceBlock.index];
		const receivedPiece = this._received[pieceBlock.index];
		if (
			requestedPiece &&
			receivedPiece &&
			blockIndex >= 0 &&
			blockIndex < requestedPiece.length
		) {
			return !receivedPiece[blockIndex];
		}

		return false;
	}

	/**
	 * Check if piece is complete and verify SHA-1 hash
	 */
	isPieceDone(pieceIndex: number): boolean {
		if (pieceIndex < 0 || pieceIndex >= this._received.length) return false;

		const piece = this._received[pieceIndex];
		if (!piece || !piece.every((block) => block)) return false;

		// Assemble piece from blocks
		const pieceData = this.assemblePiece(pieceIndex);
		if (!pieceData) return false;

		// Verify SHA-1 hash
		const isValid = this._verifier.verify(pieceIndex, pieceData);

		if (!isValid) {
			console.error(
				`❌ Piece ${pieceIndex} failed hash verification - re-downloading`,
			);
			this.resetPiece(pieceIndex);
			return false;
		}

		return true;
	}

	/**
	 * Assemble piece from stored blocks
	 */
	private assemblePiece(pieceIndex: number): Buffer | null {
		const pieceBuffer = this._pieceBuffers.get(pieceIndex);
		if (!pieceBuffer) return null;

		// Sort blocks by offset and concatenate
		const offsets = Array.from(pieceBuffer.keys()).sort((a, b) => a - b);
		const blocks = offsets.map((offset) => pieceBuffer.get(offset)!);

		return Buffer.concat(blocks);
	}

	/**
	 * Reset piece for re-download (after failed verification)
	 */
	private resetPiece(pieceIndex: number): void {
		// Clear buffers
		this._pieceBuffers.delete(pieceIndex);

		// Reset tracking
		if (this._received[pieceIndex]) {
			this._received[pieceIndex].fill(false);
		}
		if (this._requested[pieceIndex]) {
			this._requested[pieceIndex].fill(false);
		}
	}

	/**
	 * Get verified piece data
	 */
	getPieceData(pieceIndex: number): Buffer | null {
		if (!this._verifier.isVerified(pieceIndex)) return null;
		return this.assemblePiece(pieceIndex);
	}

	/**
	 * Clear piece data after writing to disk (memory optimization)
	 */
	clearPieceData(pieceIndex: number): void {
		this._pieceBuffers.delete(pieceIndex);
	}

	/**
	 * Get number of verified pieces
	 */
	getVerifiedCount(): number {
		return this._verifier.getVerifiedCount();
	}

	isDone(): boolean {
		// Check if all blocks received
		const allBlocksReceived = this._received.every((blocks) =>
			blocks?.every((i) => i),
		);

		if (!allBlocksReceived) return false;

		// Verify any unverified pieces
		for (let i = 0; i < this._received.length; i++) {
			if (
				!this._verifier.isVerified(i) &&
				this._received[i]?.every((block) => block)
			) {
				// Verify this piece
				this.isPieceDone(i);
			}
		}

		// Now check if all pieces verified
		return this._verifier.isComplete();
	}

	// Get completion percentage
	getProgress(): number {
		const totalPieces = this._verifier.getTotalPieces();
		const verifiedPieces = this._verifier.getVerifiedCount();
		return totalPieces > 0 ? (verifiedPieces / totalPieces) * 100 : 0;
	}

	// Remove requested status (for timeout recovery)
	removeRequested(pieceBlock: PieceBlock): void {
		if (pieceBlock.index < 0 || pieceBlock.index >= this._requested.length) {
			return;
		}

		const blockIndex = Math.floor(pieceBlock.begin / BLOCK_LEN);
		const piece = this._requested[pieceBlock.index];
		if (piece && blockIndex >= 0 && blockIndex < piece.length) {
			piece[blockIndex] = false;
		}
	}
}
