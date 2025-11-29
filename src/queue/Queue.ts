import { BLOCK_LEN, blockLen, blocksPerPiece } from "../protocol/parser";
import type { Torrent } from "../types/index";

export type PieceBlock = {
	index: number;
	begin: number;
	length: number;
};

export default class Queue {
	_torrent: Torrent;
	_queue: PieceBlock[];
	choked: boolean;

	// Rarest-first tracking
	private _pieceFrequency: Map<number, number>; // piece index -> peer count
	private _peerPieces: Map<string, Set<number>>; // peer ID -> pieces they have

	constructor(torrent: Torrent) {
		this._torrent = torrent;
		this._queue = [];
		this.choked = true;
		this._pieceFrequency = new Map();
		this._peerPieces = new Map();
	}

	queue(pieceIndex: number): void {
		const nBlocks = blocksPerPiece(this._torrent, pieceIndex);
		for (let i = 0; i < nBlocks; i++) {
			const pieceBlock: PieceBlock = {
				index: pieceIndex,
				begin: i * BLOCK_LEN,
				length: blockLen(this._torrent, pieceIndex, i),
			};
			this._queue.push(pieceBlock);
		}
	}

	/**
	 * Dequeue with rarest-first selection
	 * @param peerPieces - Optional set of piece indices the peer has
	 * @returns Next block to request, or undefined if none available
	 */
	deque(peerPieces?: Set<number>): PieceBlock | undefined {
		if (this._queue.length === 0) return undefined;

		// If no peer pieces provided, use simple FIFO (backward compatible)
		if (!peerPieces || peerPieces.size === 0) {
			return this._queue.shift();
		}

		// Find rarest piece that peer has
		let rarestPiece: number | null = null;
		let minFrequency = Infinity;

		// Get unique piece indices from queue
		const queuedPieces = new Set(this._queue.map((b) => b.index));

		for (const pieceIndex of queuedPieces) {
			if (peerPieces.has(pieceIndex)) {
				const frequency = this._pieceFrequency.get(pieceIndex) || 0;
				if (frequency < minFrequency) {
					minFrequency = frequency;
					rarestPiece = pieceIndex;
				}
			}
		}

		// If found rarest piece, return first block from it
		if (rarestPiece !== null) {
			const blockIndex = this._queue.findIndex((b) => b.index === rarestPiece);
			if (blockIndex !== -1) {
				return this._queue.splice(blockIndex, 1)[0];
			}
		}

		// Fallback: return any block peer has
		const blockIndex = this._queue.findIndex((b) => peerPieces.has(b.index));
		if (blockIndex !== -1) {
			return this._queue.splice(blockIndex, 1)[0];
		}

		return undefined;
	}

	peek(): PieceBlock | undefined {
		return this._queue[0];
	}

	length(): number {
		return this._queue.length;
	}

	// Add block to FRONT of queue (high priority for retries)
	queueFront(pieceBlock: PieceBlock): void {
		this._queue.unshift(pieceBlock);
	}

	// Add single block to queue
	queueBlock(pieceBlock: PieceBlock): void {
		this._queue.push(pieceBlock);
	}

	/**
	 * Update piece availability for a peer (for rarest-first)
	 * @param peerId - Unique peer identifier
	 * @param pieces - Set of piece indices the peer has
	 */
	updatePeerPieces(peerId: string, pieces: Set<number>): void {
		// Remove old pieces for this peer from frequency count
		const oldPieces = this._peerPieces.get(peerId);
		if (oldPieces) {
			oldPieces.forEach((p) => {
				const count = this._pieceFrequency.get(p) || 0;
				this._pieceFrequency.set(p, Math.max(0, count - 1));
			});
		}

		// Add new pieces to frequency count
		this._peerPieces.set(peerId, pieces);
		pieces.forEach((p) => {
			const count = this._pieceFrequency.get(p) || 0;
			this._pieceFrequency.set(p, count + 1);
		});
	}

	/**
	 * Remove peer from tracking (when peer disconnects)
	 * @param peerId - Unique peer identifier
	 */
	removePeer(peerId: string): void {
		const pieces = this._peerPieces.get(peerId);
		if (pieces) {
			pieces.forEach((p) => {
				const count = this._pieceFrequency.get(p) || 0;
				this._pieceFrequency.set(p, Math.max(0, count - 1));
			});
			this._peerPieces.delete(peerId);
		}
	}

	/**
	 * Mark piece as complete (remove from frequency tracking)
	 * @param pieceIndex - Index of completed piece
	 */
	completePiece(pieceIndex: number): void {
		this._pieceFrequency.delete(pieceIndex);
	}

	/**
	 * Get piece frequency for debugging
	 * @param pieceIndex - Index of piece
	 * @returns Number of peers that have this piece
	 */
	getPieceFrequency(pieceIndex: number): number {
		return this._pieceFrequency.get(pieceIndex) || 0;
	}
}
