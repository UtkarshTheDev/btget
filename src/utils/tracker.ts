import { Buffer } from "buffer";
import crypto from "crypto";
import dgram from "dgram";
import bencode from "bencode";
import type { Peer, Torrent } from "../types/index";
import { genId } from "./genId";
import group from "./group";
import { infoHash, size } from "./parser";
import { SimpleDHT } from "./dht";

export function getPeers(torrent: Torrent, callback: (peers: Peer[]) => void) {
  console.log("🔍 Searching for peers for:", torrent.info.name.toString());
  
  const urls = new Set<string>();
  
  // Add announce URL
  if (torrent.announce) {
    urls.add(torrent.announce);
  }
  
  // Add announce-list URLs
  if (torrent["announce-list"]) {
    torrent["announce-list"].forEach(tier => {
      tier.forEach(url => urls.add(url));
    });
  }

  // Add some popular public trackers as backup
  const backupTrackers = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://tracker.openbittorrent.com:6969/announce',
    'udp://9.rarbg.to:2710/announce',
    'udp://tracker.coppersurfer.tk:6969/announce',
    'udp://exodus.desync.com:6969/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://open.stealth.si:80/announce'
  ];
  
  backupTrackers.forEach(url => urls.add(url));
  
  console.log(`📡 Contacting ${urls.size} trackers...`);
  
  const seenPeers = new Set<string>();
  const allPeers: Peer[] = [];
  let completedTrackers = 0;
  let successfulTrackers = 0;
  let callbackCalled = false;
  const totalTrackers = urls.size;

  if (totalTrackers === 0) {
    callback([]);
    return;
  }

  // Enhanced timeout with progressive callback strategy
  const progressiveTimeout = setTimeout(() => {
    if (!callbackCalled && allPeers.length > 0) {
      callbackCalled = true;
      console.log(`⚡ Quick start with ${allPeers.length} peers (${successfulTrackers}/${totalTrackers} trackers responded)`);
      callback([...allPeers]);
    }
  }, 2000); // Faster start after 2 seconds if we have some peers

  const finalTimeout = setTimeout(() => {
    if (!callbackCalled) {
      callbackCalled = true;
      clearTimeout(progressiveTimeout);
      if (allPeers.length > 0) {
        console.log(`🚀 Starting with ${allPeers.length} peers from ${successfulTrackers}/${totalTrackers} trackers`);
        callback([...allPeers]);
      } else {
        console.error("❌ No trackers returned peers - trying with DHT fallback");
        // Try DHT as absolute fallback
        tryDHTFallback(torrent, callback);
      }
    }
  }, 45000); // Maximum 45 second wait

  // Contact trackers with staggered requests to avoid overwhelming
  const trackerArray = Array.from(urls);
  
  const processTracker = (index: number) => {
    if (index >= trackerArray.length || callbackCalled) return;
    
    const urlStr = trackerArray[index];
    if (!urlStr) return;
    
    getPeersFromUrl(torrent, urlStr, (peers) => {
      if (callbackCalled) return;
      
      const newPeers = peers.filter(p => {
        // Validate peer
        if (!p.ip || !p.port || p.port < 1 || p.port > 65535) return false;
        // Only filter out invalid addresses, allow IPv6 and private networks
        if (p.ip === '0.0.0.0' || p.ip.startsWith('127.')) return false;
        
        const key = `${p.ip}:${p.port}`;
        if (seenPeers.has(key)) return false;
        seenPeers.add(key);
        return true;
      });
      
      if (newPeers.length > 0) {
        console.log(`✅ ${newPeers.length} peers from ${urlStr.substring(0, 50)}...`);
        allPeers.push(...newPeers);
        successfulTrackers++;
        
        // If we get a good amount of peers quickly, start download
        if (allPeers.length >= 30 && !callbackCalled) {
          callbackCalled = true;
          clearTimeout(progressiveTimeout);
          clearTimeout(finalTimeout);
          console.log(`🚀 Excellent peer count reached! Starting with ${allPeers.length} peers`);
          callback([...allPeers]);
          return;
        }
      }
      
      completedTrackers++;
      
      // If all trackers completed, use what we have
      if (completedTrackers === totalTrackers && !callbackCalled) {
        callbackCalled = true;
        clearTimeout(progressiveTimeout);
        clearTimeout(finalTimeout);
        
        if (allPeers.length > 0) {
          console.log(`🏁 All trackers done. Starting with ${allPeers.length} peers`);
          callback([...allPeers]);
        } else {
          console.error("❌ No peers found from any tracker");
          tryDHTFallback(torrent, callback);
        }
      }
      
      // Process next tracker with small delay
      setTimeout(() => processTracker(index + 1), 100);
    });
  };

  // Start processing trackers
  processTracker(0);
}

