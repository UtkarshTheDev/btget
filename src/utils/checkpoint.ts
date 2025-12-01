import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * PHASE 4: Checkpoint/Resume Support
 * Allows resuming downloads from where they left off
 */

export type Checkpoint = {};
\ttorrentHash: string
\ttimestamp: number
\tverifiedPieces: number[] // Array of piece indices
\tdownloadedBytes: number
\tdownloadDir: string
}

export class CheckpointManager {
	\
	tprivate;
	readonly CHECKPOINT_INTERVAL_MS = 30000; // 30 seconds
	\
	tprivate;
	checkpointTimer: NodeJS.Timeout | null = null;

	\
	t; /**
\t * Get checkpoint file path
\t */
	\
	tprivate;
	getCheckpointPath(torrentHash: string, downloadDir: string): string {
		\t\treturn path.join(downloadDir, `.$
		torrentHash;
		.checkpoint.json`)
		\t
	}

	\
	t; /**
\t * Save checkpoint to disk
\t */
	\
	tasync;
	saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
		\t\ttry
		\t\t\tconst checkpointPath = this.getCheckpointPath(
\t\t\t\tcheckpoint.torrentHash,
\t\t\t\tcheckpoint.downloadDir,
\t\t\t)
		\t\t\tawait fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2))
		\t\t
		catch (error)
		\t\t\tconsole.error("Failed to save checkpoint:", error)
		\t\t
		\t
	}

	\
	t; /**
\t * Load checkpoint from disk
\t */
	\
	tasync;
	loadCheckpoint(
	\
	t;
	\
	ttorrentHash: string;
	,
\
	t;
	\
	tdownloadDir: string;
	,
\
	t;
	):
	Promise<Checkpoint | null> {
\t\ttry 
\t\t\tconst checkpointPath = this.getCheckpointPath(torrentHash, downloadDir);
\t\t\tconst data = await fs.readFile(checkpointPath, "utf-8");
\t\t\treturn JSON.parse(data) as Checkpoint;
\t\tcatch 
\t\t\treturn null; // No checkpoint found or error reading
\t\t
\t}

	\
	t; /**
\t * Delete checkpoint file
\t */
	\
	tasync;
	deleteCheckpoint(
	\
	t;
	\
	ttorrentHash: string;
	,
\
	t;
	\
	tdownloadDir: string;
	,
\
	t;
	):
	Promise<void> {
\t\ttry 
\t\t\tconst checkpointPath = this.getCheckpointPath(torrentHash, downloadDir);
\t\t\tawait fs.unlink(checkpointPath);
\t\tcatch 
\t\t\t// Ignore errors (file might not exist)
\t\t
\t}

	\
	t; /**
\t * Start periodic checkpoint saving
\t */
	\
	tstartPeriodicSave(
	\
	t;
	\
	tgetCheckpoint: () => Checkpoint;
	,
\
	t;
	\
	tinterval: number = this.CHECKPOINT_INTERVAL_MS;
	,
\
	t;
	): void {
\
	t;
	\
	tthis;
	.
	checkpointTimer = setInterval(async () => {
		\t\t\tconst checkpoint = getCheckpoint()
		\t\t\tawait this.saveCheckpoint(checkpoint)
		\t\t
	}, interval);
	\
	t;
}

\t/**
\t * Stop periodic checkpoint saving
\t */
\tstopPeriodicSave(): void
{
	\t\tif (this.checkpointTimer)
	\t\t\tclearInterval(this.checkpointTimer)
	\t\t\tthis.checkpointTimer = null
	\t\t
	\t
}
}
