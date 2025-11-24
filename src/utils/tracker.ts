import { Buffer } from "buffer";
import crypto from "crypto";
import dgram from "dgram";
import bencode from "bencode";
import type { Peer, Torrent } from "../types/index";
import { genId } from "./genId";
import group from "./group";
import { infoHash, size } from "./parser";

export function getPeers(torrent: Torrent, callback: (peers: Peer[]) => void) {
  console.log("getPeers called for torrent:", torrent.info.name.toString());
  
  const urls = new Set<string>();
  if (torrent.announce) {
    urls.add(torrent.announce);
  }
  if (torrent["announce-list"]) {
    torrent["announce-list"].forEach(tier => {
      tier.forEach(url => urls.add(url));
    });
  }

  console.log(`Found ${urls.size} tracker URLs.`);
  
  const seenPeers = new Set<string>();
  const allPeers: Peer[] = [];
  let completedTrackers = 0;
  let callbackCalled = false;
  const totalTrackers = urls.size;

  if (totalTrackers === 0) {
    callback([]);
    return;
  }

  // Set a timeout to ensure we don't wait forever
  const timeout = setTimeout(() => {
    if (!callbackCalled) {
      callbackCalled = true;
      if (allPeers.length > 0) {
        callback([...allPeers]);
      } else {
        callback([]);
      }
    }
  }, 10000); // 10 second timeout

  urls.forEach(urlStr => {
    getPeersFromUrl(torrent, urlStr, (peers) => {
      if (callbackCalled) return;
      
      const newPeers = peers.filter(p => {
        const key = `${p.ip}:${p.port}`;
        if (seenPeers.has(key)) return false;
        seenPeers.add(key);
        return true;
      });
      
      if (newPeers.length > 0) {
        console.log(`Got ${newPeers.length} new peers from ${urlStr}`);
        allPeers.push(...newPeers);
      }
      
      completedTrackers++;
      
      // Call callback once when all trackers complete or we have enough peers
      if (completedTrackers === totalTrackers || allPeers.length >= 20) {
        if (!callbackCalled) {
          callbackCalled = true;
          clearTimeout(timeout);
          callback([...allPeers]);
        }
      }
    });
  });
}

function getPeersFromUrl(torrent: Torrent, urlStr: string, callback: (peers: Peer[]) => void) {
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
    // console.warn("Unsupported tracker protocol:", url.protocol);
  }
}

function getPeersUdp(torrent: Torrent, url: string, callback: (peers: Peer[]) => void) {
  const socket = dgram.createSocket("udp4");
  
  // Set a timeout for the entire transaction
  const transactionTimeout = setTimeout(() => {
    // console.error(`UDP Tracker timeout for ${url}`);
    try { socket.close(); } catch(e) {}
  }, 15000);

  udpSend(socket, buildConnReq(), url, (err) => {
      if (err) {
          clearTimeout(transactionTimeout);
          try { socket.close(); } catch(e) {}
      }
  });

  socket.on("message", (msg) => {
    if (respType(msg) === "connect") {
      const connResp = parseConnResp(msg);
      const announceReq = buildAnnounceReq(connResp.connectionId, torrent);
      udpSend(socket, announceReq, url, () => {});
    } else if (respType(msg) === "announce") {
      clearTimeout(transactionTimeout);
      const announceResp = parseAnnounceResp(msg);
      callback(announceResp.peers);
      try { socket.close(); } catch(e) {}
    }
  });

  socket.on("error", () => {
    clearTimeout(transactionTimeout);
    // console.error(`UDP socket error for ${url}:`, err.message);
    try { socket.close(); } catch(e) {}
  });
}

