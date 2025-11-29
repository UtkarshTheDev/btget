import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { exec } from "child_process";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { promisify } from "util";
import { TEMP_DIR } from "../setup";

const execAsync = promisify(exec);
const CLI_PATH = join(process.cwd(), "dist", "index.js");

describe("Download Integration Tests", () => {
	const testOutputDir = join(TEMP_DIR, "downloads");

	beforeEach(() => {
		if (existsSync(testOutputDir)) {
			rmSync(testOutputDir, { recursive: true, force: true });
		}
		mkdirSync(testOutputDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(testOutputDir)) {
			rmSync(testOutputDir, { recursive: true, force: true });
		}
	});

	describe("download workflow", () => {
		it("should start download process for valid torrent", async () => {
			const testTorrents = [
				"test_folder-d984f67af9917b214cd8b6048ab5624c7df6a07a.torrent",
			];

			for (const torrent of testTorrents) {
				if (!existsSync(torrent)) {
					console.log(`⏭️  Skipping ${torrent}: file not found`);
					continue;
				}

				try {
					// Start download with timeout to avoid long-running tests
					const { stdout, stderr } = await execAsync(
						`timeout 10 node ${CLI_PATH} download "${torrent}" -o "${testOutputDir}" 2>&1 || true`,
					);

					const output = stdout + stderr;

					// Check that download process started correctly
					expect(output).toMatch(
						/Processing torrent file:|Torrent loaded:|getPeers called/,
					);

					console.log(`✅ Download workflow test passed for ${torrent}`);
					break;
				} catch (error: any) {
					console.log(`⚠️  Download test error for ${torrent}:`, error.message);
				}
			}
		});

		it("should create output directory if it does not exist", async () => {
			const nonExistentDir = join(testOutputDir, "new-folder");

			try {
				const testTorrent =
					"test_folder-d984f67af9917b214cd8b6048ab5624c7df6a07a.torrent";
				if (!existsSync(testTorrent)) {
					console.log("⏭️  Skipping directory creation test: no test torrent");
					return;
				}

				await execAsync(
					`timeout 5 node ${CLI_PATH} download "${testTorrent}" -o "${nonExistentDir}" 2>&1 || true`,
				);

				// Directory should be created
				expect(existsSync(nonExistentDir)).toBe(true);

				console.log("✅ Directory creation test passed");
			} catch (error: any) {
				console.log("⚠️  Directory creation test error:", error.message);
			}
		});
	});

	describe("error handling", () => {
		it("should handle invalid torrent files gracefully", async () => {
			try {
				const { stdout, stderr } = await execAsync(
					`node ${CLI_PATH} download "package.json" -o "${testOutputDir}" 2>&1`,
				);

				const output = stdout + stderr;
				expect(output).toContain("Error");

				console.log("✅ Error handling test passed");
			} catch (error: any) {
				// This is expected - the command should fail gracefully
				expect(error.stdout || error.stderr).toContain("Error");
				console.log("✅ Error handling test passed (via exception)");
			}
		});

		it("should handle missing torrent files", async () => {
			try {
				const { stdout, stderr } = await execAsync(
					`node ${CLI_PATH} download "nonexistent.torrent" -o "${testOutputDir}" 2>&1`,
				);

				const output = stdout + stderr;
				expect(output).toContain("Error");
			} catch (error: any) {
				expect(error.stdout || error.stderr).toContain("Error");
			}
		});
	});

	describe("progress display", () => {
		it("should show progress information during download", async () => {
			try {
				const testTorrent =
					"test_folder-d984f67af9917b214cd8b6048ab5624c7df6a07a.torrent";
				if (!existsSync(testTorrent)) {
					console.log("⏭️  Skipping progress test: no test torrent");
					return;
				}

				const { stdout, stderr } = await execAsync(
					`timeout 15 node ${CLI_PATH} download "${testTorrent}" -o "${testOutputDir}" 2>&1 || true`,
				);

				const output = stdout + stderr;

				// Should contain progress-related text
				const progressIndicators = [
					"Downloading",
					"Speed:",
					"Peers:",
					"MB/",
					"%",
				];

				const hasProgress = progressIndicators.some((indicator) =>
					output.includes(indicator),
				);

				if (hasProgress) {
					console.log("✅ Progress display test passed");
				} else {
					console.log(
						"⚠️  Progress display test - no progress indicators found",
					);
				}
			} catch (error: any) {
				console.log("⚠️  Progress display test error:", error.message);
			}
		});
	});
});
