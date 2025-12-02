/**
 * PHASE 4: Comprehensive Metrics API
 * Tracks detailed statistics for monitoring and debugging
 */

export type Metrics = {
	totalDownloaded: number;
	totalUploaded: number;
	currentDownloadSpeed: number;
	currentUploadSpeed: number;
	avgDownloadSpeed: number;
	avgUploadSpeed: number;
	activePeers: number;
	totalPeersConnected: number;
	blocksReceived: number;
	blocksRequested: number;
	protocolErrors: number;
	uptime: number; // milliseconds
};

export class MetricsTracker {
	private startTime: number;
	private blocksReceived = 0;
	private blocksRequested = 0;
	private protocolErrors = 0;
	private downloadSpeedHistory: number[] = [];
	private uploadSpeedHistory: number[] = [];
	private readonly MAX_HISTORY_SIZE = 60; // Keep last 60 samples

	constructor() {
		this.startTime = Date.now();
	}

	/**
	 * Record a block received
	 */
	recordBlockReceived(): void {
		this.blocksReceived++;
	}

	/**
	 * Record a block requested
	 */
	recordBlockRequested(): void {
		this.blocksRequested++;
	}

	/**
	 * Record a protocol error
	 */
	recordProtocolError(): void {
		this.protocolErrors++;
	}

	/**
	 * Record current download speed
	 */
	recordDownloadSpeed(speed: number): void {
		this.downloadSpeedHistory.push(speed);
		if (this.downloadSpeedHistory.length > this.MAX_HISTORY_SIZE) {
			this.downloadSpeedHistory.shift();
		}
	}

	/**
	 * Record current upload speed
	 */
	recordUploadSpeed(speed: number): void {
		this.uploadSpeedHistory.push(speed);
		if (this.uploadSpeedHistory.length > this.MAX_HISTORY_SIZE) {
			this.uploadSpeedHistory.shift();
		}
	}

	/**
	 * Get comprehensive metrics
	 */
	getMetrics(
		totalDownloaded: number,
		totalUploaded: number,
		currentDownloadSpeed: number,
		currentUploadSpeed: number,
		activePeers: number,
		totalPeersConnected: number,
	): Metrics {
		const avgDownloadSpeed =
			this.downloadSpeedHistory.length > 0
				? this.downloadSpeedHistory.reduce((a, b) => a + b, 0) /
					this.downloadSpeedHistory.length
				: 0;

		const avgUploadSpeed =
			this.uploadSpeedHistory.length > 0
				? this.uploadSpeedHistory.reduce((a, b) => a + b, 0) /
					this.uploadSpeedHistory.length
				: 0;

		return {
			totalDownloaded,
			totalUploaded,
			currentDownloadSpeed,
			currentUploadSpeed,
			avgDownloadSpeed,
			avgUploadSpeed,
			activePeers,
			totalPeersConnected,
			blocksReceived: this.blocksReceived,
			blocksRequested: this.blocksRequested,
			protocolErrors: this.protocolErrors,
			uptime: Date.now() - this.startTime,
		};
	}

	/**
	 * Reset all metrics
	 */
	reset(): void {
		this.blocksReceived = 0;
		this.blocksRequested = 0;
		this.protocolErrors = 0;
		this.downloadSpeedHistory = [];
		this.uploadSpeedHistory = [];
		this.startTime = Date.now();
	}
}
