/**
 * LRU (Least Recently Used) Cache implementation
 * Provides O(1) get/set operations using a doubly-linked list + Map
 * Supports both count-based and size-based eviction
 */

interface CacheNode<K, V> {
	key: K;
	value: V;
	size: number; // Size in bytes (for Buffer values)
	prev: CacheNode<K, V> | null;
	next: CacheNode<K, V> | null;
}

export class LRUCache<K, V> {
	private capacity: number;
	private maxSizeBytes: number; // Maximum total size in bytes
	private currentSizeBytes: number = 0; // Current total size
	private cache: Map<K, CacheNode<K, V>>;
	private head: CacheNode<K, V> | null = null;
	private tail: CacheNode<K, V> | null = null;

	constructor(capacity: number, maxSizeBytes: number = Infinity) {
		this.capacity = capacity;
		this.maxSizeBytes = maxSizeBytes;
		this.cache = new Map();
	}

	/**
	 * Get value from cache (moves to front as most recently used)
	 */
	get(key: K): V | undefined {
		const node = this.cache.get(key);
		if (!node) return undefined;

		// Move to front (most recently used)
		this.moveToFront(node);
		return node.value;
	}

	/**
	 * Set value in cache (adds to front, evicts LRU if at capacity)
	 */
	set(key: K, value: V): void {
		// Calculate size for Buffer values
		const valueSize = Buffer.isBuffer(value) ? value.length : 0;

		const existingNode = this.cache.get(key);

		if (existingNode) {
			// Update existing node
			const oldSize = existingNode.size;
			existingNode.value = value;
			existingNode.size = valueSize;
			this.currentSizeBytes = this.currentSizeBytes - oldSize + valueSize;
			this.moveToFront(existingNode);
			return;
		}

		// Create new node
		const newNode: CacheNode<K, V> = {
			key,
			value,
			size: valueSize,
			prev: null,
			next: null,
		};

		// Add to cache and front of list
		this.cache.set(key, newNode);
		this.currentSizeBytes += valueSize;
		this.addToFront(newNode);

		// Evict LRU if over capacity (count or size)
		while (
			this.cache.size > this.capacity ||
			this.currentSizeBytes > this.maxSizeBytes
		) {
			this.evictLRU();
		}
	}

	/**
	 * Check if key exists in cache
	 */
	has(key: K): boolean {
		return this.cache.has(key);
	}

	/**
	 * Delete key from cache
	 */
	delete(key: K): boolean {
		const node = this.cache.get(key);
		if (!node) return false;

		this.removeNode(node);
		this.currentSizeBytes -= node.size;
		this.cache.delete(key);
		return true;
	}

	/**
	 * Clear all entries from cache
	 */
	clear(): void {
		this.cache.clear();
		this.head = null;
		this.tail = null;
		this.currentSizeBytes = 0;
	}

	/**
	 * Get current cache size
	 */
	get size(): number {
		return this.cache.size;
	}

	/**
	 * Get current total size in bytes
	 */
	get sizeBytes(): number {
		return this.currentSizeBytes;
	}

	/**
	 * Move node to front of list (most recently used)
	 */
	private moveToFront(node: CacheNode<K, V>): void {
		if (node === this.head) return;

		this.removeNode(node);
		this.addToFront(node);
	}

	/**
	 * Add node to front of list
	 */
	private addToFront(node: CacheNode<K, V>): void {
		node.next = this.head;
		node.prev = null;

		if (this.head) {
			this.head.prev = node;
		}

		this.head = node;

		if (!this.tail) {
			this.tail = node;
		}
	}

	/**
	 * Remove node from list
	 */
	private removeNode(node: CacheNode<K, V>): void {
		if (node.prev) {
			node.prev.next = node.next;
		} else {
			this.head = node.next;
		}

		if (node.next) {
			node.next.prev = node.prev;
		} else {
			this.tail = node.prev;
		}
	}

	/**
	 * Evict least recently used (tail) node
	 */
	private evictLRU(): void {
		if (!this.tail) return;

		const lruNode = this.tail;
		this.removeNode(lruNode);
		this.currentSizeBytes -= lruNode.size;
		this.cache.delete(lruNode.key);
	}
}
