import { downloadTorrent } from "./utils/download";
import { open } from "./utils/parser";

if (process.argv.length !== 3) {
  console.log("Usage: bun run index.ts <torrent-file>");
  process.exit(1);
}

try {
  const torrent = open(process.argv[2] as string);
  const torrentName = torrent.info.name.toString();
  console.log("Torrent loaded:", torrentName);

  // For multi-file torrents, create a directory; for single-file, use the name as filename
  const downloadPath = torrent.info.files ? torrentName : torrentName;
  
  downloadTorrent(torrent, downloadPath);
  console.log("Download started for:", downloadPath);
  console.log("Torrent type:", torrent.info.files ? "Multi-file" : "Single-file");
  if (torrent.info.files) {
    console.log("Files in torrent:", torrent.info.files.length);
  }
} catch (error) {
  console.error("Error processing torrent file:", error);
  process.exit(1);
}
