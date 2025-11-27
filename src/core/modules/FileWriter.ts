import * as fs from "fs/promises";
import * as path from "path";
import type { Torrent, File } from "../../types/index";
import { size } from "../../protocol/parser";

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

	constructor(torrent: Torrent) {
		this.torrent = torrent;
	}

	/**
	 * Initialize file handles for the torrent
	 */
	async initialize(outputDirPath: string, torrentName: string): Promise<void> {
		const isMultiFile = !!this.torrent.info.files;
		this.files = [];

		if (isMultiFile) {
			let currentOffset = BigInt(0);

			for (const file of this.torrent.info.files as File[]) {
				const filePathParts = file.path.map((p: Buffer) => p.toString("utf8"));
				const fullFilePath = path.join(
					outputDirPath,
					torrentName,
					...filePathParts,
				);
				const fileDir = path.dirname(fullFilePath);

				await fs.mkdir(fileDir, { recursive: true });
				const handle = await fs.open(fullFilePath, "w+");

				this.files.push({
					handle,
					path: fullFilePath,
					offset: currentOffset,
					length: BigInt(file.length),
				});

				currentOffset += BigInt(file.length);
			}
		} else {
			const fullFilePath = path.join(outputDirPath, torrentName);
			const handle = await fs.open(fullFilePath, "w+");

			this.files.push({
				handle,
				path: fullFilePath,
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
			} catch (e) {
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

			return result;
		} catch (error) {
			throw new Error(`Failed to read piece block: ${error}`);
		}
	}
}
