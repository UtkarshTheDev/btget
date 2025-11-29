import * as fs from "node:fs/promises";
import * as path from "node:path";
import { size } from "../../protocol/parser";
import type { File, Torrent } from "../../types/index";
import { LRUCache } from "./LRUCache";

interface FileEntry {
	handle: fs.FileHandle;
	path: string;
	offset: bigint;
	length: bigint;
}

/**
 * FileWriter handles all disk I/O operations for the BitTorrent client
 */
export class FileWriter {
	private files: FileEntry[] = [];
	private torrent: Torrent;
	// LRU cache for piece blocks (write-through caching for upload-during-download)
	// 20MB limit prevents disk thrashing while enabling immediate tit-for-tat uploads
	private pieceCache: LRUCache<string, Buffer>;

	private static readonly CACHE_MAX_ITEMS = 1000;
	// biome-ignore lint/style/noMagicNumbers: Cache size calculation
	private static readonly CACHE_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

	constructor(torrent: Torrent) {
		this.torrent = torrent;
		// Cache with 20MB limit for upload-during-download (write-through caching)
		// Capacity: large number (won't hit count limit, only size limit)
		// MaxSize: 20MB = 20 * 1024 * 1024 bytes
		this.pieceCache = new LRUCache<string, Buffer>(
			FileWriter.CACHE_MAX_ITEMS,
			FileWriter.CACHE_MAX_SIZE_BYTES,
		);
	}

	/**
	 * Initialize file handles for the torrent
	 */
	async initialize(outputDirPath: string, torrentName: string): Promise<void> {
		const isMultiFile = !!this.torrent.info.files;
		this.files = [];

		if (isMultiFile) {
			let currentOffset = BigInt(0);

			// 🔒 SECURITY: Resolve base directory to prevent path traversal
			const baseDir = path.resolve(outputDirPath, torrentName);

			for (const file of this.torrent.info.files as File[]) {
				const filePathParts = file.path.map((p: Buffer) => p.toString("utf8"));
				const fullFilePath = path.join(
					outputDirPath,
					torrentName,
					...filePathParts,
				);

				// 🔒 SECURITY: Prevent "Zip Slip" path traversal attack
				// Resolve the full path and verify it's within the base directory
				const resolvedPath = path.resolve(fullFilePath);
				if (!resolvedPath.startsWith(baseDir)) {
					throw new Error(
						`Security Error: Path traversal detected in torrent file. ` +
							`File path "${filePathParts.join("/")}" attempts to escape the output directory.`,
					);
				}

				const fileDir = path.dirname(resolvedPath);

				await fs.mkdir(fileDir, { recursive: true });
				const handle = await fs.open(resolvedPath, "w+");

				this.files.push({
					handle,
					path: resolvedPath,
					offset: currentOffset,
					length: BigInt(file.length),
				});

				currentOffset += BigInt(file.length);
			}
		} else {
			// 🔒 SECURITY: Validate single-file path as well
			const baseDir = path.resolve(outputDirPath);
			const fullFilePath = path.join(outputDirPath, torrentName);
			const resolvedPath = path.resolve(fullFilePath);

			if (!resolvedPath.startsWith(baseDir)) {
				throw new Error(
					`Security Error: Path traversal detected in torrent file. ` +
						`File name "${torrentName}" attempts to escape the output directory.`,
				);
			}

			const handle = await fs.open(resolvedPath, "w+");

			this.files.push({
				handle,
				path: resolvedPath,
				offset: BigInt(0),
				length: size(this.torrent),
			});
		}
	}

	/**
	 * Write a piece block to the appropriate file(s)
	 */
	async writeBlock(
		pieceIndex: number,
		begin: number,
		blockData: Buffer,
	): Promise<void> {
		const pieceLength = this.torrent.info["piece length"] as number;
		const globalOffset =
			BigInt(pieceIndex) * BigInt(pieceLength) + BigInt(begin);

		try {
			for (const fileEntry of this.files) {
				const fileStart = fileEntry.offset;
				const fileEnd = fileEntry.offset + fileEntry.length;

				if (
					globalOffset < fileEnd &&
					globalOffset + BigInt(blockData.length) > fileStart
				) {
					const intersectionStart =
						globalOffset > fileStart ? globalOffset : fileStart;
					const intersectionEnd =
						globalOffset + BigInt(blockData.length) < fileEnd
							? globalOffset + BigInt(blockData.length)
							: fileEnd;

					if (intersectionStart < intersectionEnd) {
						const fileOffsetStart = Number(intersectionStart - fileStart);
						const blockOffsetStart = Number(intersectionStart - globalOffset);
						const length = Number(intersectionEnd - intersectionStart);

						const dataToWrite = blockData.slice(
							blockOffsetStart,
							blockOffsetStart + length,
						);

						await fileEntry.handle.write(
							dataToWrite,
							0,
							length,
							fileOffsetStart,
						);
					}
				}
			}

			// CRITICAL: Cache block immediately after write (write-through caching)
			// This enables uploads during active download for tit-for-tat
			const cacheKey = `${pieceIndex}:${begin}:${blockData.length}`;
			this.pieceCache.set(cacheKey, blockData);
		} catch (error) {
			console.error(`Error writing block: ${error}`);
		}
	}

	/**
	 * Close all file handles
	 */
	async cleanup(): Promise<void> {
		for (const file of this.files) {
			try {
				await file.handle.close();
			} catch (_e) {
				// Ignore close errors
			}
		}
	}

	/**
	 * Get list of file paths
	 */
	getFilePaths(): string[] {
		return this.files.map((f) => f.path);
	}

	/**
	 * Read a piece block from disk for uploading to peers
	 */
	async readPieceBlock(
		pieceIndex: number,
		begin: number,
		length: number,
	): Promise<Buffer> {
		// Check cache first (Fix 3: Read Caching)
		const cacheKey = `${pieceIndex}:${begin}:${length}`;
		const cached = this.pieceCache.get(cacheKey);
		if (cached) {
			return cached;
		}

		// Cache miss - read from disk
		const pieceLength = this.torrent.info["piece length"] as number;
		const globalOffset =
			BigInt(pieceIndex) * BigInt(pieceLength) + BigInt(begin);

		const result = Buffer.alloc(length);
		let resultOffset = 0;

		try {
			for (const fileEntry of this.files) {
				const fileStart = fileEntry.offset;
				const fileEnd = fileEntry.offset + fileEntry.length;

				if (
					globalOffset < fileEnd &&
					globalOffset + BigInt(length) > fileStart
				) {
					const intersectionStart =
						globalOffset > fileStart ? globalOffset : fileStart;
					const intersectionEnd =
						globalOffset + BigInt(length) < fileEnd
							? globalOffset + BigInt(length)
							: fileEnd;

					if (intersectionStart < intersectionEnd) {
						const fileOffsetStart = Number(intersectionStart - fileStart);
						const readLength = Number(intersectionEnd - intersectionStart);

						const buffer = Buffer.alloc(readLength);
						await fileEntry.handle.read(buffer, 0, readLength, fileOffsetStart);

						buffer.copy(result, resultOffset);
						resultOffset += readLength;
					}
				}
			}

			// Cache the result for future requests
			this.pieceCache.set(cacheKey, result);

			return result;
		} catch (error) {
			throw new Error(`Failed to read piece block: ${error}`);
		}
	}
}
