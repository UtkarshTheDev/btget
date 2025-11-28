import dgram from "dgram";
import crypto from "crypto";
import bencode from "bencode";
import { RoutingTable } from "./RoutingTable";
import { EventEmitter } from "events";

interface DHTOptions {
	port?: number;
}

export class DistributedHashTable extends EventEmitter {
	private socket: dgram.Socket;
	private routingTable: RoutingTable;
	private readonly localId: Buffer;
	private readonly BOOTSTRAP_NODES = [
		{ host: "router.bittorrent.com", port: 6881 },
		{ host: "dht.transmissionbt.com", port: 6881 },
		{ host: "router.utorrent.com", port: 6881 },
	];

	constructor(options: DHTOptions = {}) {
		super();
		this.localId = crypto.randomBytes(20);
		this.routingTable = new RoutingTable();
		this.socket = dgram.createSocket("udp4");

		this.socket.on("message", (msg, rinfo) => this.handleMessage(msg, rinfo));
		this.socket.on("error", (err) => console.error("DHT Error:", err));

		const port = options.port || 6881;
		this.socket.bind(port, () => {
			// console.log(`DHT listening on port ${port}`);
			this.bootstrap();
		});
	}

	/**
	 * Bootstrap DHT by connecting to public nodes
	 */
	private bootstrap(): void {
		this.BOOTSTRAP_NODES.forEach((node) => {
			this.findNode(node.host, node.port, this.localId);
		});
	}

	/**
	 * Send find_node query
	 */
	private findNode(host: string, port: number, target: Buffer): void {
		const tid = crypto.randomBytes(2);
		const msg = {
			t: tid,
			y: "q",
			q: "find_node",
			a: {
				id: this.localId,
				target: target,
			},
		};
		this.send(msg, host, port);
	}

	/**
	 * Send get_peers query (lookup)
	 */
	lookup(infoHash: Buffer): void {
		// Ask closest nodes for peers
		const nodes = this.routingTable.getClosestNodes(infoHash);

		// If table is empty, try bootstrap nodes again
		if (nodes.length === 0) {
			this.BOOTSTRAP_NODES.forEach((node) => {
				this.getPeers(node.host, node.port, infoHash);
			});
			return;
		}

		nodes.forEach((node) => {
			this.getPeers(node.ip, node.port, infoHash);
		});
	}

	/**
	 * Send get_peers query
	 */
	private getPeers(host: string, port: number, infoHash: Buffer): void {
		const tid = crypto.randomBytes(2);
		const msg = {
			t: tid,
			y: "q",
			q: "get_peers",
			a: {
				id: this.localId,
				info_hash: infoHash,
			},
		};
		this.send(msg, host, port);
	}

	/**
	 * Handle incoming messages
	 */
	private handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
		try {
			const decoded = bencode.decode(msg);

			// Add sender to routing table
			if (decoded.a && decoded.a.id) {
				this.routingTable.addNode({
					id: decoded.a.id,
					ip: rinfo.address,
					port: rinfo.port,
					lastSeen: Date.now(),
				});
			} else if (decoded.r && decoded.r.id) {
				this.routingTable.addNode({
					id: decoded.r.id,
					ip: rinfo.address,
					port: rinfo.port,
					lastSeen: Date.now(),
				});
			}

			// Handle responses
			if (decoded.y && decoded.y.toString() === "r") {
				if (decoded.r.nodes) {
					// Parse nodes and add to table
					this.parseNodes(decoded.r.nodes);
				}
				if (decoded.r.values) {
					// Found peers!
					const peers = this.parsePeers(decoded.r.values);
					this.emit("peers", peers);
				}
			}

			// Handle queries (ping, etc.) - simple response
			if (decoded.y && decoded.y.toString() === "q") {
				if (decoded.q.toString() === "ping") {
					this.sendResponse(decoded.t, rinfo, { id: this.localId });
				}
			}
		} catch (err) {
			// Ignore malformed messages
		}
	}

	/**
	 * Parse compact node info
	 */
	private parseNodes(nodes: Buffer): void {
		for (let i = 0; i < nodes.length; i += 26) {
			try {
				const id = nodes.slice(i, i + 20);
				const ip = `${nodes[i + 20]}.${nodes[i + 21]}.${nodes[i + 22]}.${nodes[i + 23]}`;
				const port = nodes.readUInt16BE(i + 24);

				this.routingTable.addNode({
					id,
					ip,
					port,
					lastSeen: Date.now(),
				});
			} catch (e) {
				// Ignore parse errors
			}
		}
	}

	/**
	 * Parse compact peer info
	 */
	private parsePeers(values: Buffer[]): Array<{ ip: string; port: number }> {
		const peers: Array<{ ip: string; port: number }> = [];
		values.forEach((val) => {
			try {
				const ip = `${val[0]}.${val[1]}.${val[2]}.${val[3]}`;
				const port = val.readUInt16BE(4);
				peers.push({ ip, port });
			} catch (e) {
				// Ignore
			}
		});
		return peers;
	}

	/**
	 * Send UDP message
	 */
	private send(msg: any, host: string, port: number): void {
		const buf = bencode.encode(msg);
		this.socket.send(buf, port, host);
	}

	/**
	 * Send response
	 */
	private sendResponse(tid: Buffer, rinfo: dgram.RemoteInfo, args: any): void {
		const msg = {
			t: tid,
			y: "r",
			r: args,
		};
		this.send(msg, rinfo.address, rinfo.port);
	}

	/**
	 * Stop DHT
	 */
	stop(): void {
		this.socket.close();
	}
}
