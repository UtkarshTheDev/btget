import crypto from "node:crypto";

const PEER_ID_LENGTH_BYTES = 20;
const RANDOM_BYTES_LENGTH = 12;
const PREFIX_OFFSET = 8;
let id: Buffer | null = null;

export function genId() {
	if (!id) {
		// Use a more standard peer ID format that trackers recognize
		// Format: -qB4250- followed by random bytes (qBittorrent style)
		id = Buffer.alloc(PEER_ID_LENGTH_BYTES);
		Buffer.from("-qB4250-").copy(id, 0);
		// Fill remaining 12 bytes with random data
		crypto.randomBytes(RANDOM_BYTES_LENGTH).copy(id, PREFIX_OFFSET);
	}
	return id;
}
