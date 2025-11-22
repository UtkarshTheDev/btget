import { Buffer } from "node:buffer";
import type { Torrent } from "../types";
import { genId } from "./genId";
import { infoHash } from "./parser";

export function buildHandshake(torrent: Torrent): Buffer {
  const buf = Buffer.alloc(68);
  // pstrlen
  buf.writeUInt8(19, 0);
  // pstr
  buf.write("BitTorrent protocol", 1);
  // reserved
  buf.writeUInt32BE(0, 20);
  buf.writeUInt32BE(0, 24);
  // info hash
  infoHash(torrent).copy(buf, 28);
  // peer id
  genId().copy(buf, 48); // genId() returns a Buffer, copy it directly
  return buf;
}

export function buildKeepAlive(): Buffer {
  return Buffer.alloc(4);
}

export function buildChoke(): Buffer {
  const buf = Buffer.alloc(5);
  // length
  buf.writeUInt32BE(1, 0);
  // id
  buf.writeUInt8(0, 4);
  return buf;
}

export function buildUnchoke(): Buffer {
  const buf = Buffer.alloc(5);
  // length
  buf.writeUInt32BE(1, 0);
  // id
  buf.writeUInt8(1, 4);
  return buf;
}

export function buildInterested(): Buffer {
  const buf = Buffer.alloc(5);
  // length
  buf.writeUInt32BE(1, 0);
  // id
  buf.writeUInt8(2, 4);
  return buf;
}

export function buildUninterested(): Buffer {
  const buf = Buffer.alloc(5);
  // length
  buf.writeUInt32BE(1, 0);
  // id
  buf.writeUInt8(3, 4);
  return buf;
}

export function buildHave(payload: number): Buffer {
  const buf = Buffer.alloc(9);
  // length
  buf.writeUInt32BE(5, 0);
  // id
  buf.writeUInt8(4, 4);
  // piece index
  buf.writeUInt32BE(payload, 5);
  return buf;
}

export function buildBitfield(bitfield: Buffer): Buffer {
  const buf = Buffer.alloc(5 + bitfield.length); // Correct buffer size
  // length
  buf.writeUInt32BE(bitfield.length + 1, 0);
  // id
  buf.writeUInt8(5, 4);
  // bitfield
  bitfield.copy(buf, 5);
  return buf;
}

export type RequestPayload = {
  index: number;
  begin: number;
  length: number;
};

export function buildRequest(payload: RequestPayload): Buffer {
  const buf = Buffer.alloc(17);
  // length
  buf.writeUInt32BE(13, 0);
  // id
  buf.writeUInt8(6, 4);
  // piece index
  buf.writeUInt32BE(payload.index, 5);
  // begin
  buf.writeUInt32BE(payload.begin, 9);
  // length
  buf.writeUInt32BE(payload.length, 13);
  return buf;
}

export type PiecePayload = {
  index: number;
  begin: number;
  block: Buffer;
  length: number; // Added length property
};

export function buildPiece(payload: PiecePayload): Buffer {
  const buf = Buffer.alloc(payload.block.length + 13);
  // length
  buf.writeUInt32BE(payload.block.length + 9, 0);
  // id
  buf.writeUInt8(7, 4);
  // piece index
  buf.writeUInt32BE(payload.index, 5);
  // begin
  buf.writeUInt32BE(payload.begin, 9);
  // block
  payload.block.copy(buf, 13);
  return buf;
}

export function buildCancel(payload: RequestPayload): Buffer {
  const buf = Buffer.alloc(17);
  // length
  buf.writeUInt32BE(13, 0);
  // id
  buf.writeUInt8(8, 4);
  // piece index
  buf.writeUInt32BE(payload.index, 5);
  // begin
  buf.writeUInt32BE(payload.begin, 9);
  // length
  buf.writeUInt32BE(payload.length, 13);
  return buf;
}

export function buildPort(payload: number): Buffer {
  const buf = Buffer.alloc(7);
  // length
  buf.writeUInt32BE(3, 0);
  // id
  buf.writeUInt8(9, 4);
  // listen-port
  buf.writeUInt16BE(payload, 5);
  return buf;
}

export type ParsedMessage = {
  size: number;
  id: number | null;
  payload: any; // This could be more specific based on ID
};

export function parse(msg: Buffer): ParsedMessage {
  const id = msg.length > 4 ? msg.readInt8(4) : null;
  let payload: any = msg.length > 5 ? msg.slice(5) : null; // Can be Buffer or object

  if (id === 6 || id === 8) { // Request, Cancel
    payload = {
      index: payload.readInt32BE(0),
      begin: payload.readInt32BE(4),
      length: payload.readInt32BE(8),
    };
  } else if (id === 7) { // Piece
    payload = {
      index: payload.readInt32BE(0),
      begin: payload.readInt32BE(4),
      block: payload.slice(8),
      length: payload.slice(8).length, // Extract length from block
    };
  }

  return {
    size: msg.readInt32BE(0),
    id: id,
    payload: payload,
  };
}
