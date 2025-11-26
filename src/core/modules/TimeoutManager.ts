import type { PieceBlock } from "../../queue/Queue";
import type Pieces from "../../pieces/Pieces";
import type Queue from "../../queue/Queue";
import type { ExtendedSocket } from "./EndgameManager";

export interface ProgressTimeoutConfig {
	stallTimeMs: number; // Time with no progress before considering stalled
	minSpeedBytesPerSec: number; // Minimum acceptable download speed
	minSpeedDurationMs: number; // How long speed can be below minimum
	maxTotalTimeMs: number; // Absolute maximum time (safety limit)
}

/**
 * TimeoutManager handles block and download timeouts with progress-based monitoring
 */
export class TimeoutManager {
	private timeoutCheckInterval?: NodeJS.Timeout;
	private downloadTimeout?: NodeJS.Timeout;
	private progressCheckInterval?: NodeJS.Timeout;
	private readonly BLOCK_TIMEOUT_MS = 30000; // 30 seconds

	// Progress tracking
	private lastProgressBytes = 0;
	private lastProgressTime = Date.now();
	private lowSpeedStartTime?: number;

	/**
	 * Start checking for block timeouts
	 */
	startBlockTimeoutCheck(
		getSockets: () => Map<string, ExtendedSocket>,
		pieces: Pieces,
		queue: Queue,
		onRequestMore: (socket: ExtendedSocket) => void,
	): void {
		this.timeoutCheckInterval = setInterval(() => {
			const now = Date.now();
			const sockets = getSockets();

			sockets.forEach((socket) => {
				if (socket.destroyed || !socket.activeRequests) return;

				const timedOut: PieceBlock[] = [];

				socket.activeRequests.forEach((req) => {
					if (now - req.requestedAt > this.BLOCK_TIMEOUT_MS) {
						timedOut.push(req.block);
					}
				});

				// Re-queue timed out blocks
				timedOut.forEach((block) => {
					const key = `${block.index}:${block.begin}`;
					socket.activeRequests!.delete(key);
					socket.pendingRequests = Math.max(
						0,
						(socket.pendingRequests ?? 0) - 1,
					);
					pieces.removeRequested(block);
					queue.queueFront(block); // High priority
				});

				// Request more if blocks freed up
				if (timedOut.length > 0 && !socket.destroyed && !socket.choked) {
					onRequestMore(socket);
				}
			});
		}, 5000); // Check every 5 seconds
	}

	/**
	 * Start progress-based timeout monitoring
	 * Only triggers timeout if download is genuinely stalled
	 */
	startProgressBasedTimeout(
		getProgress: () => { downloaded: number; speed: number },
		onTimeout: () => void,
		config: ProgressTimeoutConfig,
	): void {
		const startTime = Date.now();
		this.lastProgressBytes = 0;
		this.lastProgressTime = Date.now();
		this.lowSpeedStartTime = undefined;

		this.progressCheckInterval = setInterval(() => {
			const now = Date.now();
			const { downloaded, speed } = getProgress();
			const elapsedTotal = now - startTime;

			// Check 1: Absolute maximum time limit (safety)
			if (elapsedTotal > config.maxTotalTimeMs) {
				this.clearAll();
				onTimeout();
				return;
			}

			// Check 2: No progress for stallTimeMs
			const progressMade = downloaded > this.lastProgressBytes;
			if (progressMade) {
				this.lastProgressBytes = downloaded;
				this.lastProgressTime = now;
				this.lowSpeedStartTime = undefined; // Reset low speed timer
			} else {
				const timeSinceProgress = now - this.lastProgressTime;
				if (timeSinceProgress > config.stallTimeMs) {
					this.clearAll();
					onTimeout();
					return;
				}
			}

			// Check 3: Speed below minimum for too long
			if (speed < config.minSpeedBytesPerSec) {
				if (!this.lowSpeedStartTime) {
					this.lowSpeedStartTime = now;
				} else {
					const lowSpeedDuration = now - this.lowSpeedStartTime;
					if (lowSpeedDuration > config.minSpeedDurationMs) {
						this.clearAll();
						onTimeout();
						return;
					}
				}
			} else {
				this.lowSpeedStartTime = undefined; // Reset if speed recovers
			}
		}, 10000); // Check every 10 seconds
	}

	/**
	 * Start download timeout (legacy - use startProgressBasedTimeout instead)
	 * @deprecated Use startProgressBasedTimeout for better timeout handling
	 */
	startDownloadTimeout(timeoutMs: number, onTimeout: () => void): void {
		this.downloadTimeout = setTimeout(onTimeout, timeoutMs);
	}

	/**
	 * Clear download timeout
	 */
	clearDownloadTimeout(): void {
		if (this.downloadTimeout) {
			clearTimeout(this.downloadTimeout);
			this.downloadTimeout = undefined;
		}
		if (this.progressCheckInterval) {
			clearInterval(this.progressCheckInterval);
			this.progressCheckInterval = undefined;
		}
	}

	/**
	 * Clear all timeouts
	 */
	clearAll(): void {
		if (this.timeoutCheckInterval) {
			clearInterval(this.timeoutCheckInterval);
			this.timeoutCheckInterval = undefined;
		}
		this.clearDownloadTimeout();
	}
}
