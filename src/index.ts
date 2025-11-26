import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import * as path from "node:path"; // Import path module
import { open, size } from "./protocol/parser";
import { downloadTorrent } from "./core/download";

// Handle both direct file download and command-based usage
const argv = hideBin(process.argv);

// Check if first argument is a torrent file (direct download like wget)
const isDirectDownload =
	argv.length > 0 &&
	argv[0] !== undefined &&
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
		.option("dht-only", {
			describe: "Use only DHT for peer discovery (disable trackers)",
			type: "boolean",
			default: false,
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

				// Debug args
				console.log("Parsed args:", argv);

				const dhtOnly = argv.dhtOnly || argv["dht-only"];
				console.log("dhtOnly variable:", dhtOnly);

				console.log(`Processing torrent file: ${torrentFilePath}`);
				const torrent = open(torrentFilePath);
				const torrentName = torrent.info.name.toString("utf8");

				console.log(`Torrent loaded: ${torrentName}`);
				console.log(`Files will be saved to: ${outputDirPath}`);
				if (dhtOnly) console.log("📡 Mode: DHT Only (Trackers disabled)");

				await downloadTorrent(torrent, outputDirPath, { dhtOnly });
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
					})
					.option("dht-only", {
						describe: "Use only DHT for peer discovery (disable trackers)",
						type: "boolean",
						default: false,
					});
			},
			async (argv) => {
				try {
					const torrentFilePath = argv["torrent-file"] as string;
					const outputDirPath = path.resolve(argv.output as string); // Resolve to absolute path
					const dhtOnly = argv.dhtOnly || argv["dht-only"];
					console.log("Running DIRECT DOWNLOAD mode");
					console.log("dhtOnly variable:", dhtOnly, "Type:", typeof dhtOnly);

					console.log(`Processing torrent file: ${torrentFilePath}`);
					const torrent = open(torrentFilePath);
					const torrentName = torrent.info.name.toString("utf8");

					console.log(`Torrent loaded: ${torrentName}`);
					console.log(`Files will be saved to: ${outputDirPath}`);
					if (dhtOnly) console.log("📡 Mode: DHT Only (Trackers disabled)");

					console.log("Calling downloadTorrent with options:", { dhtOnly });
					await downloadTorrent(torrent, outputDirPath, { dhtOnly });
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
					console.log(`   Name: ${torrent.info.name.toString("utf8")}`);
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
								.map((p: Buffer) => p.toString("utf8"))
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
		.example(
			"btget download movie.torrent --dht-only",
			"Download using only DHT",
		)
		.example("btget info movie.torrent", "Show torrent information")
		.help()
		.alias("help", "h")
		.parse();
}
