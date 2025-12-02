import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * PHASE 4: Checkpoint/Resume Support
 * Allows resuming downloads from where they left off
 */

export type Checkpoint = {
	torrentHash: string;
	timestamp: number;
	verifiedPieces: number[]; // Array of piece indices
	downloadedBytes: number;
	downloadDir: string;
};

export class CheckpointManager {
	private readonly CHECKPOINT_INTERVAL_MS = 30000; // 30 seconds
	private checkpointTimer: NodeJS.Timeout | null = null;

	/**
	 * Get checkpoint file path
	 */
	private getCheckpointPath(torrentHash: string, downloadDir: string): string {
		return path.join(downloadDir, `.${torrentHash}.checkpoint.json`);
	}

	/**
	 * Save checkpoint to disk
	 */
	async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
		try {
			const checkpointPath = this.getCheckpointPath(
				checkpoint.torrentHash,
				checkpoint.downloadDir,
			);
			await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
		} catch (error) {
			console.error("Failed to save checkpoint:", error);
		}
	}

	/**
	 * Load checkpoint from disk
	 */
	async loadCheckpoint(
		torrentHash: string,
		downloadDir: string,
	): Promise<Checkpoint | null> {
		try {
			const checkpointPath = this.getCheckpointPath(torrentHash, downloadDir);
			const data = await fs.readFile(checkpointPath, "utf-8");
			return JSON.parse(data) as Checkpoint;
		} catch {
			return null; // No checkpoint found or error reading
		}
	}

	/**
	 * Delete checkpoint file
	 */
	async deleteCheckpoint(
		torrentHash: string,
		downloadDir: string,
	): Promise<void> {
		try {
			const checkpointPath = this.getCheckpointPath(torrentHash, downloadDir);
			await fs.unlink(checkpointPath);
		} catch {
			// Ignore errors (file might not exist)
		}
	}

	/**
	 * Start periodic checkpoint saving
	 */
	startPeriodicSave(
		getCheckpoint: () => Checkpoint,
		interval: number = this.CHECKPOINT_INTERVAL_MS,
	): void {
		this.checkpointTimer = setInterval(async () => {
			const checkpoint = getCheckpoint();
			await this.saveCheckpoint(checkpoint);
		}, interval);
	}

	/**
	 * Stop periodic checkpoint saving
	 */
	stopPeriodicSave(): void {
		if (this.checkpointTimer) {
			clearInterval(this.checkpointTimer);
			this.checkpointTimer = null;
		}
	}
}
