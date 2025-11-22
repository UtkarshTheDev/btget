import { Buffer } from "buffer";
import crypto from "crypto";
import dgram from "dgram";
import type { Peer, Torrent } from "../types";
import { genId } from "./genId";
import group from "./group";
import { infoHash, size } from "./parser";

export function getPeers(torrent: Torrent, callback: (peers: Peer[]) => void) {
  const socket = dgram.createSocket("udp4");
  const url = torrent.announce; // torrent.announce is already a string

  udpSend(socket, buildConnReq(), url, callback);

  socket.on("message", (msg) => {
    if (respType(msg) === "connect") {
      const connResp = parseConnResp(msg);
      const announceReq = buildAnnounceReq(connResp.connectionId, torrent);
      udpSend(socket, announceReq, url, callback);
    } else if (respType(msg) === "announce") {
      const announceResp = parseAnnounceResp(msg);
      callback(announceResp.peers);
    }
  });
}

function udpSend(
  socket: dgram.Socket,
  msg: Buffer,
  rawUrl: string,
  callback: (peers: Peer[]) => void
) {
  const url = new URL(rawUrl);
  socket.send(
    msg,
    0,
    msg.length,
    Number.parseInt(url.port, 10),
    url.hostname,
    (err: Error | null) => {
      if (err) {
        console.error("UDP Send Error:", err);
        callback([]);
        socket.close();
      }
    }
  );
}

function respType(resp: Buffer) {
  const action = resp.readUInt32BE(0);
  if (action === 0) {
    return "connect";
  }
  if (action === 1) {
    return "announce";
  }
  return "unknown";
}

function buildConnReq() {
  const buf = Buffer.alloc(16);

  buf.writeUInt32BE(0x4_17_27_10, 0); // connection id part 1 (64-bit integer, but written as two 32-bit for simplicity)
  buf.writeUInt32BE(0x19_80, 4); // connection id part 2
  buf.writeUInt32BE(0, 8); // action (0 = connect)

  crypto.randomBytes(4).copy(buf, 12); // transaction id

  return buf;
}

function parseConnResp(resp: Buffer) {
  return {
    action: resp.readUInt32BE(0),
    transactionId: resp.readUInt32BE(4),
    connectionId: resp.slice(8, 16),
  };
}

function buildAnnounceReq(connId: Buffer, torrent: Torrent, port = 6881) {
  const buf = Buffer.alloc(98);
  connId.copy(buf, 0); // connection id
  buf.writeUInt32BE(1, 8); // action (1 = announce)
  crypto.randomBytes(4).copy(buf, 12); // transaction id

  infoHash(torrent).copy(buf, 16); // info hash
  genId().copy(buf, 36);
  // downloaded
  Buffer.alloc(8).copy(buf, 56);
  // left
  const torrentSize = size(torrent);
  const sizeBuf = Buffer.alloc(8);
  sizeBuf.writeBigInt64BE(torrentSize, 0);
  sizeBuf.copy(buf, 64);
  // uploaded
  Buffer.alloc(8).copy(buf, 72);
  // event
  buf.writeUInt32BE(0, 80);
  // ip address (0 indicates current IP)
  buf.writeUInt32BE(0, 84); // Fix: this was overwriting event
  // key
  crypto.randomBytes(4).copy(buf, 88);
  // num want
  buf.writeInt32BE(-1, 92);
  // port
  buf.writeUInt16BE(port, 96);

  return buf;
}

function parseAnnounceResp(resp: Buffer) {
  return {
    action: resp.readUInt32BE(0),
    transactionId: resp.readUInt32BE(4),
    leechers: resp.readUInt32BE(12),
    seeders: resp.readUInt32BE(16),
    peers: group(resp.slice(20), 6).map((buf) => {
      return {
        ip: `${buf.readUInt8(0)}.${buf.readUInt8(1)}.${buf.readUInt8(2)}.${buf.readUInt8(3)}`,
        port: buf.readUInt16BE(4),
      };
    }),
  };
}
