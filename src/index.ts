import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { downloadTorrent } from "./utils/download.js";
import { open, size } from "./utils/parser.js";
import * as path from "node:path"; // Import path module

yargs(hideBin(process.argv))
  .command(
    "download <torrent-file>",
    "Download a torrent file.",
    (yargs) => {
      return yargs
        .positional("torrent-file", {
          describe: "Path to the .torrent file",
          type: "string",
          demandOption: true,
        })
        .option("output", {
          alias: "o",
          describe: "Output directory for the downloaded files.",
          type: "string",
          default: ".", // Default to current directory
        });
    },
    async (argv) => {
      try {
        const torrentFilePath = argv["torrent-file"] as string;
        const outputDirPath = path.resolve(argv.output as string); // Resolve to absolute path

        console.log(`Processing torrent file: ${torrentFilePath}`);
        const torrent = open(torrentFilePath);
        const torrentName = torrent.info.name.toString();
        
        console.log(`Torrent loaded: ${torrentName}`);
        console.log(`Files will be saved to: ${outputDirPath}`);

        await downloadTorrent(torrent, outputDirPath);
        console.log(`✅ Download completed successfully for '${torrentName}'!`);
      } catch (error: any) {
        console.error("Error:", error.message);
        process.exit(1);
      }
    }
  )
  .command(
    "info <torrent-file>",
    "Show information about a torrent file.",
    (yargs) => {
      return yargs
        .positional("torrent-file", {
          describe: "Path to the .torrent file",
          type: "string",
          demandOption: true,
        });
    },
    (argv) => {
      try {
        const torrentFilePath = argv["torrent-file"] as string;
        const torrent = open(torrentFilePath);
        
        console.log("📁 Torrent Information:");
        console.log(`   Name: ${torrent.info.name.toString()}`);
        console.log(`   Size: ${(Number(size(torrent)) / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`   Piece Length: ${torrent.info["piece length"]} bytes`);
        console.log(`   Number of Pieces: ${torrent.info.pieces.length / 20}`);
        
        if (torrent.info.files) {
          console.log(`   Files: ${torrent.info.files.length}`);
          console.log("   📄 File List:");
          torrent.info.files.forEach((file: any, index: number) => {
            const filePath = file.path.map((p: Buffer) => p.toString()).join('/');
            const fileSizeMB = (file.length / (1024 * 1024)).toFixed(2);
            console.log(`      ${index + 1}. ${filePath} (${fileSizeMB} MB)`);
          });
        } else {
          console.log("   Type: Single file");
        }
        
        if (torrent.announce) {
          console.log(`   Main Tracker: ${torrent.announce}`);
        }
        
        if (torrent["announce-list"]) {
          console.log(`   Additional Trackers: ${torrent["announce-list"].length}`);
        }
        
      } catch (error: any) {
        console.error("Error:", error.message);
        process.exit(1);
      }
    }
  )
  .demandCommand(1, "You need to specify a command.")
  .help()
  .alias("help", "h")
  .parse();
