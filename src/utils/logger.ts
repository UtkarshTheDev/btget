/**
 * FIX #11: Logger utility to control debug output
 * Only shows debug logs when --debug flag is enabled
 */

class Logger {
	private static debugEnabled = false;

	/**
	 * Enable debug logging
	 */
	static enableDebug(): void {
		Logger.debugEnabled = true;
	}

	/**
	 * Disable debug logging
	 */
	static disableDebug(): void {
		Logger.debugEnabled = false;
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
