import path from 'node:path';
import fs from 'node:fs';
import {LoggerColors, LoggerLevels} from './values';

/**
 * Logger class provides various logging methods with different log levels.
 * @example
 * const log = new Logger();
 * log.info('This is an informational message');
 */
export default class Logger {
	/**
	 * A map to store start times for labeled timers.
	 */
	private timeMap: {[key: string]: number} = {};

	/**
	 * A prefix for log messages.
	 */
	private prefix?: string;

	/**
	 * A global log level to filter logs.
	 */
	private static globalLogLevel: keyof typeof LoggerLevels = 'INFO';

	/**
	 * The directory where log files are stored.
	 */
	private static logDirectory: string = path.join(process.cwd(), '.logs');

	/**
	 * A flag to enable or disable file logging.
	 */
	private static enableFileLogging = true;

	/**
	 * Stores the creation location of the logger.
	 */
	private creationInfo = this.__getCallerInfo();

	/**
	 * Stores the trace information of parent and child loggers.
	 */
	private parentTrace?: {
		parentPrefix?: string;
		parentCreationInfo: {fileName: string; method: string};
		childCreationInfo: {fileName: string; method: string};
		inheritedTrace?: Logger['parentTrace'] | null;
	};

	/**
	 * Sets the global log level.
	 * @param level - The log level to set (e.g., 'INFO', 'DEBUG').
	 */
	static setLogLevel(level: keyof typeof LoggerLevels) {
		if (LoggerLevels[level] !== undefined) {
			Logger.globalLogLevel = level;
		} else {
			throw new Error(`Invalid log level: ${level}`);
		}
	}

	/**
	 * Configures the log directory.
	 * @param directory - The directory path to store log files.
	 */
	static setLogDirectory(directory: string) {
		Logger.logDirectory = directory;
	}

	/**
	 * Enables or disables file logging.
	 * @param enable - A boolean to enable or disable file logging.
	 */
	static setFileLogging(enable: boolean) {
		Logger.enableFileLogging = enable;
	}

	/**
	 * Creates a child logger with an optional prefix and trace option.
	 * If a child logger is logged, it will include the trace of all parent loggers.
	 * Additionally, it captures the creation location of both parent and child loggers.
	 * @param prefix - An optional prefix for log messages.
	 * @param trace - Whether to include trace information.
	 */
	child(prefix?: string, trace = false) {
		const childCreationInfo = this.__getCallerInfo();
		const newLogger = new Logger(
			this.prefix ? `${this.prefix} -> ${prefix}` : prefix,
		);

		if (trace) {
			newLogger.parentTrace = {
				parentPrefix: this.prefix,
				parentCreationInfo: this.creationInfo,
				childCreationInfo,
				inheritedTrace: this.parentTrace || null,
			};
		}

		return newLogger;
	}

	/**
	 * Logs a message with trace information if available.
	 * @param level - The log level (e.g., 'INFO', 'ERROR').
	 * @param messages - The messages to log.
	 * @returns The Logger instance.
	 */
	log(level: keyof typeof LoggerLevels, ...messages: unknown[]) {
		if (this.parentTrace) {
			const traceMessages = [];
			let currentTrace: Logger['parentTrace'] | null = this.parentTrace;

			while (currentTrace) {
				traceMessages.push(
					`Trace: Parent created at ${currentTrace.parentCreationInfo.fileName}, ` +
						`Child created at ${currentTrace.childCreationInfo.fileName}`,
				);
				currentTrace = currentTrace.inheritedTrace ?? null;
			}

			messages.push(...traceMessages.reverse());
		}

		return this.__log(level, messages);
	}

	/**
	 * Creates an instance of the Logger class.
	 * @param prefix - An optional prefix for log messages.
	 */
	constructor(prefix?: string) {
		this.prefix = prefix;
	}

