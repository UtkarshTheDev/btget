import cliProgress from "cli-progress";

/**
 * ProgressTracker handles download progress monitoring and display
 */
export class ProgressTracker {
	private progressBar: cliProgress.SingleBar | null = null;
	private lastProgress = 0;
	private stallCount = 0;
	private onProgress: ((data: any) => void) | null = null;

	/**
	 * Initialize progress bar
	 */
	initialize(
		torrentName: string,
		totalSize: bigint,
		onProgress?: (data: any) => void,
	): void {
		this.onProgress = onProgress || null;

		if (!this.onProgress) {
			this.progressBar = new cliProgress.SingleBar(
				{
					format: `${torrentName} | {bar} | {percentage}% | {speed} KB/s | Peers: {peers} | {value}/{total}`,
					barCompleteChar: "\u2588",
					barIncompleteChar: "\u2591",
					hideCursor: true,
					formatValue: (v, options, type) => {
						if (type === "value" || type === "total") {
							const mb = v / (1024 * 1024);
							return mb.toFixed(2) + " MB";
						}
						return v.toString();
					},
				},
				cliProgress.Presets.shades_classic,
			);

			this.progressBar.start(Number(totalSize), 0, {
				speed: "0.0",
				peers: 0,
			});
		}
	}

	/**
	 * Update progress bar
	 */
	private lastTime = Date.now();

	/**
	 * Update progress bar
	 */
	update(
		downloaded: number,
		connectedPeers: number,
		stats?: { seeds: number; leechers: number },
	): void {
		const now = Date.now();
		const timeDiff = (now - this.lastTime) / 1000; // Seconds

		let speed = 0;
		if (timeDiff > 0) {
			const bytesDiff = downloaded - this.lastProgress;
			speed = bytesDiff / 1024 / timeDiff; // KB/s
		}

		// Update state for next calculation
		this.lastProgress = downloaded;
		this.lastTime = now;

		if (this.progressBar) {
			this.progressBar.update(downloaded, {
				peers: connectedPeers,
				speed: speed.toFixed(2),
			});
		}

		if (this.onProgress) {
			this.onProgress({
				downloaded,
				speed,
				peers: connectedPeers,
				seeds: stats?.seeds || 0,
				leechers: stats?.leechers || 0,
			});
		}
	}

	/**
	 * Detect download stall
	 */
	detectStall(
		downloaded: number,
		connectedPeers: number,
		onStall: () => void,
	): boolean {
		if (downloaded === this.lastProgress && connectedPeers > 0) {
			this.stallCount++;
			if (this.stallCount >= 5) {
				onStall();
				this.stallCount = 0;
				return true;
			}
		} else {
			this.stallCount = 0;
		}

		this.lastProgress = downloaded;
		return false;
	}

	/**
	 * Stop progress bar
	 */
	stop(): void {
		this.progressBar?.stop();
		this.progressBar = null;
	}
}