/**
 * Fallback to DHT when all trackers fail
 */
async function tryDHTFallback(torrent: Torrent, callback: (peers: Peer[]) => void): Promise<void> {
  try {
    console.log("🕸️  Trying DHT as fallback...");
    const dht = new SimpleDHT();
    const peers = await dht.findPeers(torrent, 20000); // 20 second DHT timeout
    
    if (peers.length > 0) {
      console.log(`🎯 DHT found ${peers.length} peers!`);
      callback(peers);
    } else {
      console.log("❌ DHT also found no peers");
      callback([]);
    }
  } catch (error) {
    console.log("❌ DHT failed:", error);
    callback([]);
  }
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
  let transactionId = crypto.randomBytes(4);
  let connectionId: Buffer | null = null;
  let attempts = 0;
  const maxAttempts = 3;
  
  // Reduced timeout for faster peer discovery
  const transactionTimeout = setTimeout(() => {
    try { socket.close(); } catch(e) {}
    callback([]); // Return empty array instead of logging error
  }, 8000);

  const sendConnectRequest = () => {
    attempts++;
    transactionId = crypto.randomBytes(4);
    const connReq = buildConnReq(transactionId);
    
    udpSend(socket, connReq, url, (err) => {
      if (err && attempts < maxAttempts) {
        setTimeout(sendConnectRequest, 1000 * attempts); // Exponential backoff
      } else if (err) {
        clearTimeout(transactionTimeout);
        try { socket.close(); } catch(e) {}
        callback([]);
      }
    });
  };

  socket.on("message", (msg) => {
    try {
      if (respType(msg) === "connect") {
        const connResp = parseConnResp(msg);
        
        // Verify transaction ID matches
        if (!transactionId.equals(msg.slice(4, 8))) {
          return; // Ignore mismatched responses
        }
        
        connectionId = connResp.connectionId;
        const announceReq = buildAnnounceReq(connectionId, torrent, transactionId);
        udpSend(socket, announceReq, url, () => {});
        
      } else if (respType(msg) === "announce") {
        // Verify transaction ID matches
        if (!transactionId.equals(msg.slice(4, 8))) {
          return; // Ignore mismatched responses
        }
        
        clearTimeout(transactionTimeout);
        const announceResp = parseAnnounceResp(msg);
        
        // Filter and validate peers
        const validPeers = announceResp.peers.filter(peer => {
          return peer.ip !== '0.0.0.0' && 
                 peer.port > 0 && 
                 peer.port < 65536 &&
                 !peer.ip.startsWith('127.');
        });
        
        callback(validPeers);
        try { socket.close(); } catch(e) {}
      }
    } catch (error) {
      // Ignore malformed responses
    }
  });

  socket.on("error", () => {
    clearTimeout(transactionTimeout);
    try { socket.close(); } catch(e) {}
    callback([]);
  });

  // Start the connection process
  sendConnectRequest();
}