	/**
	 * Retrieves information about the caller of the logging method.
	 * @returns An object containing the file name and method name of the caller.
	 */
	private __getCallerInfo() {
		const originalFunc = Error.prepareStackTrace;

		let callerFile: string | undefined;
		let callerMethod: string | undefined;
		let lineNumber: number | null | undefined;

		try {
			const err = new Error();
			Error.prepareStackTrace = (_, stack) => stack;
			const stack = err.stack as unknown as NodeJS.CallSite[];

			for (let i = 2; i < stack.length; i++) {
				const callSite = stack[i];
				const fileName = callSite.getFileName();
				if (fileName && fileName !== __filename) {
					callerFile = path.relative(process.cwd(), fileName);
					callerMethod = callSite.getFunctionName() || 'anonymous';
					if (fileName && !fileName.includes('logger.ts')) {
						callerFile = path.relative(process.cwd(), fileName);
						callerMethod =
							callSite.getFunctionName() || 'anonymous';
						lineNumber = callSite.getLineNumber();
						break;
					}
					break;
				}
			}
		} catch (e) {
			// Handle error
		} finally {
			Error.prepareStackTrace = originalFunc;
		}

		return {
			fileName: `${callerFile || 'unknown'}:${lineNumber || -1}`,
			method: `${callerMethod || 'unknown'}`,
		} as const;
	}

	/**
	 * Logs a message with a specified log level, color, and background color.
	 * @param level - The log level (e.g., 'INFO', 'ERROR').
	 * @param messages - The messages to log.
	 * @param color - The color to use for the log message.
	 * @param bgColor - The background color to use for the log message.
	 * @returns The Logger instance.
	 */
	private __log(
		level: keyof typeof LoggerLevels,
		messages: unknown[],
		color: string = LoggerColors.Reset,
		bgColor: string = LoggerColors.Reset,
	) {
		// Filter logs based on the global log level
		if (LoggerLevels[level] < LoggerLevels[Logger.globalLogLevel]) {
			return this;
		}

		const timestamp = new Date().toISOString();
		const {fileName, method} = this.__getCallerInfo();

		console.log(
			`${bgColor}${color}\n${timestamp} |`,
			level.padStart(10),
			'\n|---',
			fileName,
			'\n|---',
			method,
			`${this.prefix ? `\n|--- ${this.prefix}` : ''}`,
			`\n${LoggerColors.Reset}${LoggerColors.Reset}`,
			...messages,
			'\n',
		);

		if (['ERROR', 'FATAL'].includes(level)) {
			const logMessage = `${timestamp} | ${level} | ${fileName} | ${method}${this.prefix ? ` | ${this.prefix}` : ''} | ${messages.join(' ')}`;
			this.__logToFile(logMessage);
		}

		return this;
	}

	/**
	 * Logs a message to a file.
	 * @param message - The message to log.
	 */
	private __logToFile(message: string) {
		if (!Logger.enableFileLogging) {
			return;
		}

		const now = new Date();
		const year = now.getFullYear();
		const month = (now.getMonth() + 1).toString().padStart(2, '0');
		const date = now.getDate().toString().padStart(2, '0');

		const logDir = path.join(
			Logger.logDirectory,
			`${year}/${year}-${month}`,
		);
		const logFile = path.join(logDir, `${year}-${month}-${date}.log`);

		if (!fs.existsSync(logDir)) {
			fs.mkdirSync(logDir, {recursive: true});
		}

		fs.appendFileSync(logFile, message + '\n');
	}

	/**
	 * Logs an informational message.
	 * @param messages - The messages to log.
	 * @returns The Logger instance.
	 */
	info(...messages: unknown[]) {
		return this.__log(
			'INFO',
			messages,
			LoggerColors.FgCyan,
			LoggerColors.BgBlack,
		);
	}

	/**
	 * Logs a warning message.
	 * @param messages - The messages to log.
	 * @returns The Logger instance.
	 */
	warn(...messages: unknown[]) {
		return this.__log(
			'WARN',
			messages,
			LoggerColors.FgYellow,
			LoggerColors.BgBlack,
		);
	}

