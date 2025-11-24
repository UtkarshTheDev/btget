import { Socket } from "node:net";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import cliProgress from "cli-progress";
import type { Peer, Torrent, File } from "../types/index.js";
import { getPeers } from "./tracker.js";
import { buildHandshake, buildInterested, buildRequest, parse, type ParsedMessage, type PiecePayload, type RequestPayload } from "./messages.js";
import Queue from "./queue.js";
import Pieces from "./pieces.js";
import { size } from "./parser.js";


interface FileEntry {
  handle: fs.FileHandle;
  path: string;
  offset: bigint;
  length: bigint;
}

interface ExtendedSocket extends Socket {
  pendingRequests?: number;
}

let torrentFiles: FileEntry[] = [];
let totalTorrentSize: bigint = BigInt(0);
let totalDownloaded = 0; // Total downloaded for progress bar

const sockets: ExtendedSocket[] = []; // Keep track of all sockets

export async function downloadTorrent(torrent: Torrent, outputDirPath: string): Promise<void> {
  const torrentName = torrent.info.name.toString();
  const isMultiFile = !!torrent.info.files;
  totalTorrentSize = size(torrent);

  try {
    await fs.mkdir(outputDirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      console.error(`Error creating output directory ${outputDirPath}:`, error);
      throw error;
    }
  }

  try {
    if (isMultiFile) {
      let currentGlobalOffset: bigint = BigInt(0);
      torrentFiles = [];
      for (const fileInfo of (torrent.info.files as File[])) {
        const filePathParts = fileInfo.path.map((p: Buffer) => p.toString());
        const fullFilePath = path.join(outputDirPath, torrentName, ...filePathParts);
        const fileDir = path.dirname(fullFilePath);
        await fs.mkdir(fileDir, { recursive: true });
        const handle = await fs.open(fullFilePath, "w+"); // w+ for reading and writing
        torrentFiles.push({ handle, path: fullFilePath, offset: currentGlobalOffset, length: BigInt(fileInfo.length) });
        currentGlobalOffset += BigInt(fileInfo.length);
      }
    } else {
      const fullFilePath = path.join(outputDirPath, torrentName);
      const handle = await fs.open(fullFilePath, "w+");
      torrentFiles.push({ handle, path: fullFilePath, offset: BigInt(0), length: totalTorrentSize });
    }
  } catch (err) {
    console.error("Error opening files:", err);
    throw err;
  }

  // Initialize Progress Bar
  const progressBar = new cliProgress.SingleBar({
    format: `Downloading ${torrentName} | {bar} | {percentage}% | Speed: {speed} KB/s | Peers: {peers} | {value_formatted}/{total_formatted}`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });
  const totalMB = Number(totalTorrentSize) / (1024 * 1024);
  progressBar.start(Number(totalTorrentSize), 0, { speed: "N/A", peers: 0, value_formatted: "0 MB", total_formatted: `${totalMB.toFixed(2)} MB` });

  // Reset global state
  totalDownloaded = 0;
  speedDownloaded = 0;
  lastTimestamp = Date.now();

  return new Promise((resolve) => {
    const pieces = new Pieces(torrent);
    let downloadComplete = false;
    let activePeerCount = 0;

    // Single resolve function to prevent multiple completions
    const resolveOnce = () => {
      if (!downloadComplete) {
        downloadComplete = true;
        resolve();
      }
    };

    const allPeers: Peer[] = [];

    getPeers(torrent, (peers: Peer[]) => {
      if (downloadComplete) return;
      
      // Add new peers to our collection
      allPeers.push(...peers);
      
      // Update peer count display
      progressBar.update({ peers: allPeers.length });
      
      // Start downloading with new peers
      peers.forEach((peer) => {
        if (!downloadComplete) {
          activePeerCount++;
          download(peer, torrent, pieces, torrentFiles, progressBar, () => {
            activePeerCount--;
            if (pieces.isDone() || activePeerCount === 0) {
              resolveOnce();
            }
          });
        }
      });

      if (allPeers.length === 0) {
        progressBar.stop();
        console.error("No peers found. Cannot download.");
        cleanup().then(resolveOnce);
        return;
      }
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log("\nCaught interrupt signal. Shutting down gracefully...");
      downloadComplete = true;
      progressBar.stop();
      sockets.forEach(socket => socket.destroy());
      await cleanup();
      process.exit();
    });
  });
}

