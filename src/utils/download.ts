import { Socket } from "node:net";
import { openSync, write, closeSync } from "node:fs";
import type { Peer, Torrent } from "../types";
import { getPeers } from "./tracker";
import { buildHandshake, buildInterested, buildRequest, parse, type ParsedMessage, type PiecePayload, type RequestPayload } from "./messages";
import Queue from "./queue";
import Pieces from "./pieces";

export function downloadTorrent(torrent: Torrent, path: string) {
  getPeers(torrent, (peers: Peer[]) => {
    console.log("Found peers:", peers.length);
    if (peers.length === 0) {
      console.error("No peers found. Cannot download.");
      return;
    }
    
    const pieces = new Pieces(torrent);
    const file = openSync(path, "w"); // Open file for writing
    peers.forEach((peer) => download(peer, torrent, pieces, file));
  });
}

function download(peer: Peer, torrent: Torrent, pieces: Pieces, file: number) {
  const socket = new Socket();
  console.log(`Connecting to peer: ${peer.ip}:${peer.port}`);
  
  // Set connection timeout
  socket.setTimeout(15000); // 15 second timeout
  
  socket.connect(peer.port, peer.ip, () => {
    console.log(`Connected to peer: ${peer.ip}:${peer.port}`);
    console.log(`Sending handshake to: ${peer.ip}:${peer.port}`);
    socket.write(buildHandshake(torrent)); // Send handshake immediately
  });

  socket.on("data", (data) => {
    console.log(`Received ${data.length} bytes from peer: ${peer.ip}:${peer.port}`);
  });
  socket.on("error", (error) => {
    console.error(`Socket error with peer ${peer.ip}:${peer.port}:`, error.message);
    socket.destroy();
  });
  socket.on("end", () => {
    console.log(`Socket ended with peer ${peer.ip}:${peer.port}`);
  });
  socket.on("timeout", () => {
    console.error(`Socket timeout with peer ${peer.ip}:${peer.port}`);
    socket.destroy();
  });
  socket.on("close", (hadError) => {
    console.log(`Socket closed with peer ${peer.ip}:${peer.port}, hadError: ${hadError}`);
  });

  const queue = new Queue(torrent);
  
  // Initialize queue with all pieces that need to be downloaded
  const totalPieces = torrent.info.pieces.length / 20;
  for (let i = 0; i < totalPieces; i++) {
    queue.queue(i);
  }
  console.log(`Queued ${totalPieces} pieces for download from ${peer.ip}:${peer.port}`);
  
  onWholeMsg(socket, (msg) => msgHandler(msg, socket, pieces, queue, torrent, file, peer));
}

function onWholeMsg(socket: Socket, callback: (data: Buffer) => void) {
  let savedBuf = Buffer.alloc(0);
  let handshake = true;

  socket.on("data", (recvBuf: Buffer) => {
    savedBuf = Buffer.concat([savedBuf, recvBuf]);

    // Function to calculate message length
    const getMessageLength = (): number => {
      if (handshake && savedBuf.length >= 68) {
        return 68;
      } else if (!handshake && savedBuf.length >= 4) {
        return savedBuf.readInt32BE(0) + 4;
      }
      return -1;
    };

    let msgLen = getMessageLength();
    while (msgLen !== -1 && savedBuf.length >= msgLen) {
      callback(savedBuf.slice(0, msgLen));
      savedBuf = savedBuf.slice(msgLen);
      if (handshake) {
        handshake = false;
        msgLen = getMessageLength();
      } else {
        msgLen = getMessageLength();
      }
    }
  });
}

function msgHandler(
  msg: Buffer,
  socket: Socket,
  pieces: Pieces,
  queue: Queue,
  torrent: Torrent,
  file: number,
  peer: Peer
) {
  if (isHandshake(msg)) {
    console.log(`Handshake received from: ${peer.ip}:${peer.port}`);
    socket.write(buildInterested());
  } else {
    const m: ParsedMessage = parse(msg);
    console.log(`Message received from ${peer.ip}:${peer.port}: ID=${m.id}`);

    switch (m.id) {
      case 0: // Choke
        chokeHandler(queue, peer);
        break;
      case 1: // Unchoke
        unchokeHandler(socket, pieces, queue, peer);
        break;
      case 4: // Have
        haveHandler(m.payload as number, peer);
        break;
      case 5: // Bitfield
        bitfieldHandler(m.payload as Buffer, peer);
        break;
      case 7: // Piece
        pieceHandler(socket, pieces, queue, torrent, file, m.payload as PiecePayload, peer);
        break;
      default:
        // Handle other message types or ignore
        break;
    }
  }
}

function isHandshake(msg: Buffer): boolean {
  return (
    msg.length === 68 &&
    msg.readUInt8(0) === 19 &&
    msg.toString("utf8", 1, 20) === "BitTorrent protocol"
  );
}

function chokeHandler(queue: Queue, peer: Peer) {
  queue.choked = true;
  console.log(`Choked by peer: ${peer.ip}:${peer.port}`);
}

function unchokeHandler(socket: Socket, pieces: Pieces, queue: Queue, peer: Peer) {
  queue.choked = false;
  console.log(`Unchoked by peer: ${peer.ip}:${peer.port}`);
  requestPiece(socket, pieces, queue, peer);
}

function requestPiece(socket: Socket, pieces: Pieces, queue: Queue, peer: Peer) {
  if (queue.choked) {
    console.log(`Queue is choked, not requesting piece from ${peer.ip}:${peer.port}`);
    return;
  }

  if (queue.length() === 0) {
    console.log(`Queue is empty, not requesting piece from ${peer.ip}:${peer.port}`);
    return;
  }

  while (queue.length() > 0) {
    const pieceBlock = queue.peek();
    if (!pieceBlock) return;

    if (pieces.needed(pieceBlock)) {
      console.log(`Requesting piece ${pieceBlock.index}, block ${pieceBlock.begin} from ${peer.ip}:${peer.port}`);
      socket.write(buildRequest(pieceBlock as RequestPayload));
      pieces.addRequested(pieceBlock);
      queue.deque();
      break;
    } else {
      queue.deque();
    }
  }
}

function haveHandler(pieceIndex: number, peer: Peer) {
  console.log(`Received 'have' message for piece ${pieceIndex} from ${peer.ip}:${peer.port}`);
}

function bitfieldHandler(bitfield: Buffer, peer: Peer) {
  console.log(`Received bitfield from ${peer.ip}:${peer.port}:`, bitfield.toString('hex'));
}

function pieceHandler(
  socket: Socket,
  pieces: Pieces,
  queue: Queue,
  torrent: Torrent,
  file: number,
  pieceResp: PiecePayload,
  peer: Peer
) {
  console.log(`Received piece block ${pieceResp.index}, block ${pieceResp.begin} from ${peer.ip}:${peer.port}`);
  pieces.addReceived(pieceResp);

  const offset =
    pieceResp.index * (torrent.info["piece length"] as number) + pieceResp.begin;
  write(file, pieceResp.block, 0, pieceResp.block.length, offset, (err) => {
    if (err) console.error(`File write error for piece ${pieceResp.index}:`, err);
  });

  if (pieces.isDone()) {
    console.log("DOWNLOAD COMPLETE!");
    socket.end();
    closeSync(file);
  } else {
    requestPiece(socket, pieces, queue, peer);
  }
}