	/**
	 * Logs an error message.
	 * @param messages - The messages to log.
	 * @returns The Logger instance.
	 */
	error(...messages: unknown[]) {
		return this.__log(
			'ERROR',
			messages,
			LoggerColors.FgRed,
			LoggerColors.BgBlack,
		);
	}

	/**
	 * Logs a success message.
	 * @param messages - The messages to log.
	 * @returns The Logger instance.
	 */
	success(...messages: unknown[]) {
		return this.__log(
			'SUCCESS',
			messages,
			LoggerColors.FgGreen,
			LoggerColors.BgBlack,
		);
	}

	/**
	 * Logs a debug message.
	 * @param messages - The messages to log.
	 * @returns The Logger instance.
	 */
	debug(...messages: unknown[]) {
		return this.__log(
			'DEBUG',
			messages,
			LoggerColors.FgBlue,
			LoggerColors.BgBlack,
		);
	}

	/**
	 * Logs a verbose message.
	 * @param messages - The messages to log.
	 * @returns The Logger instance.
	 */
	verbose(...messages: unknown[]) {
		return this.__log(
			'VERBOSE',
			messages,
			LoggerColors.FgMagenta,
			LoggerColors.BgBlack,
		);
	}

	/**
	 * Logs a fatal error message.
	 * @param messages - The messages to log.
	 * @returns The Logger instance.
	 */
	fatal(...messages: unknown[]) {
		return this.__log(
			'FATAL',
			messages,
			LoggerColors.FgWhite,
			LoggerColors.BgRed,
		);
	}

	/**
	 * Logs a silly message.
	 * @param messages - The messages to log.
	 * @returns The Logger instance.
	 */
	silly(...messages: unknown[]) {
		return this.__log(
			'SILLY',
			messages,
			LoggerColors.FgGray,
			LoggerColors.BgBlack,
		);
	}

	/**
	 * Logs an HTTP message.
	 * @param messages - The messages to log.
	 * @returns The Logger instance.
	 */
	http(...messages: unknown[]) {
		return this.__log(
			'HTTP',
			messages,
			LoggerColors.FgMagenta,
			LoggerColors.BgBlack,
		);
	}

	/**
	 * Logs a trace message.
	 * @param messages - The messages to log.
	 * @returns The Logger instance.
	 */
	trace(...messages: unknown[]) {
		return this.__log(
			'TRACE',
			messages,
			LoggerColors.FgWhite,
			LoggerColors.BgBlack,
		);
	}

	/**
	 * Starts a timer with a specified label.
	 * @param label - The label for the timer.
	 * @returns The Logger instance.
	 */
	timeStart(label: string) {
		this.timeMap[label] = Date.now();
		return this;
	}

	/**
	 * Ends a timer with a specified label and logs the duration.
	 * @param label - The label for the timer.
	 * @returns The Logger instance.
	 */
	timeEnd(label: string) {
		const startTime = this.timeMap[label];
		if (startTime) {
			const duration = Date.now() - startTime;
			this.__log(
				'TIME',
				[`${label}: ${duration}ms`],
				LoggerColors.FgGreen,
				LoggerColors.BgBlack,
			);
			delete this.timeMap[label];
		} else {
			this.__log(
				'TIME',
				[`${label}: -1ms`],
				LoggerColors.FgRed,
				LoggerColors.BgBlack,
			);
		}
		return this;
	}

	/**
	 * An enumeration of colors for use in the logger.
	 * @readonly
	 * @enum {string}
	 * @example
	 * const color = Logger.COLORS.FgRed;
	 * console.log(`${color}This text is red!${Logger.COLORS.Reset}`);
	 */
	static COLORS = LoggerColors;

	/**
	 * An enumeration of log levels with their corresponding priorities.
	 * @readonly
	 * @enum {number}
	 */
	static LEVELS = LoggerLevels;
}

export {LoggerColors, LoggerLevels};
