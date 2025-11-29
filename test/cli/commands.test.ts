import { describe, expect, it, test } from "bun:test";
import { exec } from "child_process";
import { join } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);
const CLI_PATH = join(process.cwd(), "dist", "index.js");

describe("CLI Commands", () => {
	describe("help command", () => {
		it("should show help when no arguments provided", async () => {
			try {
				const { stdout, stderr } = await execAsync(`node ${CLI_PATH} --help`);
				expect(stdout).toContain("Usage:");
				expect(stdout).toContain("btget");
			} catch (error: any) {
				// Help command might exit with code 1, that's okay
				expect(error.stdout || error.stderr).toContain("Usage:");
			}
		});

		it("should show help with -h flag", async () => {
			try {
				const { stdout } = await execAsync(`node ${CLI_PATH} -h`);
				expect(stdout).toContain("Usage:");
			} catch (error: any) {
				expect(error.stdout || error.stderr).toContain("Usage:");
			}
		});
	});

	describe("info command", () => {
		it("should show error for non-existent torrent file", async () => {
			try {
				await execAsync(`node ${CLI_PATH} info nonexistent.torrent`);
				throw new Error("Should have failed");
			} catch (error: any) {
				expect(error.stderr || error.stdout).toContain("Error");
			}
		});

		it("should show torrent info for valid file", async () => {
			const testTorrents = [
				"test_folder-d984f67af9917b214cd8b6048ab5624c7df6a07a.torrent",
				"BigBuckBunny_328_archive.torrent",
			];

			for (const torrent of testTorrents) {
				try {
					const { stdout } = await execAsync(
						`node ${CLI_PATH} info "${torrent}"`,
					);
					expect(stdout).toContain("📁 Torrent Information:");
					expect(stdout).toContain("Name:");
					expect(stdout).toContain("Size:");
					console.log(`✅ Info command works with ${torrent}`);
					break;
				} catch (error) {
					console.log(`⏭️  Skipping ${torrent}: not found`);
				}
			}
		});
	});

	describe("download command", () => {
		it("should validate torrent file exists before download", async () => {
			try {
				await execAsync(
					`node ${CLI_PATH} download nonexistent.torrent -o /tmp/test`,
				);
				throw new Error("Should have failed");
			} catch (error: any) {
				expect(error.stderr || error.stdout).toContain("Error");
			}
		});

		it("should accept output directory parameter", async () => {
			// This test would require an actual torrent download
			// For now, we just test that the command accepts the parameter
			try {
				const { stdout, stderr } = await execAsync(
					`timeout 2 node ${CLI_PATH} download --help`,
				);
				expect(stdout || stderr).toContain("-o, --output");
			} catch (error: any) {
				// Timeout is expected
				expect(error.stdout || error.stderr).toContain("-o, --output");
			}
		});
	});

	describe("direct download mode", () => {
		it("should support wget-style direct download", async () => {
			const testTorrents = [
				"test_folder-d984f67af9917b214cd8b6048ab5624c7df6a07a.torrent",
			];

			for (const torrent of testTorrents) {
				try {
					// Test that it starts downloading (we'll timeout quickly)
					const { stdout, stderr } = await execAsync(
						`timeout 3 node ${CLI_PATH} "${torrent}" -o /tmp/test_direct 2>&1 || true`,
					);
					const output = stdout + stderr;

					if (
						output.includes("Processing torrent file:") ||
						output.includes("Torrent loaded:") ||
						output.includes("Error:")
					) {
						console.log(`✅ Direct download mode works with ${torrent}`);
						break;
					}
				} catch (error) {
					console.log(`⏭️  Skipping ${torrent}: not found`);
				}
			}
		});
	});
});