async function cleanup() {
  for (const file of torrentFiles) {
    try {
      await file.handle.close();
    } catch (e) {
      // ignore
    }
  }
}

function download(peer: Peer, torrent: Torrent, pieces: Pieces, torrentFiles: FileEntry[], progressBar: cliProgress.SingleBar, resolve: () => void) {
  const socket = new Socket() as ExtendedSocket;
  sockets.push(socket);
  socket.setTimeout(15000);
  socket.connect(peer.port, peer.ip, () => {
    socket.write(buildHandshake(torrent));
  });

  socket.on("error", () => socket.destroy());
  socket.on("timeout", () => socket.destroy());
  socket.on("close", () => {
    const index = sockets.indexOf(socket);
    if (index > -1) sockets.splice(index, 1);
  });

  const queue = new Queue(torrent);
  const totalPieces = torrent.info.pieces.length / 20;
  for (let i = 0; i < totalPieces; i++) {
    queue.queue(i);
  }
  
  onWholeMsg(socket, (msg) => msgHandler(msg, socket, pieces, queue, torrent, torrentFiles, progressBar, resolve));
}

function onWholeMsg(socket: Socket, callback: (data: Buffer) => void) {
  let savedBuf = Buffer.alloc(0);
  let handshake = true;
  socket.on("data", (recvBuf: Buffer) => {
    savedBuf = Buffer.concat([savedBuf, recvBuf]);
    const getMessageLength = (): number => {
      if (handshake && savedBuf.length >= 68) return 68;
      if (!handshake && savedBuf.length >= 4) return savedBuf.readInt32BE(0) + 4;
      return -1;
    };
    let msgLen = getMessageLength();
    while (msgLen > 0 && savedBuf.length >= msgLen) {
      callback(savedBuf.slice(0, msgLen));
      savedBuf = savedBuf.slice(msgLen);
      handshake = false;
      msgLen = getMessageLength();
    }
  });
}

function msgHandler(msg: Buffer, socket: ExtendedSocket, pieces: Pieces, queue: Queue, torrent: Torrent, torrentFiles: FileEntry[], progressBar: cliProgress.SingleBar, resolve: () => void) {
  if (isHandshake(msg)) {
    socket.write(buildInterested());
  } else {
    const m: ParsedMessage = parse(msg);
    switch (m.id) {
      case 0: chokeHandler(socket, queue); break;
      case 1: unchokeHandler(socket, pieces, queue); break;
      case 4: haveHandler(socket, pieces, queue, m.payload as number); break;
      case 5: bitfieldHandler(socket, pieces, queue); break;
      case 7: pieceHandler(socket, pieces, queue, torrent, torrentFiles, m.payload as PiecePayload, progressBar, resolve); break;
    }
  }
}

function isHandshake(msg: Buffer): boolean {
  return msg.length === 68 && msg.readUInt8(0) === 19 && msg.toString("utf8", 1, 20) === "BitTorrent protocol";
}

function chokeHandler(socket: ExtendedSocket, queue: Queue) {
  queue.choked = true;
  socket.pendingRequests = 0; // Reset pending requests on choke
}

function unchokeHandler(socket: ExtendedSocket, pieces: Pieces, queue: Queue) {
  queue.choked = false;
  requestPiece(socket, pieces, queue);
}

const MAX_PIPELINE = 5;

function requestPiece(socket: ExtendedSocket, pieces: Pieces, queue: Queue) {
  if (queue.choked) return;
  
  socket.pendingRequests = socket.pendingRequests || 0;

  while (queue.length() && socket.pendingRequests < MAX_PIPELINE) {
    const pieceBlock = queue.deque();
    if (pieceBlock) {
      if (pieces.needed(pieceBlock)) {
        socket.write(buildRequest(pieceBlock as RequestPayload));
        pieces.addRequested(pieceBlock);
        socket.pendingRequests++;
      }
    } else {
      break;
    }
  }
}

