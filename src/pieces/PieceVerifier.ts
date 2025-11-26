import crypto from 'crypto';
import type { Torrent } from '../types/index';

export class PieceVerifier {
  private torrent: Torrent;
  private verifiedPieces: Set<number>;

  constructor(torrent: Torrent) {
    this.torrent = torrent;
    this.verifiedPieces = new Set();
  }

  /**
   * Verify a piece against its SHA-1 hash
   */
  verify(pieceIndex: number, pieceData: Buffer): boolean {
    try {
      const expectedHash = this.getPieceHash(pieceIndex);
      const actualHash = crypto.createHash('sha1').update(pieceData).digest();
      
      // Ensure both are Buffers for comparison
      const expectedBuffer = Buffer.isBuffer(expectedHash) ? expectedHash : Buffer.from(expectedHash);
      const actualBuffer = Buffer.isBuffer(actualHash) ? actualHash : Buffer.from(actualHash);
      
      const isValid = expectedBuffer.equals(actualBuffer);
      if (isValid) {
        this.verifiedPieces.add(pieceIndex);
      }
      
      return isValid;
    } catch (error) {
      console.error(`Verification error for piece ${pieceIndex}:`, error);
      return false;
    }
  }

  /**
   * Get the expected SHA-1 hash for a piece
   */
  private getPieceHash(pieceIndex: number): Buffer {
    const start = pieceIndex * 20;
    const end = start + 20;
    return this.torrent.info.pieces.slice(start, end);
  }

  /**
   * Check if a piece has been verified
   */
  isVerified(pieceIndex: number): boolean {
    return this.verifiedPieces.has(pieceIndex);
  }

  /**
   * Get the total number of verified pieces
   */
  getVerifiedCount(): number {
    return this.verifiedPieces.size;
  }

  /**
   * Get the total number of pieces
   */
  getTotalPieces(): number {
    return this.torrent.info.pieces.length / 20;
  }

  /**
   * Check if all pieces are verified
   */
  isComplete(): boolean {
    return this.verifiedPieces.size === this.getTotalPieces();
  }
}