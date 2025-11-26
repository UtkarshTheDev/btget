import bencode from "bencode";
import crypto from "crypto";
import fs from "fs";
import type { Torrent, Info } from "../types/index";

export function open(filepath: string): Torrent {
	const fileData = fs.readFileSync(filepath);

	const decodedData = bencode.decode(fileData);

	// Convert announce to string if it's a buffer or Uint8Array
	if (decodedData.announce && typeof decodedData.announce !== "string") {
		decodedData.announce = Buffer.from(decodedData.announce).toString("utf8");
	}

	if (decodedData["announce-list"]) {
		decodedData["announce-list"] = decodedData["announce-list"].map(
			(tier: any) => {
				return tier.map((url: any) => {
					if (Buffer.isBuffer(url) || url instanceof Uint8Array) {
						return Buffer.from(url).toString("utf8");
					}
					return url;
				});
			},
		);
	}

	// Ensure info.name is properly converted to Buffer for consistent handling
	if (decodedData.info && decodedData.info.name) {
		if (!Buffer.isBuffer(decodedData.info.name)) {
			decodedData.info.name = Buffer.from(decodedData.info.name);
		}
	}

	// Fix file path encoding for multi-file torrents
	if (decodedData.info && decodedData.info.files) {
		decodedData.info.files = decodedData.info.files.map((file: any) => {
			if (file.path) {
				// Convert path components to proper UTF-8 strings
				file.path = file.path.map((pathComponent: any) => {
					if (Buffer.isBuffer(pathComponent)) {
						return pathComponent;
					}
					return Buffer.from(pathComponent, "utf8");
				});
			}
			return file;
		});
	}

	// Assuming decodedData has the structure of a Torrent
	// This might need more robust validation
	return decodedData as Torrent;
}

export function size(torrent: Torrent): bigint {
	const info = torrent.info as Info;
	if (info.files && Array.isArray(info.files)) {
		// Multi-file torrent
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
	return crypto.createHash("sha1").update(info).digest();
}

export const BLOCK_LEN = 2 ** 14; // 16384 bytes

export function pieceLen(torrent: Torrent, pieceIndex: number): number {
	const totalLength = size(torrent);
	const pieceLength = BigInt(torrent.info["piece length"]);

	const lastPieceLength = totalLength % pieceLength;
	const lastPieceIndex = Number(totalLength / pieceLength);

	return pieceIndex === lastPieceIndex && lastPieceLength !== BigInt(0)
		? Number(lastPieceLength)
		: Number(pieceLength);
}

export function blocksPerPiece(torrent: Torrent, pieceIndex: number): number {
	const pieceLength = pieceLen(torrent, pieceIndex);
	return Math.ceil(pieceLength / BLOCK_LEN);
}

export function blockLen(
	torrent: Torrent,
	pieceIndex: number,
	blockIndex: number,
): number {
	const pieceLength = pieceLen(torrent, pieceIndex);

	// CRITICAL FIX: Subtract 1 to get correct last block index
	const lastBlockIndex = Math.floor((pieceLength - 1) / BLOCK_LEN);
	const lastBlockLength = pieceLength - lastBlockIndex * BLOCK_LEN;

	return blockIndex === lastBlockIndex ? lastBlockLength : BLOCK_LEN;
}