function haveHandler(socket: ExtendedSocket, pieces: Pieces, queue: Queue, pieceIndex: number) {
  const pieceBlock = queue.deque();
  if (pieceBlock && pieces.needed(pieceBlock)) {
      socket.write(buildRequest(pieceBlock as RequestPayload));
      pieces.addRequested(pieceBlock);
      socket.pendingRequests = (socket.pendingRequests || 0) + 1;
  }
  queue.queue(pieceIndex);
}

function bitfieldHandler(socket: ExtendedSocket, pieces: Pieces, queue: Queue) {
  unchokeHandler(socket, pieces, queue);
}

let speedDownloaded = 0;
let lastTimestamp = Date.now();

async function pieceHandler(socket: ExtendedSocket, pieces: Pieces, queue: Queue, torrent: Torrent, torrentFiles: FileEntry[], pieceResp: PiecePayload, progressBar: cliProgress.SingleBar, resolve: () => void) {
  const pieceLength = pieceResp.block.length;
  speedDownloaded += pieceLength;
  totalDownloaded += pieceLength;
  pieces.addReceived(pieceResp);
  
  if (socket.pendingRequests && socket.pendingRequests > 0) {
    socket.pendingRequests--;
  }

  const now = Date.now();
  const diff = now - lastTimestamp;
  if (diff > 1000) { // Update speed every second
    const speed = (speedDownloaded / diff) * 1000 / 1024; // KB/s
    const downloadedMB = (totalDownloaded / (1024 * 1024)).toFixed(2);
    const totalMB = (Number(totalTorrentSize) / (1024 * 1024)).toFixed(2);
    progressBar.update(totalDownloaded, { speed: speed.toFixed(2), value_formatted: `${downloadedMB} MB`, total_formatted: `${totalMB} MB` });
    lastTimestamp = now;
    speedDownloaded = 0;
  } else {
    progressBar.update(totalDownloaded);
  }

  const globalOffset = BigInt(pieceResp.index) * BigInt(torrent.info["piece length"] as number) + BigInt(pieceResp.begin);

  try {
    for (const fileEntry of torrentFiles) {
      const fileStart = fileEntry.offset;
      const fileEnd = fileEntry.offset + fileEntry.length;
      if (globalOffset < fileEnd && globalOffset + BigInt(pieceLength) > fileStart) {
        const intersectionStart = BigInt(Math.max(Number(globalOffset), Number(fileStart)));
        const intersectionEnd = BigInt(Math.min(Number(globalOffset + BigInt(pieceLength)), Number(fileEnd)));
        const intersectionLength = intersectionEnd - intersectionStart;
        if (intersectionLength > 0) {
          const blockSliceStart = intersectionStart - globalOffset;
          const dataToWrite = pieceResp.block.subarray(Number(blockSliceStart), Number(blockSliceStart + intersectionLength));
          const localFileOffset = intersectionStart - fileEntry.offset;
          
          // Async write
          await fileEntry.handle.write(dataToWrite, 0, dataToWrite.length, Number(localFileOffset));
        }
      }
    }
  } catch (err) {
    console.error("Error writing to file:", err);
    // Potentially stop or retry
  }

  if (pieces.isDone()) {
    // Ensure we show 100% completion
    progressBar.update(Number(totalTorrentSize), { 
      speed: 'Complete', 
      value_formatted: `${(Number(totalTorrentSize) / (1024 * 1024)).toFixed(2)} MB`, 
      total_formatted: `${(Number(totalTorrentSize) / (1024 * 1024)).toFixed(2)} MB` 
    });
    progressBar.stop();
    console.log("\n✅ DOWNLOAD COMPLETE!");
    await cleanup();
    resolve();
  } else {
    requestPiece(socket, pieces, queue);
  }
}