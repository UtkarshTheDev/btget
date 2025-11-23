import { Buffer } from "buffer";
import crypto from "crypto";
import dgram from "dgram";
import bencode from "bencode";
import type { Peer, Torrent } from "../types";
import { genId } from "./genId";
import group from "./group";
import { infoHash, size } from "./parser";

export function getPeers(torrent: Torrent, callback: (peers: Peer[]) => void) {
  console.log("getPeers called for torrent:", torrent.info.name.toString());
  const urlStr = torrent.announce;
  console.log("Tracker URL for getPeers:", urlStr);

  let url: URL;
  try {
    url = new URL(urlStr);
  } catch (e) {
    console.error("Invalid tracker URL:", urlStr);
    return;
  }

  if (url.protocol === 'http:' || url.protocol === 'https:') {
    getPeersHttp(torrent, urlStr, callback);
  } else if (url.protocol === 'udp:') {
    getPeersUdp(torrent, urlStr, callback);
  } else {
    console.error("Unsupported tracker protocol:", url.protocol);
  }
}

function getPeersUdp(torrent: Torrent, url: string, callback: (peers: Peer[]) => void) {
  const socket = dgram.createSocket("udp4");
  
  udpSend(socket, buildConnReq(), url, callback);

  const timeout = setTimeout(() => {
    console.error("Tracker request timed out.");
    socket.close();
    callback([]);
  }, 5000);

  socket.on("message", (msg) => {
    clearTimeout(timeout); // Clear the timeout as we received a response
    console.log("Message received from tracker:", msg);
    if (respType(msg) === "connect") {
      console.log("Tracker connect response received.");
      const connResp = parseConnResp(msg);
      const announceReq = buildAnnounceReq(connResp.connectionId, torrent);
      udpSend(socket, announceReq, url, callback);
    } else if (respType(msg) === "announce") {
      console.log("Tracker announce response received.");
      const announceResp = parseAnnounceResp(msg);
      callback(announceResp.peers);
    }
  });

  socket.on("listening", () => {
    console.log("UDP socket listening.");
  });

  socket.on("error", (err) => {
    clearTimeout(timeout);
    console.error("UDP socket error:", err);
    socket.close();
  });
}

async function getPeersHttp(torrent: Torrent, urlStr: string, callback: (peers: Peer[]) => void) {
  console.log("Sending HTTP request to tracker:", urlStr);
  
  const infoHashBuf = infoHash(torrent);
  const peerIdBuf = genId();
  
  // Manually construct query string because URLSearchParams encodes differently than what trackers expect for binary data
  let query = `?info_hash=${escapeBytes(infoHashBuf)}&peer_id=${escapeBytes(peerIdBuf)}`;
  query += `&port=6881&uploaded=0&downloaded=0&left=${size(torrent)}&compact=1`;

  const fullUrl = urlStr + query;
  console.log("Full HTTP Tracker URL:", fullUrl);

  try {
    const response = await fetch(fullUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const decoded = bencode.decode(buffer);
    console.log("HTTP Tracker response decoded.");
    
    if (decoded.failure) {
      console.error("Tracker returned failure:", decoded.failure.toString());
      callback([]);
      return;
    }

    if (decoded.peers) {
      let peers: Peer[] = [];
      if (Buffer.isBuffer(decoded.peers) || decoded.peers instanceof Uint8Array) {
        // Binary model - convert Uint8Array to Buffer if needed
        const peerBuffer = Buffer.isBuffer(decoded.peers) ? decoded.peers : Buffer.from(decoded.peers);
        console.log(`Parsing binary peer data: ${peerBuffer.length} bytes`);
        peers = group(peerBuffer, 6).map((buf) => {
          return {
            ip: `${buf.readUInt8(0)}.${buf.readUInt8(1)}.${buf.readUInt8(2)}.${buf.readUInt8(3)}`,
            port: buf.readUInt16BE(4),
          };
        });
      } else if (Array.isArray(decoded.peers)) {
        // Dictionary model (list of dicts)
        peers = decoded.peers.map((peer: any) => {
          // Peer might be Buffer keys if bencode decoded it that way
          // Ensure we convert Buffer/Uint8Array to string
          let ip = peer.ip;
          if (ip) {
             // If it's a buffer or array like object of bytes, convert to string
             if (Buffer.isBuffer(ip) || ArrayBuffer.isView(ip) || Array.isArray(ip)) {
               ip = Buffer.from(ip as any).toString('utf8');
             }
          }
          const port = peer.port;
          return { ip, port };
        }).filter((p: any) => p.ip && p.port);
      }
      console.log(`Found ${peers.length} peers from HTTP tracker.`);
      console.log("Peers:", peers.map(p => `${p.ip}:${p.port}`).join(", "));
      
      if (decoded.peers6) {
        if (Buffer.isBuffer(decoded.peers6)) {
           const peers6 = group(decoded.peers6, 18).map((buf) => {
            return {
              ip: `${buf.readUInt16BE(0).toString(16)}:${buf.readUInt16BE(2).toString(16)}:${buf.readUInt16BE(4).toString(16)}:${buf.readUInt16BE(6).toString(16)}:${buf.readUInt16BE(8).toString(16)}:${buf.readUInt16BE(10).toString(16)}:${buf.readUInt16BE(12).toString(16)}:${buf.readUInt16BE(14).toString(16)}`,
              port: buf.readUInt16BE(16),
            };
          });
          console.log(`Found ${peers6.length} IPv6 peers from HTTP tracker.`);
          peers = peers.concat(peers6);
        }
      }
      
      callback(peers);
    } else {
      console.log("No peers found in HTTP tracker response.");
      callback([]);
    }

  } catch (err) {
    console.error("HTTP Tracker Error:", err);
    callback([]);
  }
}

function escapeBytes(buf: Buffer): string {
  let str = '';
  for (let i = 0; i < buf.length; i++) {
    str += '%' + buf[i].toString(16).padStart(2, '0');
  }
  return str;
}

function udpSend(
  socket: dgram.Socket,
  msg: Buffer,
  rawUrl: string,
  callback: (peers: Peer[]) => void
) {
  console.log("Sending UDP message to:", rawUrl);
  const url = new URL(rawUrl);
  const port = url.port ? Number.parseInt(url.port, 10) : 6969; // Use port 6969 as default

  socket.send(
    msg,
    0,
    msg.length,
    port,
    url.hostname,
    (err: Error | null) => {
      if (err) {
        console.error("UDP Send Error:", err);
        callback([]);
        socket.close();
      } else {
        console.log("UDP message sent successfully.");
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
