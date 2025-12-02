/**
 * Enhanced Logger utility with hierarchical logging, categories, and rate limiting
 * Provides clean, structured debug output for the BitTorrent client
 */

export enum LogLevel {
	TRACE = 0,
	DEBUG = 1,
	INFO = 2,
	WARN = 3,
	ERROR = 4,
}

export enum LogCategory {
	PEER = "PEER",
	UPLOAD = "UPLOAD",
	DOWNLOAD = "DOWNLOAD",
	DHT = "DHT",
	TRACKER = "TRACKER",
	PIECE = "PIECE",
	QUEUE = "QUEUE",
	PROTOCOL = "PROTOCOL",
	SYSTEM = "SYSTEM",
}

interface LogConfig {
	enabled: boolean;
	minLevel: LogLevel;
	enabledCategories: Set<LogCategory> | null; // null = all categories
	showTimestamp: boolean;
	showCategory: boolean;
	showLevel: boolean;
}

interface ThrottleEntry {
	lastLogged: number;
	count: number;
}

interface AggregateEntry {
	count: number;
	lastFlushed: number;
}

class Logger {
	private static config: LogConfig = {
		enabled: false,
		minLevel: LogLevel.INFO,
		enabledCategories: null,
		showTimestamp: true,
		showCategory: true,
		showLevel: true,
	};

	private static throttleMap = new Map<string, ThrottleEntry>();
	private static aggregateMap = new Map<string, AggregateEntry>();
	private static flushInterval: NodeJS.Timeout | null = null;
	private static readonly AGGREGATE_FLUSH_INTERVAL = 30000; // 30 seconds

	/**
	 * Enable debug logging
	 */
	static enable(level: LogLevel = LogLevel.DEBUG): void {
		Logger.config.enabled = true;
		Logger.config.minLevel = level;
		Logger.startAggregateFlush();
	}

	/**
	 * Disable debug logging
	 */
	static disable(): void {
		Logger.config.enabled = false;
		Logger.stopAggregateFlush();
	}

	/**
	 * Set minimum log level
	 */
	static setLevel(level: LogLevel): void {
		Logger.config.minLevel = level;
	}

	/**
	 * Set enabled categories (null = all categories)
	 */
	static setCategories(categories: LogCategory[] | null): void {
		if (categories === null) {
			Logger.config.enabledCategories = null;
		} else {
			Logger.config.enabledCategories = new Set(categories);
		}
	}

	/**
	 * Configure display options
	 */
	static configure(options: Partial<LogConfig>): void {
		Logger.config = { ...Logger.config, ...options };
	}

	/**
	 * Check if debug is enabled
	 */
	static isDebugEnabled(): boolean {
		return Logger.config.enabled;
	}

	/**
	 * TRACE level logging (ultra-verbose)
	 */
	static trace(category: LogCategory, message: string, data?: object): void {
		Logger.log(LogLevel.TRACE, category, message, data);
	}

	/**
	 * DEBUG level logging (detailed debugging)
	 */
	static debug(category: LogCategory, message: string, data?: object): void {
		Logger.log(LogLevel.DEBUG, category, message, data);
	}

	/**
	 * INFO level logging (important milestones)
	 */
	static info(category: LogCategory, message: string, data?: object): void {
		Logger.log(LogLevel.INFO, category, message, data);
	}

	/**
	 * WARN level logging (recoverable issues)
	 */
	static warn(category: LogCategory, message: string, data?: object): void {
		Logger.log(LogLevel.WARN, category, message, data);
	}

	/**
	 * ERROR level logging (serious problems)
	 */
	static error(category: LogCategory, message: string, data?: object): void {
		Logger.log(LogLevel.ERROR, category, message, data);
	}

	/**
	 * Rate-limited logging (prevents spam)
	 * @param key Unique key for this log message
	 * @param intervalMs Minimum interval between logs (milliseconds)
	 * @param level Log level
	 * @param category Log category
	 * @param message Log message
	 * @param data Optional data
	 */
	static throttle(
		key: string,
		intervalMs: number,
		level: LogLevel,
		category: LogCategory,
		message: string,
		data?: object,
	): void {
		const now = Date.now();
		const entry = Logger.throttleMap.get(key);

		if (!entry || now - entry.lastLogged >= intervalMs) {
			// Log the message
			Logger.log(level, category, message, data);

			// Update throttle entry
			Logger.throttleMap.set(key, {
				lastLogged: now,
				count: entry ? entry.count + 1 : 1,
			});
		}
	}

	/**
	 * Aggregate statistics (increments counter)
	 * @param key Unique key for this statistic
	 * @param increment Amount to increment (default: 1)
	 */
	static aggregate(key: string, increment = 1): void {
		const entry = Logger.aggregateMap.get(key);
		if (entry) {
			entry.count += increment;
		} else {
			Logger.aggregateMap.set(key, {
				count: increment,
				lastFlushed: Date.now(),
			});
		}
	}

	/**
	 * Flush aggregate statistics (called periodically)
	 */
	static flushAggregates(): void {
		if (Logger.aggregateMap.size === 0) return;

		const now = Date.now();
		for (const [key, entry] of Logger.aggregateMap.entries()) {
			const duration = (now - entry.lastFlushed) / 1000; // seconds
			const rate = entry.count / duration;

			Logger.debug(LogCategory.SYSTEM, `Aggregate: ${key}`, {
				count: entry.count,
				rate: `${rate.toFixed(2)}/s`,
				duration: `${duration.toFixed(1)}s`,
			});

			// Reset counter
			entry.count = 0;
			entry.lastFlushed = now;
		}
	}

	/**
	 * Core logging function
	 */
	private static log(
		level: LogLevel,
		category: LogCategory,
		message: string,
		data?: object,
	): void {
		// Check if logging is enabled
		if (!Logger.config.enabled) return;

		// Check log level
		if (level < Logger.config.minLevel) return;

		// Check category filter
		if (
			Logger.config.enabledCategories !== null &&
			!Logger.config.enabledCategories.has(category)
		) {
			return;
		}

		// Build log message
		const parts: string[] = [];

		// Timestamp
		if (Logger.config.showTimestamp) {
			const now = new Date();
			const timestamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
			parts.push(`[${timestamp}]`);
		}

		// Level
		if (Logger.config.showLevel) {
			const levelName = LogLevel[level];
			parts.push(`[${levelName}]`);
		}

		// Category
		if (Logger.config.showCategory) {
			parts.push(`[${category}]`);
		}

		// Message
		parts.push(message);

		// Data (if provided)
		let dataStr = "";
		if (data) {
			const entries = Object.entries(data)
				.map(([k, v]) => `${k}=${v}`)
				.join(", ");
			dataStr = ` {${entries}}`;
		}

		// Output based on level
		const fullMessage = parts.join(" ") + dataStr;
		switch (level) {
			case LogLevel.ERROR:
				console.error(fullMessage);
				break;
			case LogLevel.WARN:
				console.warn(fullMessage);
				break;
			default:
				console.log(fullMessage);
				break;
		}
	}

	/**
	 * Start periodic aggregate flushing
	 */
	private static startAggregateFlush(): void {
		if (Logger.flushInterval) return; // Already started

		Logger.flushInterval = setInterval(() => {
			Logger.flushAggregates();
		}, Logger.AGGREGATE_FLUSH_INTERVAL);
	}

	/**
	 * Stop periodic aggregate flushing
	 */
	private static stopAggregateFlush(): void {
		if (Logger.flushInterval) {
			clearInterval(Logger.flushInterval);
			Logger.flushInterval = null;
		}
	}
}

export default Logger;