async function getPeersHttp(torrent: Torrent, urlStr: string, callback: (peers: Peer[]) => void) {
  // console.log("Sending HTTP request to tracker:", urlStr);
  
  const infoHashBuf = infoHash(torrent);
  const peerIdBuf = genId();
  
  let query = `?info_hash=${escapeBytes(infoHashBuf)}&peer_id=${escapeBytes(peerIdBuf)}`;
  query += `&port=6881&uploaded=0&downloaded=0&left=${size(torrent)}&compact=1`;

  const fullUrl = urlStr + query;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(fullUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const decoded = bencode.decode(buffer);
    
    if (decoded.failure) {
      // console.error(`Tracker ${urlStr} returned failure:`, decoded.failure.toString());
      return;
    }

    if (decoded.peers) {
      let peers: Peer[] = [];
      if (Buffer.isBuffer(decoded.peers) || decoded.peers instanceof Uint8Array) {
        const peerBuffer = Buffer.isBuffer(decoded.peers) ? decoded.peers : Buffer.from(decoded.peers);
        peers = group(peerBuffer, 6).map((buf) => {
          return {
            ip: `${buf.readUInt8(0)}.${buf.readUInt8(1)}.${buf.readUInt8(2)}.${buf.readUInt8(3)}`,
            port: buf.readUInt16BE(4),
          };
        });
      } else if (Array.isArray(decoded.peers)) {
        peers = decoded.peers.map((peer: any) => {
          let ip = peer.ip;
          if (ip) {
             if (Buffer.isBuffer(ip) || ArrayBuffer.isView(ip) || Array.isArray(ip)) {
               ip = Buffer.from(ip as any).toString('utf8');
             }
          }
          const port = peer.port;
          return { ip, port };
        }).filter((p: any) => p.ip && p.port);
      }
      
      if (decoded.peers6) {
        if (Buffer.isBuffer(decoded.peers6)) {
           const peers6 = group(decoded.peers6, 18).map((buf) => {
            return {
              ip: `${buf.readUInt16BE(0).toString(16)}:${buf.readUInt16BE(2).toString(16)}:${buf.readUInt16BE(4).toString(16)}:${buf.readUInt16BE(6).toString(16)}:${buf.readUInt16BE(8).toString(16)}:${buf.readUInt16BE(10).toString(16)}:${buf.readUInt16BE(12).toString(16)}:${buf.readUInt16BE(14).toString(16)}`,
              port: buf.readUInt16BE(16),
            };
          });
          peers = peers.concat(peers6);
        }
      }
      
      callback(peers);
    }

  } catch {
    // console.error(`HTTP Tracker Error for ${urlStr}:`, err);
  }
}

function escapeBytes(buf: Buffer): string {
  let str = '';
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    if (byte !== undefined) {
      str += '%' + byte.toString(16).padStart(2, '0');
    }
  }
  return str;
}

function udpSend(
  socket: dgram.Socket,
  msg: Buffer,
  rawUrl: string,
  callback: (err?: Error) => void
) {
  let url: URL;
  try {
      url = new URL(rawUrl);
  } catch(e) {
      callback(new Error("Invalid URL"));
      return;
  }
  const port = url.port ? Number.parseInt(url.port, 10) : 6969;

  socket.send(
    msg,
    0,
    msg.length,
    port,
    url.hostname,
    (err: Error | null) => {
      if (err) {
        callback(err);
      } else {
        callback();
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

  buf.writeUInt32BE(0x4_17_27_10, 0);
  buf.writeUInt32BE(0x19_80, 4);
  buf.writeUInt32BE(0, 8);

  crypto.randomBytes(4).copy(buf, 12);

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
  connId.copy(buf, 0);
  buf.writeUInt32BE(1, 8);
  crypto.randomBytes(4).copy(buf, 12);

  infoHash(torrent).copy(buf, 16);
  genId().copy(buf, 36);
  Buffer.alloc(8).copy(buf, 56);
  const torrentSize = size(torrent);
  const sizeBuf = Buffer.alloc(8);
  sizeBuf.writeBigInt64BE(torrentSize, 0);
  sizeBuf.copy(buf, 64);
  Buffer.alloc(8).copy(buf, 72);
  buf.writeUInt32BE(0, 80);
  buf.writeUInt32BE(0, 84);
  crypto.randomBytes(4).copy(buf, 88);
  buf.writeInt32BE(-1, 92);
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
