import { Socket } from "node:net";
import type { Peer, Torrent } from "../types";
import { getPeers } from "./tracker";
import { buildInterested, buildRequest } from "./messages";

export function torrent(torrents: Torrent) {
  getPeers(torrents, (peers) => {
    peers.forEach(download);
  });
}

function download(peer: Peer) {
  const socket = new Socket();
  socket.connect(peer.port, peer.ip);
  socket.on("data", (data) => {
    console.log(data);
  });
  socket.on("error", (error) => {
    console.error(error);
  });
  socket.on("end", () => {
    console.log("end");
  });
}

function onWholeMsg(socket: Socket, callback: (data: Buffer) => void) {
  let savedBuf = Buffer.alloc(0);
  let handshake = true;

  socket.on("data", (recvBuf) => {
    // msgLen calculates the length of a whole message
    const msgLen = () =>
      handshake ? savedBuf.readUInt8(0) + 49 : savedBuf.readInt32BE(0) + 4;
    savedBuf = Buffer.concat([savedBuf, recvBuf]);

    while (savedBuf.length >= 4 && savedBuf.length >= msgLen()) {
      callback(savedBuf.slice(0, msgLen()));
      savedBuf = savedBuf.slice(msgLen());
      handshake = false;
    }
  });
}

// 1
function msgHandler(msg, socket, pieces, queue) {
  if (isHandshake(msg)) {
    socket.write(buildInterested());
  } else {
    const m = parse(msg);

    if (m.id === 0) chokeHandler(socket);
    // 1
    if (m.id === 1) unchokeHandler(socket, pieces, queue);
    if (m.id === 4) haveHandler(m.payload);
    if (m.id === 5) bitfieldHandler(m.payload);
    if (m.id === 7) pieceHandler(m.payload);
  }
}

function isHandshake(msg) {
  return (
    msg.length === msg.readUInt8(0) + 49 &&
    msg.toString("utf8", 1) === "BitTorrent protocol"
  );
}

function chokeHandler(socket) {
  socket.end();
}

// 1
function unchokeHandler(socket, pieces, queue) {
  queue.choked = false;
  // 2
  requestPiece(socket, pieces, queue);
}

function haveHandler() {
  // ...
}

function bitfieldHandler() {
  // ...
}

function pieceHandler() {
  // ...
}

//1
function requestPiece(socket, pieces, queue) {
  //2
  if (queue.choked) return null;

  while (queue.queue.length) {
    const pieceIndex = queue.shift();
    if (pieces.needed(pieceIndex)) {
      // need to fix this
      socket.write(buildRequest(pieceIndex));
      pieces.addRequested(pieceIndex);
      break;
    }
  }
}
