import { describe, expect, it } from "bun:test";
import { genId } from "../../src/utils/genId";

describe("ID Generation", () => {
	it("should generate a Buffer of correct length", () => {
		const id = genId();

		expect(id).toBeInstanceOf(Buffer);
		expect(id.length).toBe(20); // Peer ID should be 20 bytes
	});

	it("should generate unique IDs", () => {
		const id1 = genId();
		const id2 = genId();

		expect(id1.equals(id2)).toBe(false);
	});

	it("should start with correct prefix", () => {
		const id = genId();
		const prefix = id.slice(0, 8).toString();

		// Should start with AT (Azureus/btget) identifier
		expect(prefix).toMatch(/^-AT\d{4}-/);
	});

	it("should generate cryptographically random suffix", () => {
		const ids = Array.from({ length: 10 }, () => genId());
		const suffixes = ids.map((id) => id.slice(8).toString("hex"));

		// All suffixes should be different (extremely unlikely to get duplicates)
		const uniqueSuffixes = new Set(suffixes);
		expect(uniqueSuffixes.size).toBe(suffixes.length);
	});
});
