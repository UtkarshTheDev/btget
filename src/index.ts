import * as path from "node:path"; // Import path module
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { downloadTorrent } from "./core/download";
import { infoHash, open, size } from "./protocol/parser";
import type { File } from "./types/index";
import { startUI } from "./ui/render";
import Logger, { LogCategory, LogLevel } from "./utils/logger";

const KB_CONVERSION = 1024;
const BYTES_PER_MB = KB_CONVERSION * KB_CONVERSION;
const SHORT_HASH_LENGTH = 8;
const SPEED_HISTORY_SIZE = 30;
const PERCENTAGE_MULTIPLIER = 100;
const EXIT_DELAY_MS = 3000;
const EMA_ALPHA = 0.1; // Smoothing factor for ETA calculation

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
			describe: "Debug mode - show console logs instead of TUI (INFO level)",
			type: "boolean",
			default: false,
		})
		.option("verbose", {
			alias: "v",
			describe: "Verbose debug output (DEBUG level)",
			type: "boolean",
			default: false,
		})
		.option("trace", {
			describe: "Ultra-verbose debug output (TRACE level)",
			type: "boolean",
			default: false,
		})
		.option("log-category", {
			describe:
				"Filter logs by category (comma-separated: PEER,UPLOAD,DOWNLOAD,DHT,TRACKER,PIECE,QUEUE,PROTOCOL)",
			type: "string",
		})
		.option("log-level", {
			describe: "Minimum log level (TRACE, DEBUG, INFO, WARN, ERROR)",
			type: "string",
		})
		.example("btget movie.torrent", "Download torrent to current directory")
		.example(
			"btget movie.torrent -o ~/Downloads",
			"Download to specific directory",
		)
		.help()
		.alias("help", "h")
		.parse(argv, async (err: Error, argv: unknown) => {
			if (err) {
				console.error("Error:", err.message);
				process.exit(1);
			}

			let uiControls: ReturnType<typeof startUI> | null = null;

			try {
				// biome-ignore lint/suspicious/noExplicitAny: yargs argv is complex
				const args = argv as any;
				const torrentFilePath = args._[0] as string;
				const outputDirPath = path.resolve(args.output as string);
				const dhtOnly = args.dhtOnly || args["dht-only"];
				const verboseMode = args.verbose || args.v;
				const traceMode = args.trace;
				// --verbose and --trace should also enable debug mode (suppress TUI)
				const debugMode = args.debug || args.d || verboseMode || traceMode;
				const logCategory = args.logCategory || args["log-category"];
				const logLevel = args.logLevel || args["log-level"];

				// Configure Logger based on flags
				if (debugMode || verboseMode || traceMode) {
					// Determine log level
					let level = LogLevel.INFO;
					if (traceMode) {
						level = LogLevel.TRACE;
					} else if (verboseMode) {
						level = LogLevel.DEBUG;
					} else if (logLevel) {
						// Parse log level from string
						const levelMap: Record<string, LogLevel> = {
							TRACE: LogLevel.TRACE,
							DEBUG: LogLevel.DEBUG,
							INFO: LogLevel.INFO,
							WARN: LogLevel.WARN,
							ERROR: LogLevel.ERROR,
						};
						level = levelMap[logLevel.toUpperCase()] ?? LogLevel.INFO;
					}

					Logger.enable(level);

					// Parse and set categories if specified
					if (logCategory) {
						const categories = logCategory
							.split(",")
							.map((c: string) => c.trim().toUpperCase())
							.filter((c: string) => c in LogCategory) as LogCategory[];
						Logger.setCategories(categories);
					}
				} else {
					Logger.disable();
				}

				// Initial setup without UI to read torrent info
				const torrent = open(torrentFilePath);
				const torrentName = torrent.info.name.toString("utf8");
				const totalSize = size(torrent);
				const formattedSize = `${(Number(totalSize) / BYTES_PER_MB).toFixed(2)} MB`;
				const hash = `${infoHash(torrent).toString("hex").substring(0, SHORT_HASH_LENGTH)}...`;

				let currentSpeedHistory = Array(SPEED_HISTORY_SIZE).fill(0);
				let currentUploadSpeedHistory = Array(SPEED_HISTORY_SIZE).fill(0);
				let smoothedSpeed = 0;

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
						speedHistory: Array(SPEED_HISTORY_SIZE).fill(0),
						uploadSpeedHistory: Array(SPEED_HISTORY_SIZE).fill(0),
						uploaded: 0,
						downloaded: 0,
						ratio: 0,
					});

					// Suppress console logs during UI execution
					console.log = () => {};
					console.error = () => {};
				} else {
					// Debug mode enabled - Logger will handle all output
				}

				await downloadTorrent(torrent, outputDirPath, {
					dhtOnly,
					onProgress: debugMode
						? undefined
						: (data) => {
								// Calculate ETA using EMA
								const remaining = Number(totalSize) - data.downloaded;
								const currentSpeed = data.downloadSpeed || 0; // Handle undefined/NaN

								// Apply Exponential Moving Average
								if (smoothedSpeed === 0) {
									smoothedSpeed = currentSpeed;
								} else {
									smoothedSpeed =
										EMA_ALPHA * currentSpeed + (1 - EMA_ALPHA) * smoothedSpeed;
								}

								let eta = "--";
								if (smoothedSpeed > 0) {
									const seconds = remaining / smoothedSpeed;
									const mins = Math.floor(seconds / 60);
									const secs = Math.floor(seconds % 60);
									eta = `${mins}m ${secs}s`;
								}

								// Update speed history
								const downloadSpeedKb = data.downloadSpeed / KB_CONVERSION; // Convert bytes/sec to KB/s
								const uploadSpeedKb = data.uploadSpeed / KB_CONVERSION; // Convert bytes/sec to KB/s
								currentSpeedHistory = [
									...currentSpeedHistory.slice(1),
									downloadSpeedKb,
								];
								currentUploadSpeedHistory = [
									...currentUploadSpeedHistory.slice(1),
									uploadSpeedKb,
								];

								uiControls?.updateUI({
									progress:
										(data.downloaded / Number(totalSize)) *
										PERCENTAGE_MULTIPLIER,
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

				if (!debugMode && uiControls) {
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
					}, EXIT_DELAY_MS);
				} else {
					console.log("\n✅ Download completed successfully!");
					process.exit(0);
				}
			} catch (error) {
				const err = error as Error;
				if (uiControls) {
					uiControls.stopUI();
				}
				console.error("Error:", err.message);
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
				let uiControls: ReturnType<typeof startUI> | null = null;

				try {
					// biome-ignore lint/suspicious/noExplicitAny: yargs argv is complex
					const args = argv as any;
					const torrentFilePath = args["torrent-file"] as string;
					const outputDirPath = path.resolve(args.output as string); // Resolve to absolute path
					const dhtOnly = args.dhtOnly || args["dht-only"];
					const debugMode = args.debug || args.d;

					// Initial setup without UI to read torrent info
					const torrent = open(torrentFilePath);
					const torrentName = torrent.info.name.toString("utf8");
					const totalSize = size(torrent);
					const formattedSize = `${(Number(totalSize) / BYTES_PER_MB).toFixed(2)} MB`;
					const hash = `${infoHash(torrent).toString("hex").substring(0, SHORT_HASH_LENGTH)}...`;

					let currentSpeedHistory = Array(SPEED_HISTORY_SIZE).fill(0);
					let currentUploadSpeedHistory = Array(SPEED_HISTORY_SIZE).fill(0);
					let smoothedSpeed = 0;

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
							speedHistory: Array(SPEED_HISTORY_SIZE).fill(0),
							uploadSpeedHistory: Array(SPEED_HISTORY_SIZE).fill(0),
							uploaded: 0,
							downloaded: 0,
							ratio: 0,
						});

						// Suppress console logs during UI execution
						console.log = () => {};
						console.error = () => {};
					} else {
						// Debug mode enabled - Logger will handle all output
					}

					await downloadTorrent(torrent, outputDirPath, {
						dhtOnly,
						onProgress: debugMode
							? undefined
							: (data) => {
									// Calculate ETA using EMA
									const remaining = Number(totalSize) - data.downloaded;
									const currentSpeed = data.downloadSpeed || 0; // Handle undefined/NaN

									// Apply Exponential Moving Average
									if (smoothedSpeed === 0) {
										smoothedSpeed = currentSpeed;
									} else {
										smoothedSpeed =
											EMA_ALPHA * currentSpeed +
											(1 - EMA_ALPHA) * smoothedSpeed;
									}

									let eta = "--";
									if (smoothedSpeed > 0) {
										const seconds = remaining / smoothedSpeed;
										const mins = Math.floor(seconds / 60);
										const secs = Math.floor(seconds % 60);
										eta = `${mins}m ${secs}s`;
									}

									// Update speed history
									const downloadSpeedKb = data.downloadSpeed / KB_CONVERSION; // Convert bytes/sec to KB/s
									const uploadSpeedKb = data.uploadSpeed / KB_CONVERSION; // Convert bytes/sec to KB/s
									currentSpeedHistory = [
										...currentSpeedHistory.slice(1),
										downloadSpeedKb,
									];
									currentUploadSpeedHistory = [
										...currentUploadSpeedHistory.slice(1),
										uploadSpeedKb,
									];

									uiControls?.updateUI({
										progress:
											(data.downloaded / Number(totalSize)) *
											PERCENTAGE_MULTIPLIER,
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

					if (!debugMode && uiControls) {
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
						}, EXIT_DELAY_MS);
					} else {
						console.log("\n✅ Download completed successfully!");
						process.exit(0);
					}
				} catch (error) {
					const err = error as Error;
					if (uiControls) {
						uiControls.stopUI();
					}
					console.error("Error:", err.message);
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
						`   Size: ${(Number(size(torrent)) / BYTES_PER_MB).toFixed(2)} MB`,
					);
					console.log(`   Piece Length: ${torrent.info["piece length"]} bytes`);
					console.log(
						`   Number of Pieces: ${torrent.info.pieces.length / SHORT_HASH_LENGTH}`,
					);

					if (torrent.info.files) {
						console.log(`   Files: ${torrent.info.files.length}`);
						console.log("   📄 File List:");
						torrent.info.files.forEach((file: File, index: number) => {
							const filePath = file.path
								.map((p: Buffer) => p.toString("utf8"))
								.join("/");
							const fileSizeMB = (file.length / BYTES_PER_MB).toFixed(2);
							console.log(`      ${index + 1}. ${filePath} (${fileSizeMB} MB)`);
						});
					} else {
						console.log("   Type: Single file");
					}
					// ...
				} catch (error) {
					const err = error as Error;
					console.error("Error:", err.message);
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
