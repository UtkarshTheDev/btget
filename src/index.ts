import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import * as path from "node:path"; // Import path module
import { open, size, infoHash } from "./protocol/parser";
import { downloadTorrent } from "./core/download";
import { startUI } from "./ui/render";

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
		.option("debug", {
			alias: "d",
			describe: "Debug mode - show console logs instead of TUI",
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

			let uiControls: any = null;

			try {
				const torrentFilePath = argv._[0] as string;
				const outputDirPath = path.resolve(argv.output as string);
				const dhtOnly = argv.dhtOnly || argv["dht-only"];
				const debugMode = argv.debug || argv.d;

				// Initial setup without UI to read torrent info
				const torrent = open(torrentFilePath);
				const torrentName = torrent.info.name.toString("utf8");
				const totalSize = size(torrent);
				const formattedSize =
					(Number(totalSize) / (1024 * 1024)).toFixed(2) + " MB";
				const hash = infoHash(torrent).toString("hex").substring(0, 8) + "...";

				let currentSpeedHistory = Array(30).fill(0);
				let currentUploadSpeedHistory = Array(30).fill(0);

				// Store original console methods
				const originalLog = console.log;
				const originalError = console.error;

				// Start UI only if not in debug mode
				if (!debugMode) {
					uiControls = startUI({
						filename: torrentName,
						size: formattedSize,
						hash: hash,
						progress: 0,
						speed: 0,
						uploadSpeed: 0,
						eta: "--",
						peers: 0,
						seeds: 0,
						leechers: 0,
						status: "Initializing...",
						speedHistory: Array(30).fill(0),
						uploadSpeedHistory: Array(30).fill(0),
						uploaded: 0,
						downloaded: 0,
						ratio: 0,
					});

					// Suppress console logs during UI execution
					console.log = () => {};
					console.error = () => {};
				} else {
					console.log(`🚀 Starting download in DEBUG mode: ${torrentName}`);
					console.log(`📦 Size: ${formattedSize}`);
					console.log(`🔑 Hash: ${hash}`);
				}

				await downloadTorrent(torrent, outputDirPath, {
					dhtOnly,
					onProgress: debugMode
						? undefined
						: (data) => {
								// Calculate ETA
								const remaining = Number(totalSize) - data.downloaded;
								const speedBytes = data.downloadSpeed; // Already in bytes/sec
								let eta = "--";
								if (speedBytes > 0) {
									const seconds = remaining / speedBytes;
									const mins = Math.floor(seconds / 60);
									const secs = Math.floor(seconds % 60);
									eta = `${mins}m ${secs}s`;
								}

								// Update speed history
								const downloadSpeedKb = data.downloadSpeed / 1024; // Convert bytes/sec to KB/s
								const uploadSpeedKb = data.uploadSpeed / 1024; // Convert bytes/sec to KB/s
								currentSpeedHistory = [
									...currentSpeedHistory.slice(1),
									downloadSpeedKb,
								];
								currentUploadSpeedHistory = [
									...currentUploadSpeedHistory.slice(1),
									uploadSpeedKb,
								];

								uiControls.updateUI({
									progress: (data.downloaded / Number(totalSize)) * 100,
									speed: downloadSpeedKb, // Download KB/s
									uploadSpeed: uploadSpeedKb, // Upload KB/s
									peers: data.peers,
									seeds: data.seeds || 0,
									leechers: data.leechers || 0,
									eta: eta,
									status:
										data.downloaded > 0 ? "Downloading..." : "Finding Peers...",
									speedHistory: currentSpeedHistory,
									uploadSpeedHistory: currentUploadSpeedHistory,
									uploaded: data.uploaded,
									downloaded: data.downloaded,
									ratio:
										data.downloaded > 0 ? data.uploaded / data.downloaded : 0,
								});
							},
				});

				if (!debugMode) {
					// Restore console
					console.log = originalLog;
					console.error = originalError;

					uiControls.updateUI({
						status: "Completed",
						progress: 100,
						eta: "0m 0s",
					});

					// Auto-exit after 3 seconds
					setTimeout(() => {
						if (uiControls) uiControls.stopUI();
						process.exit(0);
					}, 3000);
				} else {
					console.log("\n✅ Download completed successfully!");
					process.exit(0);
				}
			} catch (error: any) {
				if (uiControls) {
					uiControls.stopUI();
				}
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
					})
					.option("debug", {
						alias: "d",
						describe: "Debug mode - show console logs instead of TUI",
						type: "boolean",
						default: false,
					});
			},
			async (argv) => {
				let uiControls: any = null;

				try {
					const torrentFilePath = argv["torrent-file"] as string;
					const outputDirPath = path.resolve(argv.output as string); // Resolve to absolute path
					const dhtOnly = argv.dhtOnly || argv["dht-only"];
					const debugMode = argv.debug || argv.d;

					// Initial setup without UI to read torrent info
					const torrent = open(torrentFilePath);
					const torrentName = torrent.info.name.toString("utf8");
					const totalSize = size(torrent);
					const formattedSize =
						(Number(totalSize) / (1024 * 1024)).toFixed(2) + " MB";
					const hash =
						infoHash(torrent).toString("hex").substring(0, 8) + "...";

					let currentSpeedHistory = Array(30).fill(0);
					let currentUploadSpeedHistory = Array(30).fill(0);

					// Store original console methods
					const originalLog = console.log;
					const originalError = console.error;

					// Start UI only if not in debug mode
					if (!debugMode) {
						uiControls = startUI({
							filename: torrentName,
							size: formattedSize,
							hash: hash,
							progress: 0,
							speed: 0,
							uploadSpeed: 0,
							eta: "--",
							peers: 0,
							seeds: 0,
							leechers: 0,
							status: "Initializing...",
							speedHistory: Array(30).fill(0),
							uploadSpeedHistory: Array(30).fill(0),
							uploaded: 0,
							downloaded: 0,
							ratio: 0,
						});

						// Suppress console logs during UI execution
						console.log = () => {};
						console.error = () => {};
					} else {
						console.log(`🚀 Starting download in DEBUG mode: ${torrentName}`);
						console.log(`📦 Size: ${formattedSize}`);
						console.log(`🔑 Hash: ${hash}`);
					}

					await downloadTorrent(torrent, outputDirPath, {
						dhtOnly,
						onProgress: debugMode
							? undefined
							: (data) => {
									// Calculate ETA
									const remaining = Number(totalSize) - data.downloaded;
									const speedBytes = data.downloadSpeed; // Already in bytes/sec
									let eta = "--";
									if (speedBytes > 0) {
										const seconds = remaining / speedBytes;
										const mins = Math.floor(seconds / 60);
										const secs = Math.floor(seconds % 60);
										eta = `${mins}m ${secs}s`;
									}

									// Update speed history
									const downloadSpeedKb = data.downloadSpeed / 1024; // Convert bytes/sec to KB/s
									const uploadSpeedKb = data.uploadSpeed / 1024; // Convert bytes/sec to KB/s
									currentSpeedHistory = [
										...currentSpeedHistory.slice(1),
										downloadSpeedKb,
									];
									currentUploadSpeedHistory = [
										...currentUploadSpeedHistory.slice(1),
										uploadSpeedKb,
									];

									uiControls.updateUI({
										progress: (data.downloaded / Number(totalSize)) * 100,
										speed: downloadSpeedKb, // Download KB/s
										uploadSpeed: uploadSpeedKb, // Upload KB/s
										peers: data.peers,
										seeds: data.seeds || 0,
										leechers: data.leechers || 0,
										eta: eta,
										status:
											data.downloaded > 0
												? "Downloading..."
												: "Finding Peers...",
										speedHistory: currentSpeedHistory,
										uploadSpeedHistory: currentUploadSpeedHistory,
										uploaded: data.uploaded,
										downloaded: data.downloaded,
										ratio:
											data.downloaded > 0 ? data.uploaded / data.downloaded : 0,
									});
								},
					});

					if (!debugMode) {
						// Restore console
						console.log = originalLog;
						console.error = originalError;

						uiControls.updateUI({
							status: "Completed",
							progress: 100,
							eta: "0m 0s",
						});

						// Auto-exit after 3 seconds
						setTimeout(() => {
							if (uiControls) uiControls.stopUI();
							process.exit(0);
						}, 3000);
					} else {
						console.log("\n✅ Download completed successfully!");
						process.exit(0);
					}
				} catch (error: any) {
					if (uiControls) {
						uiControls.stopUI();
					}
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
