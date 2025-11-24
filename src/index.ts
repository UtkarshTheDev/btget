import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { downloadTorrent } from "./utils/download";
import { open, size } from "./utils/parser";
import * as path from "node:path"; // Import path module

// Handle both direct file download and command-based usage
const argv = hideBin(process.argv);

// Check if first argument is a torrent file (direct download like wget)
const isDirectDownload =
  argv.length > 0 &&
  (argv[0].endsWith(".torrent") ||
    !["download", "info", "help", "--help", "-h"].includes(argv[0]));

if (isDirectDownload) {
  // Direct download mode: btget file.torrent -o output
  yargs(argv)
    .usage("Usage: btget <torrent-file> [options]")
    .positional("torrent-file", {
      describe: "Path to the .torrent file",
      type: "string",
      demandOption: true,
    })
    .option("output", {
      alias: "o",
      describe: "Output directory for the downloaded files",
      type: "string",
      default: ".",
    })
    .example("btget movie.torrent", "Download torrent to current directory")
    .example(
      "btget movie.torrent -o ~/Downloads",
      "Download to specific directory",
    )
    .help()
    .alias("help", "h")
    .parse(argv, async (err: any, argv: any) => {
      if (err) {
        console.error("Error:", err.message);
        process.exit(1);
      }

      try {
        const torrentFilePath = argv._[0] as string;
        const outputDirPath = path.resolve(argv.output as string);

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
    });
} else {
  // Command-based mode: btget download/info file.torrent
  yargs(argv)
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
          console.log(
            `✅ Download completed successfully for '${torrentName}'!`,
          );
        } catch (error: any) {
          console.error("Error:", error.message);
          process.exit(1);
        }
      },
    )
    .command(
      "info <torrent-file>",
      "Show information about a torrent file.",
      (yargs) => {
        return yargs.positional("torrent-file", {
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
          console.log(
            `   Size: ${(Number(size(torrent)) / (1024 * 1024)).toFixed(2)} MB`,
          );
          console.log(`   Piece Length: ${torrent.info["piece length"]} bytes`);
          console.log(
            `   Number of Pieces: ${torrent.info.pieces.length / 20}`,
          );

          if (torrent.info.files) {
            console.log(`   Files: ${torrent.info.files.length}`);
            console.log("   📄 File List:");
            torrent.info.files.forEach((file: any, index: number) => {
              const filePath = file.path
                .map((p: Buffer) => p.toString())
                .join("/");
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
            console.log(
              `   Additional Trackers: ${torrent["announce-list"].length}`,
            );
          }
        } catch (error: any) {
          console.error("Error:", error.message);
          process.exit(1);
        }
      },
    )
    .demandCommand(1, "You need to specify a command or torrent file.")
    .example("btget movie.torrent", "Download torrent directly")
    .example(
      "btget download movie.torrent -o ~/Downloads",
      "Download with command",
    )
    .example("btget info movie.torrent", "Show torrent information")
    .help()
    .alias("help", "h")
    .parse();
}