async function getPeersHttp(torrent: Torrent, urlStr: string, callback: (peers: Peer[]) => void) {
  const infoHashBuf = infoHash(torrent);
  const peerIdBuf = genId();
  
  // Enhanced query parameters for better tracker compatibility
  let query = `?info_hash=${escapeBytes(infoHashBuf)}&peer_id=${escapeBytes(peerIdBuf)}`;
  query += `&port=6881&uploaded=0&downloaded=0&left=${size(torrent)}`;
  query += `&compact=1&numwant=100&event=started&key=${Math.floor(Math.random() * 0xFFFFFFFF)}`;
  query += `&supportcrypto=1&no_peer_id=1`; // Enhanced parameters

  const fullUrl = urlStr + query;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
    
    const response = await fetch(fullUrl, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'µTorrent/3.5.5 (build 45852)',  // More realistic user agent
        'Accept': '*/*',
        'Accept-Encoding': 'gzip',
        'Connection': 'close'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let decoded;
    try {
      decoded = bencode.decode(buffer);
    } catch (decodeError) {
      throw new Error('Invalid bencoded response');
    }
    
    if (decoded['failure reason']) {
      throw new Error(`Tracker failure: ${decoded['failure reason']}`);
    }

    if (!decoded.peers) {
      return; // No peers available
    }

    let peers: Peer[] = [];
    
    // Handle compact format (most common)
    if (Buffer.isBuffer(decoded.peers) || decoded.peers instanceof Uint8Array) {
      const peerBuffer = Buffer.isBuffer(decoded.peers) ? decoded.peers : Buffer.from(decoded.peers);
      
      // Validate buffer length (should be multiple of 6)
      if (peerBuffer.length % 6 !== 0) {
        throw new Error('Invalid compact peer format');
      }
      
      peers = group(peerBuffer, 6).map((buf) => {
        return {
          ip: `${buf.readUInt8(0)}.${buf.readUInt8(1)}.${buf.readUInt8(2)}.${buf.readUInt8(3)}`,
          port: buf.readUInt16BE(4),
        };
      }).filter(peer => {
        // Additional validation - allow IPv6 and private networks
        return peer.ip !== '0.0.0.0' && 
               peer.port > 0 && 
               peer.port < 65536 &&
               !peer.ip.startsWith('127.');
      });
    } 
    // Handle dictionary format
    else if (Array.isArray(decoded.peers)) {
      peers = decoded.peers.map((peer: any) => {
        let ip = peer.ip;
        if (Buffer.isBuffer(ip) || ArrayBuffer.isView(ip) || Array.isArray(ip)) {
          ip = Buffer.from(ip as any).toString('utf8');
        }
        
        return { 
          ip: ip, 
          port: typeof peer.port === 'number' ? peer.port : parseInt(peer.port) 
        };
      }).filter((p: any) => {
        return p.ip && p.port && 
               typeof p.ip === 'string' && 
               typeof p.port === 'number' &&
               p.port > 0 && p.port < 65536;
      });
    }
    
    // Handle IPv6 peers if available
    if (decoded.peers6 && Buffer.isBuffer(decoded.peers6)) {
      try {
        const peers6 = group(decoded.peers6, 18).map((buf) => {
          // Construct IPv6 address
          const ipv6Parts = [];
          for (let i = 0; i < 16; i += 2) {
            ipv6Parts.push(buf.readUInt16BE(i).toString(16));
          }
          return {
            ip: ipv6Parts.join(':'),
            port: buf.readUInt16BE(16),
          };
        }).filter(peer => peer.port > 0 && peer.port < 65536);
        
        // Only add IPv6 peers if we don't have many IPv4 peers
        if (peers.length < 10) {
          peers = peers.concat(peers6.slice(0, 10));
        }
      } catch (error) {
        // Ignore IPv6 parsing errors
      }
    }
    
    // Log statistics if we got peers
    if (decoded.complete !== undefined || decoded.incomplete !== undefined) {
      const seeders = decoded.complete || 0;
      const leechers = decoded.incomplete || 0;
      console.log(`📊 Tracker stats - Seeders: ${seeders}, Leechers: ${leechers}, Peers returned: ${peers.length}`);
    }
    
    callback(peers);

  } catch (error) {
    // Only log errors for debugging, don't spam console
    // console.error(`HTTP Tracker Error for ${urlStr}:`, error.message);
    callback([]);
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

function buildConnReq(transactionId?: Buffer) {
  const buf = Buffer.alloc(16);

  // Protocol ID for BitTorrent over UDP
  buf.writeUInt32BE(0x41727101, 0);
  buf.writeUInt32BE(0x980, 4);
  
  // Action: connect (0)
  buf.writeUInt32BE(0, 8);

  // Transaction ID
  const txId = transactionId || crypto.randomBytes(4);
  txId.copy(buf, 12);

  return buf;
}

function parseConnResp(resp: Buffer) {
  return {
    action: resp.readUInt32BE(0),
    transactionId: resp.readUInt32BE(4),
    connectionId: resp.slice(8, 16),
  };
}

function buildAnnounceReq(connId: Buffer, torrent: Torrent, transactionId?: Buffer, port = 6881) {
  const buf = Buffer.alloc(98);
  
  // Connection ID (8 bytes)
  connId.copy(buf, 0);
  
  // Action: announce (1)
  buf.writeUInt32BE(1, 8);
  
  // Transaction ID (4 bytes)
  const txId = transactionId || crypto.randomBytes(4);
  txId.copy(buf, 12);

  // Info hash (20 bytes)
  infoHash(torrent).copy(buf, 16);
  
  // Peer ID (20 bytes)
  genId().copy(buf, 36);
  
  // Downloaded (8 bytes) - set to 0
  Buffer.alloc(8).copy(buf, 56);
  
  // Left (8 bytes) - remaining bytes to download
  const torrentSize = size(torrent);
  const sizeBuf = Buffer.alloc(8);
  sizeBuf.writeBigInt64BE(torrentSize, 0);
  sizeBuf.copy(buf, 64);
  
  // Uploaded (8 bytes) - set to 0
  Buffer.alloc(8).copy(buf, 72);
  
  // Event: started (0), completed (1), stopped (2)
  buf.writeUInt32BE(2, 80); // Started event
  
  // IP address (0 = default)
  buf.writeUInt32BE(0, 84);
  
  // Key (random)
  crypto.randomBytes(4).copy(buf, 88);
  
  // Num want (-1 = default)
  buf.writeInt32BE(-1, 92);
  
  // Port
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
