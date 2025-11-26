import dgram from "dgram";
import crypto from "crypto";
import bencode from "bencode";
import type { Peer, Torrent } from "../types/index";
import { infoHash } from "../protocol/parser";

/**
 * Simple DHT implementation for peer discovery as fallback
 */
export class SimpleDHT {
	private socket: dgram.Socket;
	private nodeId: Buffer;
	private bootstrapNodes: { ip: string; port: number }[];
	private transactionId: number;

	constructor() {
		this.socket = dgram.createSocket("udp4");
		this.nodeId = crypto.randomBytes(20);
		this.transactionId = 0;

		// Popular DHT bootstrap nodes
		this.bootstrapNodes = [
			{ ip: "router.bittorrent.com", port: 6881 },
			{ ip: "dht.transmissionbt.com", port: 6881 },
			{ ip: "router.utorrent.com", port: 6881 },
			{ ip: "dht.aelitis.com", port: 6881 },
		];
	}

	/**
	 * Find peers for a torrent using DHT
	 */
	async findPeers(torrent: Torrent, timeout = 30000): Promise<Peer[]> {
		return new Promise((resolve) => {
			const peers: Peer[] = [];
			const seenPeers = new Set<string>();
			const hash = infoHash(torrent);

			let timeoutHandle: NodeJS.Timeout;
			let resolved = false;

			const cleanup = () => {
				if (resolved) return;
				resolved = true;

				if (timeoutHandle) clearTimeout(timeoutHandle);
				this.socket.removeAllListeners("message");
				this.socket.removeAllListeners("error");

				try {
					this.socket.close();
				} catch (e) {
					// Ignore close errors
				}
			};

			const resolvePeers = () => {
				cleanup();
				resolve(peers);
			};

			// Set timeout
			timeoutHandle = setTimeout(() => {
				console.log(`DHT: Found ${peers.length} peers via DHT`);
				resolvePeers();
			}, timeout);

			// Handle incoming messages
			this.socket.on("message", (msg: Buffer) => {
				try {
					const response = bencode.decode(msg);

					if (response.r && response.r.values) {
						// Parse compact peer list
						const values = response.r.values;
						if (Buffer.isBuffer(values)) {
							for (let i = 0; i < values.length; i += 6) {
								const ip = `${values[i]}.${values[i + 1]}.${values[i + 2]}.${values[i + 3]}`;
								const port = values.readUInt16BE(i + 4);

								const peerKey = `${ip}:${port}`;
								if (!seenPeers.has(peerKey) && this.isValidPeer(ip, port)) {
									seenPeers.add(peerKey);
									peers.push({ ip, port });

									// If we found enough peers quickly, resolve early
									if (peers.length >= 20) {
										console.log(
											`DHT: Found sufficient peers (${peers.length})`,
										);
										resolvePeers();
										return;
									}
								}
							}
						}
					}

					// Continue searching through other nodes if we have node info
					if (response.r && response.r.nodes) {
						this.queryMoreNodes(response.r.nodes, hash);
					}
				} catch (error) {
					// Ignore malformed messages
				}
			});

			this.socket.on("error", () => {
				// Ignore socket errors, DHT is best-effort
			});

			// Start DHT query
			this.startDHTQuery(hash);
		});
	}

	/**
	 * Start DHT query by pinging bootstrap nodes
	 */
	private startDHTQuery(infoHash: Buffer): void {
		try {
			this.socket.bind(); // Bind to random port

			// Query bootstrap nodes
			this.bootstrapNodes.forEach((node) => {
				this.findNode(node.ip, node.port, infoHash);
			});
		} catch (error) {
			console.error("DHT: Failed to start query:", error);
		}
	}

	/**
	 * Send find_node query
	 */
	private findNode(ip: string, port: number, target: Buffer): void {
		try {
			const transactionId = Buffer.from([this.transactionId++]);

			const query = {
				t: transactionId,
				y: "q",
				q: "get_peers",
				a: {
					id: this.nodeId,
					info_hash: target,
				},
			};

			const encoded = bencode.encode(query);

			this.socket.send(encoded, 0, encoded.length, port, ip, (error) => {
				if (error) {
					// Ignore send errors
				}
			});
		} catch (error) {
			// Ignore query errors
		}
	}

	/**
	 * Query additional nodes found in responses
	 */
	private queryMoreNodes(nodesBuffer: Buffer, infoHash: Buffer): void {
		try {
			// Parse compact node list (26 bytes per node: 20 byte ID + 4 byte IP + 2 byte port)
			for (let i = 0; i < nodesBuffer.length; i += 26) {
				if (i + 26 <= nodesBuffer.length) {
					// Skip node ID (first 20 bytes)
					const ip = `${nodesBuffer[i + 20]}.${nodesBuffer[i + 21]}.${nodesBuffer[i + 22]}.${nodesBuffer[i + 23]}`;
					const port = nodesBuffer.readUInt16BE(i + 24);

					if (this.isValidPeer(ip, port)) {
						this.findNode(ip, port, infoHash);
					}
				}
			}
		} catch (error) {
			// Ignore parsing errors
		}
	}

	/**
	 * Validate if peer IP and port are reasonable
	 */
	private isValidPeer(ip: string, port: number): boolean {
		if (port < 1 || port > 65535) return false;
		if (ip === "0.0.0.0") return false;
		if (ip.startsWith("127.")) return false;
		if (ip.startsWith("10.")) return false;
		if (ip.startsWith("192.168.")) return false;
		if (ip.startsWith("172.")) {
			const secondOctet = parseInt(ip.split(".")[1]);
			if (secondOctet >= 16 && secondOctet <= 31) return false;
		}
		return true;
	}
}
