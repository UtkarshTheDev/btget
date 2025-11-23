import bencode from 'bencode';
import crypto from 'crypto';
import fs from 'fs';
import type { Torrent, Info } from '../types';

export function open(filepath: string): Torrent {
  console.log("Reading torrent file...");
  const fileData = fs.readFileSync(filepath);
  console.log("Decoding torrent file...");
  const decodedData = bencode.decode(fileData);
  console.log("Torrent file decoded.");

  // Convert announce to string if it's a buffer or Uint8Array
  if (decodedData.announce && typeof decodedData.announce !== 'string') {
    decodedData.announce = Buffer.from(decodedData.announce).toString('utf8');
  }
  
  // Ensure info.name is properly converted to Buffer for consistent handling
  if (decodedData.info && decodedData.info.name) {
    if (!Buffer.isBuffer(decodedData.info.name)) {
      decodedData.info.name = Buffer.from(decodedData.info.name);
    }
  }

  // Assuming decodedData has the structure of a Torrent
  // This might need more robust validation
  return decodedData as Torrent;
}

export function size(torrent: Torrent): bigint {
  const info = torrent.info as Info;
  if (info.files && Array.isArray(info.files)) { // Multi-file torrent
    const totalSize = info.files
      .map((file) => BigInt(file.length))
      .reduce((a, b) => a + b, BigInt(0));
    return totalSize;
  }
  // Single-file torrent
  return BigInt(info.length || 0);
}

export function infoHash(torrent: Torrent): Buffer {
  const info = bencode.encode(torrent.info);
  return crypto.createHash('sha1').update(info).digest();
}

export const BLOCK_LEN = 2 ** 14; // 16384 bytes

export function pieceLen(torrent: Torrent, pieceIndex: number): number {
  const totalLength = size(torrent);
  const pieceLength = BigInt(torrent.info['piece length']);

  const lastPieceLength = totalLength % pieceLength;
  const lastPieceIndex = totalLength / pieceLength;

  return (pieceIndex === Number(lastPieceIndex) ? Number(lastPieceLength) : Number(pieceLength));
}

export function blocksPerPiece(torrent: Torrent, pieceIndex: number): number {
  const pieceLength = pieceLen(torrent, pieceIndex);
  return Math.ceil(pieceLength / BLOCK_LEN);
}

export function blockLen(torrent: Torrent, pieceIndex: number, blockIndex: number): number {
  const pieceLength = pieceLen(torrent, pieceIndex);

  const lastPieceLength = pieceLength % BLOCK_LEN;
  const lastPieceIndex = Math.floor(pieceLength / BLOCK_LEN);

  return blockIndex === lastPieceIndex ? lastPieceLength : BLOCK_LEN;
}
