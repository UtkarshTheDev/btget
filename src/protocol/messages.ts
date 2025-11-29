import type { Torrent } from "../types/index";
import { genId } from "../utils/genId";
import { infoHash } from "./parser";

const HANDSHAKE_LENGTH = 68;
const PROTOCOL_ID_LENGTH = 19;
const HANDSHAKE_RESERVED_OFFSET = 20;
const HANDSHAKE_INFO_HASH_OFFSET = 28;
const HANDSHAKE_PEER_ID_OFFSET = 48;
const ID_OFFSET = 4;
const PAYLOAD_OFFSET = 5;

const KEEP_ALIVE_LEN = 4;
const CHOKE_LEN = 5;
const UNCHOKE_LEN = 5;
const INTERESTED_LEN = 5;
const UNINTERESTED_LEN = 5;
const HAVE_LEN = 9;
const REQUEST_LEN = 17;
const CANCEL_LEN = 17;
const PORT_LEN = 7;
const BITFIELD_BASE_LEN = 5;
const PIECE_OVERHEAD_LEN = 13;
const PIECE_LENGTH_PREFIX_BASE = 9;

const CHOKE_ID = 0;
const UNCHOKE_ID = 1;
const INTERESTED_ID = 2;
const UNINTERESTED_ID = 3;
const HAVE_ID = 4;
const BITFIELD_ID = 5;
const REQUEST_ID = 6;
const PIECE_ID = 7;
const CANCEL_ID = 8;
const PORT_ID = 9;

const CHOKE_MSG_LEN = 1;
const UNCHOKE_MSG_LEN = 1;
const INTERESTED_MSG_LEN = 1;
const UNINTERESTED_MSG_LEN = 1;
const HAVE_MSG_LEN = 5;
const REQUEST_MSG_LEN = 13;
const CANCEL_MSG_LEN = 13;
const PORT_MSG_LEN = 3;

const BEGIN_OFFSET = 9;
const LENGTH_OFFSET = 13;
const BLOCK_OFFSET = 13;

const PARSE_INDEX_OFFSET = 0;
const PARSE_BEGIN_OFFSET = 4;
const PARSE_LENGTH_OFFSET = 8;
const PARSE_BLOCK_OFFSET = 8;

export function buildHandshake(torrent: Torrent): Buffer {
	const buf = Buffer.alloc(HANDSHAKE_LENGTH);
	// pstrlen
	buf.writeUInt8(PROTOCOL_ID_LENGTH, 0);
	// pstr
	buf.write("BitTorrent protocol", 1);
	// reserved
	buf.writeUInt32BE(0, HANDSHAKE_RESERVED_OFFSET);
	buf.writeUInt32BE(0, HANDSHAKE_RESERVED_OFFSET + 4);
	// info hash
	infoHash(torrent).copy(buf, HANDSHAKE_INFO_HASH_OFFSET);
	// peer id
	genId().copy(buf, HANDSHAKE_PEER_ID_OFFSET); // genId() returns a Buffer, copy it directly
	return buf;
}

export function buildKeepAlive(): Buffer {
	return Buffer.alloc(KEEP_ALIVE_LEN);
}

export function buildChoke(): Buffer {
	const buf = Buffer.alloc(CHOKE_LEN);
	// length
	buf.writeUInt32BE(CHOKE_MSG_LEN, 0);
	// id
	buf.writeUInt8(CHOKE_ID, ID_OFFSET);
	return buf;
}

export function buildUnchoke(): Buffer {
	const buf = Buffer.alloc(UNCHOKE_LEN);
	// length
	buf.writeUInt32BE(UNCHOKE_MSG_LEN, 0);
	// id
	buf.writeUInt8(UNCHOKE_ID, ID_OFFSET);
	return buf;
}

export function buildInterested(): Buffer {
	const buf = Buffer.alloc(INTERESTED_LEN);
	// length
	buf.writeUInt32BE(INTERESTED_MSG_LEN, 0);
	// id
	buf.writeUInt8(INTERESTED_ID, ID_OFFSET);
	return buf;
}

export function buildUninterested(): Buffer {
	const buf = Buffer.alloc(UNINTERESTED_LEN);
	// length
	buf.writeUInt32BE(UNINTERESTED_MSG_LEN, 0);
	// id
	buf.writeUInt8(UNINTERESTED_ID, ID_OFFSET);
	return buf;
}

