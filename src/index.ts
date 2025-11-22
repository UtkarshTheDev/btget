import { downloadTorrent } from "./utils/download";
import { open } from "./utils/parser";

if (process.argv.length !== 3) {
  console.log("Usage: bun run index.ts <torrent-file>");
  process.exit(1);
}

try {
  const torrent = open(process.argv[2] as string);
  console.log("Torrent loaded:", torrent.info.name.toString());

  const filename = torrent.info.name.toString();
  downloadTorrent(torrent, filename);
  console.log("Download started for:", filename);
} catch (error) {
  console.error("Error processing torrent file:", error);
  process.exit(1);
}
