import type { PieceBlock } from "../../queue/Queue";
import type Pieces from "../../pieces/Pieces";
import type Queue from "../../queue/Queue";
import type { ExtendedSocket } from "./EndgameManager";

/**
 * TimeoutManager handles block and download timeouts
 */
export class TimeoutManager {
	private timeoutCheckInterval?: NodeJS.Timeout;
	private downloadTimeout?: NodeJS.Timeout;
	private readonly BLOCK_TIMEOUT_MS = 30000; // 30 seconds

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
	 * Start download timeout
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
