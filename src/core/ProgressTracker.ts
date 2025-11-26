import cliProgress from "cli-progress";

/**
 * ProgressTracker handles download progress monitoring and display
 */
export class ProgressTracker {
	private progressBar: cliProgress.SingleBar | null = null;
	private lastProgress = 0;
	private stallCount = 0;

	/**
	 * Initialize progress bar
	 */
	initialize(torrentName: string, totalSize: bigint): void {
		this.progressBar = new cliProgress.SingleBar(
			{
				format: `${torrentName} | {bar} | {percentage}% | {speed} KB/s | Peers: {peers} | {value_formatted}/{total_formatted}`,
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

	/**
	 * Update progress bar
	 */
	update(downloaded: number, totalSize: bigint, connectedPeers: number): void {
		if (!this.progressBar) return;

		const speed = (downloaded - this.lastProgress) / 1024; // KB/s
		this.progressBar.update(downloaded, {
			speed: speed.toFixed(1),
			peers: connectedPeers,
		});
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
