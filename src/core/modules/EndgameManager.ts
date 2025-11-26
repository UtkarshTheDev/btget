import type { Socket } from "net";
import type { PieceBlock } from "../../queue/Queue";
import { buildCancel } from "../../protocol/messages";

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
	lastMeasureTime?: number;
}

/**
 * EndgameManager handles endgame mode logic
 */
export class EndgameManager {
	private inEndgame = false;
	private readonly endgameThreshold = 95; // percent
	private readonly queueThreshold = 50; // blocks

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
					} catch (e) {
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
		return socket.endgameMode ? 5 : 10;
	}

	/**
	 * Check if in endgame mode
	 */
	isInEndgame(): boolean {
		return this.inEndgame;
	}
}
