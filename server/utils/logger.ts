/**
 * Structured Logging Utility
 * Replaces console.log with structured, leveled logging
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  service: string;
  environment: string;
}

class Logger {
  private minLevel: LogLevel;
  private service: string;
  private environment: string;

  constructor() {
    this.minLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'INFO');
    this.service = 'va-dashboard';
    this.environment = process.env.NODE_ENV || 'development';
  }

  private parseLogLevel(level: string): LogLevel {
    const normalized = level.toUpperCase();
    return LogLevel[normalized as keyof typeof LogLevel] ?? LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private formatLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      service: this.service,
      environment: this.environment,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    return entry;
  }

  private write(entry: LogEntry): void {
    const output = JSON.stringify(entry);

    // In development, also output human-readable format
    if (this.environment === 'development' || this.environment === 'test') {
      const color = this.getColorForLevel(entry.level);
      const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      const errorStr = entry.error ? `\n  Error: ${entry.error.message}\n  ${entry.error.stack}` : '';
      console.log(`${color}[${entry.level}]${this.resetColor} ${entry.message}${contextStr}${errorStr}`);
    } else {
      // In production, output JSON for log aggregation
      console.log(output);
    }
  }

  private getColorForLevel(level: string): string {
    switch (level) {
      case 'DEBUG':
        return '\x1b[36m'; // Cyan
      case 'INFO':
        return '\x1b[32m'; // Green
      case 'WARN':
        return '\x1b[33m'; // Yellow
      case 'ERROR':
        return '\x1b[31m'; // Red
      case 'FATAL':
        return '\x1b[35m'; // Magenta
      default:
        return '';
    }
  }

  private get resetColor(): string {
    return '\x1b[0m';
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const entry = this.formatLogEntry(LogLevel.DEBUG, message, context);
    this.write(entry);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const entry = this.formatLogEntry(LogLevel.INFO, message, context);
    this.write(entry);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    const entry = this.formatLogEntry(LogLevel.WARN, message, context);
    this.write(entry);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    const entry = this.formatLogEntry(LogLevel.ERROR, message, context, error);
    this.write(entry);
  }

  /**
   * Log fatal error message
   */
  fatal(message: string, error?: Error, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.FATAL)) return;
    const entry = this.formatLogEntry(LogLevel.FATAL, message, context, error);
    this.write(entry);
  }

  /**
   * Create child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger();
    const originalWrite = childLogger.write.bind(childLogger);
    childLogger.write = (entry: LogEntry) => {
      entry.context = { ...context, ...entry.context };
      originalWrite(entry);
    };
    return childLogger;
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel | string): void {
    if (typeof level === 'string') {
      this.minLevel = this.parseLogLevel(level);
    } else {
      this.minLevel = level;
    }
  }
}

// Singleton instance
export const logger = new Logger();

// Convenience exports
export const log = {
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  warn: (message: string, context?: LogContext) => logger.warn(message, context),
  error: (message: string, error?: Error, context?: LogContext) => logger.error(message, error, context),
  fatal: (message: string, error?: Error, context?: LogContext) => logger.fatal(message, error, context),
  child: (context: LogContext) => logger.child(context),
};

// Export default logger
export default logger;
