import { BLOCK_LEN, blocksPerPiece, blockLen } from "../protocol/parser";
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

	constructor(torrent: Torrent) {
		this._torrent = torrent;
		this._queue = [];
		this.choked = true;
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

	deque(): PieceBlock | undefined {
		return this._queue.shift();
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
}
