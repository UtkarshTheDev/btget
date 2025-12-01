/**
 * Logger utility to control debug output
 * Only shows debug logs when debug mode is enabled
 */

class Logger {
	private static debugEnabled = false;

	/**
	 * Enable debug logging
	 */
	static enable(): void {
		Logger.debugEnabled = true;
	}

	/**
	 * Disable debug logging
	 */
	static disable(): void {
		Logger.debugEnabled = false;
	}

	/**
	 * Check if debug is enabled
	 */
	static isDebugEnabled(): boolean {
		return Logger.debugEnabled;
	}

	/**
	 * Debug log (only shown when debug enabled)
	 */
	static debug(...args: unknown[]): void {
		if (Logger.debugEnabled) {
			console.log(...args);
		}
	}

	/**
	 * Info log (always shown)
	 */
	static info(...args: unknown[]): void {
		console.log(...args);
	}

	/**
	 * Warning log (always shown)
	 */
	static warn(...args: unknown[]): void {
		console.warn(...args);
	}

	/**
	 * Error log (always shown)
	 */
	static error(...args: unknown[]): void {
		console.error(...args);
	}
}

export default Logger;
