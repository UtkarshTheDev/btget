import { BLOCK_LEN, blocksPerPiece } from "../protocol/parser";
import type { Torrent } from "../types/index";
import type { PieceBlock } from "../queue/Queue";
import type { PiecePayload } from "../protocol/messages"; // Import PiecePayload

export default class Pieces {
	_requested: boolean[][];
	_received: boolean[][];
	_torrent: Torrent;

	constructor(torrent: Torrent) {
		this._torrent = torrent;
		const buildPiecesArray = (): boolean[][] => {
			// Ensure torrent.info.pieces is a Buffer and has a length
			const nPieces = torrent.info.pieces ? torrent.info.pieces.length / 20 : 0;
			if (nPieces === 0) return []; // Return empty array if no pieces

			// Initialize with empty arrays to avoid undefined issues if piece index is out of bounds
			const arr: boolean[][] = new Array(nPieces)
				.fill(null)
				.map((_, i) => new Array(blocksPerPiece(torrent, i)).fill(false));
			return arr;
		};

		this._requested = buildPiecesArray();
		this._received = buildPiecesArray();
	}

	addRequested(pieceBlock: PieceBlock): void {
		// Validate piece index first
		if (
			typeof pieceBlock.index !== "number" ||
			pieceBlock.index < 0 ||
			pieceBlock.index >= this._requested.length
		) {
			return; // Silently ignore invalid indices
		}

		const blockIndex = Math.floor(pieceBlock.begin / BLOCK_LEN);
		const piece = this._requested[pieceBlock.index];
		if (piece && blockIndex >= 0 && blockIndex < piece.length) {
			piece[blockIndex] = true;
		}
	}

	addReceived(piecePayload: PiecePayload): void {
		// Validate piece index
		if (piecePayload.index < 0 || piecePayload.index >= this._received.length) {
			return; // Silently ignore invalid indices
		}

		const blockIndex = Math.floor(piecePayload.begin / BLOCK_LEN);
		const piece = this._received[piecePayload.index];
		if (piece && blockIndex >= 0 && blockIndex < piece.length) {
			piece[blockIndex] = true;
		}
	}

	needed(pieceBlock: PieceBlock): boolean {
		// Validate piece index first
		if (
			typeof pieceBlock.index !== "number" ||
			pieceBlock.index < 0 ||
			pieceBlock.index >= this._requested.length
		) {
			return false; // Invalid piece index means not needed
		}

		const blockIndex = Math.floor(pieceBlock.begin / BLOCK_LEN);

		// Check if this specific block is needed
		const requestedPiece = this._requested[pieceBlock.index];
		const receivedPiece = this._received[pieceBlock.index];
		if (
			requestedPiece &&
			receivedPiece &&
			blockIndex >= 0 &&
			blockIndex < requestedPiece.length
		) {
			// Block is needed if not yet received
			return !receivedPiece[blockIndex];
		}

		return false; // Invalid block index means not needed
	}

	isDone(): boolean {
		return this._received.every((blocks) => blocks.every((i) => i));
	}

	// Get completion percentage
	getProgress(): number {
		let totalBlocks = 0;
		let receivedBlocks = 0;

		for (const blocks of this._received) {
			totalBlocks += blocks.length;
			receivedBlocks += blocks.filter((b) => b).length;
		}

		return totalBlocks > 0 ? (receivedBlocks / totalBlocks) * 100 : 0;
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
