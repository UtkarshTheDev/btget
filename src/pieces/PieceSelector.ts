import type { Torrent } from '../types/index';

export class PieceSelector {
  private torrent: Torrent;
  private pieceFrequency: Map<number, number>;
  private availablePieces: Set<number>;
  private requestedPieces: Set<number>;
  private completedPieces: Set<number>;
  private endGameMode: boolean;
  private totalPieces: number;

  constructor(torrent: Torrent) {
    this.torrent = torrent;
    this.totalPieces = torrent.info.pieces.length / 20;
    this.pieceFrequency = new Map();
    this.availablePieces = new Set();
    this.requestedPieces = new Set();
    this.completedPieces = new Set();
    this.endGameMode = false;

    // Initialize all pieces as available
    for (let i = 0; i < this.totalPieces; i++) {
      this.pieceFrequency.set(i, 0);
      this.availablePieces.add(i);
    }
  }

  /**
   * Update piece availability from a peer's bitfield
   */
  updatePeerPieces(peerId: string, bitfield: Buffer | number[]): void {
    for (let i = 0; i < this.totalPieces; i++) {
      const hasPiece = Array.isArray(bitfield) ? 
        bitfield.includes(i) : 
        this.hasPiece(bitfield, i);
      
      if (hasPiece) {
        const current = this.pieceFrequency.get(i) || 0;
        this.pieceFrequency.set(i, current + 1);
      }
    }
  }

  /**
   * Select next piece to download using rarest-first algorithm
   */
  selectPiece(peerPieces: Set<number> | Buffer): number | null {
    // Convert Buffer to Set if needed
    const peerHasPieces = peerPieces instanceof Buffer ? 
      this.bufferToPieceSet(peerPieces) : peerPieces;

    // Filter available pieces that peer has
    const candidatePieces = Array.from(this.availablePieces)
      .filter(piece => peerHasPieces.has(piece) && !this.requestedPieces.has(piece));

    if (candidatePieces.length === 0) {
      return null;
    }

    // Check if we should enter endgame mode
    if (!this.endGameMode && this.availablePieces.size <= 10) {
      this.endGameMode = true;
      console.log('🏁 Entering endgame mode');
    }

    // In endgame mode, allow requesting any available piece
    if (this.endGameMode) {
      return candidatePieces[Math.floor(Math.random() * candidatePieces.length)];
    }

    // Rarest-first selection
    candidatePieces.sort((a, b) => {
      const freqA = this.pieceFrequency.get(a) || 0;
      const freqB = this.pieceFrequency.get(b) || 0;
      return freqA - freqB;
    });

    return candidatePieces[0];
  }

  /**
   * Mark piece as requested
   */
  requestPiece(pieceIndex: number): void {
    this.requestedPieces.add(pieceIndex);
  }

  /**
   * Mark piece as completed
   */
  completePiece(pieceIndex: number): void {
    this.availablePieces.delete(pieceIndex);
    this.requestedPieces.delete(pieceIndex);
    this.completedPieces.add(pieceIndex);
  }

  /**
   * Mark piece as failed (available for re-request)
   */
  failPiece(pieceIndex: number): void {
    this.requestedPieces.delete(pieceIndex);
    // Piece remains in availablePieces for retry
  }

  /**
   * Check if a bit is set in a bitfield buffer
   */
  private hasPiece(bitfield: Buffer, pieceIndex: number): boolean {
    const byteIndex = Math.floor(pieceIndex / 8);
    const bitIndex = pieceIndex % 8;
    
    if (byteIndex >= bitfield.length) {
      return false;
    }
    
    const byte = bitfield[byteIndex];
    return (byte & (0x80 >> bitIndex)) !== 0;
  }

  /**
   * Convert bitfield buffer to Set of piece indices
   */
  private bufferToPieceSet(bitfield: Buffer): Set<number> {
    const pieces = new Set<number>();
    for (let i = 0; i < this.totalPieces; i++) {
      if (this.hasPiece(bitfield, i)) {
        pieces.add(i);
      }
    }
    return pieces;
  }

  /**
   * Get completion percentage
   */
  getProgress(): number {
    return (this.completedPieces.size / this.totalPieces) * 100;
  }

  /**
   * Check if download is complete
   */
  isComplete(): boolean {
    return this.completedPieces.size === this.totalPieces;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      total: this.totalPieces,
      completed: this.completedPieces.size,
      requested: this.requestedPieces.size,
      available: this.availablePieces.size,
      endGameMode: this.endGameMode
    };
  }
}