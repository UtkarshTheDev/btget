import type { Socket } from "node:net";
import { buildCancel } from "../../protocol/messages";
import type { PieceBlock } from "../../queue/Queue";

// Track block requests with timestamps for timeout detection
export interface BlockRequest {
	block: PieceBlock;
	requestedAt: number;
}

export interface ExtendedSocket extends Socket {
	pendingRequests?: number;
	peerId?: string;
	lastData?: number;
	choked?: boolean;
	bitfield?: Buffer;
	activeRequests?: Map<string, BlockRequest>;
	endgameMode?: boolean;
	availablePieces?: Set<number>;
	// Speed tracking
	downloaded?: number;
	speed?: number;
	speedWindowStart?: number; // Timestamp when current speed window started
	speedWindowBytes?: number; // Bytes received in current speed window
	// Adaptive pipelining (Fix 2)
	maxPipeline?: number; // Dynamic pipeline depth (2-50)
	rollingLatency?: number; // Exponential moving average of RTT in ms
	requestTimestamps?: Map<string, number>; // Track when each block was requested
}

/**
 * EndgameManager handles endgame mode logic
 */
export class EndgameManager {
	private inEndgame = false;
	private readonly endgameThreshold = 95; // percent
	private readonly queueThreshold = 50; // blocks

	private static readonly ENDGAME_PIPELINE = 5;
	private static readonly DEFAULT_PIPELINE = 10;

	/**
	 * Check if should enter endgame mode
	 */
	shouldEnterEndgame(progress: number, queueLength: number): boolean {
		return (
			!this.inEndgame &&
			progress > this.endgameThreshold &&
			queueLength < this.queueThreshold
		);
	}

	/**
	 * Enter endgame mode
	 */
	enterEndgame(sockets: Map<string, ExtendedSocket>): void {
		if (this.inEndgame) return;

		this.inEndgame = true;

		// Mark all sockets as in endgame
		sockets.forEach((socket) => {
			socket.endgameMode = true;
		});
	}

	/**
	 * Send CANCEL messages to other peers when block received
	 */
	sendCancelMessages(
		receivingSocket: ExtendedSocket,
		blockKey: string,
		block: PieceBlock,
		allSockets: Map<string, ExtendedSocket>,
	): void {
		allSockets.forEach((otherSocket) => {
			if (
				otherSocket !== receivingSocket &&
				!otherSocket.destroyed &&
				otherSocket.activeRequests
			) {
				const requests = otherSocket.activeRequests;
				if (requests.has(blockKey)) {
					try {
						otherSocket.write(buildCancel(block));
						requests.delete(blockKey);
						otherSocket.pendingRequests = Math.max(
							0,
							(otherSocket.pendingRequests ?? 0) - 1,
						);
					} catch (_e) {
						// Ignore write errors
					}
				}
			}
		});
	}

	/**
	 * Get max pipeline depth for endgame mode
	 */
	getMaxPipeline(socket: ExtendedSocket): number {
		// Use socket's adaptive maxPipeline, fallback to defaults
		return (
			socket.maxPipeline ??
			(socket.endgameMode
				? EndgameManager.ENDGAME_PIPELINE
				: EndgameManager.DEFAULT_PIPELINE)
		);
	}

	/**
	 * Check if in endgame mode
	 */
	isInEndgame(): boolean {
		return this.inEndgame;
	}
}
