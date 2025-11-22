import { BLOCK_LEN, blocksPerPiece } from "./parser";
import type { Torrent } from "../types";
import type { PieceBlock } from "./queue";
import type { PiecePayload } from "./messages"; // Import PiecePayload

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
      const arr: boolean[][] = new Array(nPieces).fill(null).map((_, i) =>
        new Array(blocksPerPiece(torrent, i)).fill(false)
      );
      return arr;
    };

    this._requested = buildPiecesArray();
    this._received = buildPiecesArray();
  }

  addRequested(pieceBlock: PieceBlock): void {
    const blockIndex = pieceBlock.begin / BLOCK_LEN;
    if (pieceBlock.index < this._requested.length && this._requested[pieceBlock.index] !== undefined) {
      this._requested[pieceBlock.index]![blockIndex] = true;
    } else {
      console.warn(`Attempted to addRequested for out-of-bounds piece index: ${pieceBlock.index}`);
    }
  }

  addReceived(piecePayload: PiecePayload): void {
    // PiecePayload has index and begin, which is what addReceived needs
    const blockIndex = piecePayload.begin / BLOCK_LEN;
    if (piecePayload.index < this._received.length && this._received[piecePayload.index] !== undefined) {
      this._received[piecePayload.index]![blockIndex] = true;
    } else {
      console.warn(`Attempted to addReceived for out-of-bounds piece index: ${piecePayload.index}`);
    }
  }

  needed(pieceBlock: PieceBlock): boolean {
    if (this._requested.every((blocks) => blocks.every((i) => i))) {
      // If all blocks have been requested, reset _requested to _received to allow re-requesting
      this._requested = this._received.map((blocks) => blocks.slice());
    }
    const blockIndex = pieceBlock.begin / BLOCK_LEN;
    if (pieceBlock.index < this._requested.length && this._requested[pieceBlock.index] !== undefined) {
      return !this._requested[pieceBlock.index]![blockIndex];
    }
    // If piece index is out of bounds, assume it's needed (and log a warning)
    console.warn(`Attempted to check 'needed' for out-of-bounds piece index: ${pieceBlock.index}. Assuming needed.`);
    return true;
  }

  isDone(): boolean {
    return this._received.every((blocks) => blocks.every((i) => i));
  }
}