export function buildHave(payload: number): Buffer {
	const buf = Buffer.alloc(HAVE_LEN);
	// length
	buf.writeUInt32BE(HAVE_MSG_LEN, 0);
	// id
	buf.writeUInt8(HAVE_ID, ID_OFFSET);
	// piece index
	buf.writeUInt32BE(payload, PAYLOAD_OFFSET);
	return buf;
}

export function buildBitfield(bitfield: Buffer): Buffer {
	const buf = Buffer.alloc(BITFIELD_BASE_LEN + bitfield.length); // Correct buffer size
	// length
	buf.writeUInt32BE(bitfield.length + 1, 0);
	// id
	buf.writeUInt8(BITFIELD_ID, ID_OFFSET);
	// bitfield
	bitfield.copy(buf, PAYLOAD_OFFSET);
	return buf;
}

export type RequestPayload = {
	index: number;
	begin: number;
	length: number;
};

export function buildRequest(payload: RequestPayload): Buffer {
	const buf = Buffer.alloc(REQUEST_LEN);
	// length
	buf.writeUInt32BE(REQUEST_MSG_LEN, 0);
	// id
	buf.writeUInt8(REQUEST_ID, ID_OFFSET);
	// piece index
	buf.writeUInt32BE(payload.index, PAYLOAD_OFFSET);
	// begin
	buf.writeUInt32BE(payload.begin, BEGIN_OFFSET);
	// length
	buf.writeUInt32BE(payload.length, LENGTH_OFFSET);
	return buf;
}

export type PiecePayload = {
	index: number;
	begin: number;
	block: Buffer;
	length: number; // Added length property
};

export function buildPiece(payload: PiecePayload): Buffer {
	const buf = Buffer.alloc(payload.block.length + PIECE_OVERHEAD_LEN);
	// length
	buf.writeUInt32BE(payload.block.length + PIECE_LENGTH_PREFIX_BASE, 0);
	// id
	buf.writeUInt8(PIECE_ID, ID_OFFSET);
	// piece index
	buf.writeUInt32BE(payload.index, PAYLOAD_OFFSET);
	// begin
	buf.writeUInt32BE(payload.begin, BEGIN_OFFSET);
	// block
	payload.block.copy(buf, BLOCK_OFFSET);
	return buf;
}

export function buildCancel(payload: RequestPayload): Buffer {
	const buf = Buffer.alloc(CANCEL_LEN);
	// length
	buf.writeUInt32BE(CANCEL_MSG_LEN, 0);
	// id
	buf.writeUInt8(CANCEL_ID, ID_OFFSET);
	// piece index
	buf.writeUInt32BE(payload.index, PAYLOAD_OFFSET);
	// begin
	buf.writeUInt32BE(payload.begin, BEGIN_OFFSET);
	// length
	buf.writeUInt32BE(payload.length, LENGTH_OFFSET);
	return buf;
}

export function buildPort(payload: number): Buffer {
	const buf = Buffer.alloc(PORT_LEN);
	// length
	buf.writeUInt32BE(PORT_MSG_LEN, 0);
	// id
	buf.writeUInt8(PORT_ID, ID_OFFSET);
	// listen-port
	buf.writeUInt16BE(payload, PAYLOAD_OFFSET);
	return buf;
}

export type MessagePayload = Buffer | RequestPayload | PiecePayload | null;

export type ParsedMessage = {
	size: number;
	id: number | null;
	payload: MessagePayload;
};

export function parse(msg: Buffer): ParsedMessage {
	const id = msg.length > ID_OFFSET ? msg.readInt8(ID_OFFSET) : null;
	let payload: MessagePayload =
		msg.length > PAYLOAD_OFFSET ? msg.slice(PAYLOAD_OFFSET) : null; // Can be Buffer or object

	if (id === REQUEST_ID || id === CANCEL_ID) {
		// Request, Cancel
		const p = payload as Buffer;
		payload = {
			index: p.readInt32BE(PARSE_INDEX_OFFSET),
			begin: p.readInt32BE(PARSE_BEGIN_OFFSET),
			length: p.readInt32BE(PARSE_LENGTH_OFFSET),
		};
	} else if (id === PIECE_ID) {
		// Piece
		const p = payload as Buffer;
		payload = {
			index: p.readInt32BE(PARSE_INDEX_OFFSET),
			begin: p.readInt32BE(PARSE_BEGIN_OFFSET),
			block: p.slice(PARSE_BLOCK_OFFSET),
			length: p.slice(PARSE_BLOCK_OFFSET).length, // Extract length from block
		};
	}

	return {
		size: msg.readInt32BE(0),
		id: id,
		payload: payload,
	};
}
