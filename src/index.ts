import { download } from "./utils/download";
import { open } from "./utils/parser";

const torrent = open(process.argv[2]);
console.log(torrent);

download(torrent, torrent.info.name);
