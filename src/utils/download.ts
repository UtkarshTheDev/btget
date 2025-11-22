import { Socket } from "node:net";
import { openSync, write, closeSync } from "node:fs";
import type { Peer, Torrent } from "../types";
import { getPeers } from "./tracker";
import { buildHandshake, buildInterested, buildRequest, parse, type ParsedMessage, type PiecePayload, type RequestPayload } from "./messages";
import Queue from "./queue";
import Pieces from "./pieces";

export function downloadTorrent(torrent: Torrent, path: string) {
  getPeers(torrent, (peers: Peer[]) => {
    const pieces = new Pieces(torrent);
    const file = openSync(path, "w"); // Open file for writing
    peers.forEach((peer) => download(peer, torrent, pieces, file));
  });
}

function download(peer: Peer, torrent: Torrent, pieces: Pieces, file: number) {
  const socket = new Socket();
  socket.connect(peer.port, peer.ip, () => {
    socket.write(buildHandshake(torrent)); // Send handshake immediately
  });

  socket.on("data", () => {
    // console.log("Received data from peer:", data.length); // Muted for less verbose output
  });
  socket.on("error", (error) => {
    console.error("Socket error:", error);
    socket.end();
  });
  socket.on("end", () => {
    console.log("Socket ended.");
  });

  const queue = new Queue(torrent);
  onWholeMsg(socket, (msg) => msgHandler(msg, socket, pieces, queue, torrent, file));
}

function onWholeMsg(socket: Socket, callback: (data: Buffer) => void) {
  let savedBuf = Buffer.alloc(0);
  let handshake = true;

  socket.on("data", (recvBuf: Buffer) => {
    savedBuf = Buffer.concat([savedBuf, recvBuf]);

    // Function to calculate message length
    const getMessageLength = (): number => {
      if (handshake && savedBuf.length >= 68) {
        // Handshake message is 68 bytes
        return 68;
      } else if (!handshake && savedBuf.length >= 4) {
        // Normal message, length is in the first 4 bytes
        return savedBuf.readInt32BE(0) + 4;
      }
      return -1; // Not enough data for a full message
    };

    let msgLen = getMessageLength();
    while (msgLen !== -1 && savedBuf.length >= msgLen) {
      callback(savedBuf.slice(0, msgLen));
      savedBuf = savedBuf.slice(msgLen);
      if (handshake) {
        handshake = false;
        msgLen = getMessageLength(); // Re-evaluate msgLen after handshake
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
  file: number
) {
  if (isHandshake(msg)) {
    socket.write(buildInterested());
  } else {
    const m: ParsedMessage = parse(msg);

    switch (m.id) {
      case 0: // Choke
        chokeHandler(queue);
        break;
      case 1: // Unchoke
        unchokeHandler(socket, pieces, queue);
        break;
      case 4: // Have
        haveHandler(m.payload as number);
        break;
      case 5: // Bitfield
        bitfieldHandler(m.payload as Buffer);
        break;
      case 7: // Piece
        pieceHandler(socket, pieces, queue, torrent, file, m.payload as PiecePayload);
        break;
      default:
        // Handle other message types or ignore
        break;
    }
  }
}

function isHandshake(msg: Buffer): boolean {
  return (
    msg.length === 68 && // Handshake messages are typically 68 bytes
    msg.readUInt8(0) === 19 && // pstrlen is 19
    msg.toString("utf8", 1, 20) === "BitTorrent protocol"
  );
}

function chokeHandler(queue: Queue) {
  queue.choked = true;
  console.log("Choked by peer.");
}

function unchokeHandler(socket: Socket, pieces: Pieces, queue: Queue) {
  queue.choked = false;
  console.log("Unchoked by peer.");
  requestPiece(socket, pieces, queue);
}

function requestPiece(socket: Socket, pieces: Pieces, queue: Queue) {
  if (queue.choked) {
    return;
  }

  while (queue.length() > 0) {
    const pieceBlock = queue.peek();
    if (!pieceBlock) return; // Should not happen if queue.length() > 0

    if (pieces.needed(pieceBlock)) {
      socket.write(buildRequest(pieceBlock as RequestPayload));
      pieces.addRequested(pieceBlock);
      queue.deque(); // Remove from queue after requesting
      break; // Request one block at a time
    } else {
      queue.deque(); // This piece block is not needed, remove it
    }
  }
}

function haveHandler(pieceIndex: number) {
  console.log("Received 'have' message for piece:", pieceIndex);
  // No direct action needed here in terms of requesting, as we rely on unchoke
  // and bitfield to know what pieces a peer has. This is mostly for informing
  // other peers about our pieces.
}

function bitfieldHandler(bitfield: Buffer) {
  console.log("Received bitfield:", bitfield.toString('hex'));
  // This bitfield tells us what pieces the peer has.
  // We can update our internal state based on this, but for now,
  // we'll rely on 'have' messages or unchoke.
}

function pieceHandler(
  socket: Socket,
  pieces: Pieces,
  queue: Queue,
  torrent: Torrent,
  file: number,
  pieceResp: PiecePayload
) {
  console.log("Received piece block:", pieceResp.index, pieceResp.begin, pieceResp.block.length);
  pieces.addReceived(pieceResp);

  const offset =
    pieceResp.index * (torrent.info["piece length"] as number) + pieceResp.begin;
  write(file, pieceResp.block, 0, pieceResp.block.length, offset, (err) => {
    if (err) console.error("File write error:", err);
  });

  if (pieces.isDone()) {
    console.log("DOWNLOAD COMPLETE!");
    socket.end();
    closeSync(file);
  } else {
    requestPiece(socket, pieces, queue);
  }
}