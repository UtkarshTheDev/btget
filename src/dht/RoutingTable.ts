export interface Node {
	id: Buffer;
	ip: string;
	port: number;
	lastSeen: number;
}

export class RoutingTable {
	private readonly k = 8; // K-bucket size
	private readonly MAX_NODES = 1000;
	private readonly ID_LENGTH = 20;
	private readonly nodes: Node[] = [];

	/**
	 * Add a node to the routing table
	 */
	addNode(node: Node): void {
		// Simple implementation: just keep closest nodes or most recently seen
		// In a full implementation, we'd use proper K-buckets
		// For now, we'll just keep a flat list and sort by distance when needed
		// This is sufficient for a basic client

		const existingIndex = this.nodes.findIndex((n) => n.id.equals(node.id));
		if (existingIndex !== -1) {
			this.nodes[existingIndex] = node; // Update
		} else {
			this.nodes.push(node);
		}

		// Limit total nodes to avoid memory issues (e.g. 1000)
		if (this.nodes.length > this.MAX_NODES) {
			// Remove oldest seen
			this.nodes.sort((a, b) => b.lastSeen - a.lastSeen);
			this.nodes.pop();
		}
	}

	/**
	 * Get closest nodes to a target ID
	 */
	getClosestNodes(target: Buffer): Node[] {
		return this.nodes
			.map((node) => ({
				node,
				distance: this.distance(node.id, target),
			}))
			.sort((a, b) => this.compareDistance(a.distance, b.distance))
			.slice(0, this.k)
			.map((item) => item.node);
	}

	/**
	 * Calculate XOR distance between two IDs
	 */
	private distance(a: Buffer, b: Buffer): Buffer {
		const res = Buffer.alloc(this.ID_LENGTH);
		for (let i = 0; i < this.ID_LENGTH; i++) {
			res[i] = (a[i] ?? 0) ^ (b[i] ?? 0);
		}
		return res;
	}

	/**
	 * Compare two distance buffers
	 */
	private compareDistance(a: Buffer, b: Buffer): number {
		for (let i = 0; i < this.ID_LENGTH; i++) {
			const byteA = a[i] ?? 0;
			const byteB = b[i] ?? 0;
			if (byteA !== byteB) {
				return byteA < byteB ? -1 : 1;
			}
		}
		return 0;
	}

	/**
	 * Get all nodes
	 */
	getAllNodes(): Node[] {
		return this.nodes;
	}
}
