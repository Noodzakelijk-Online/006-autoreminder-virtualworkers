/**
 * Logger Service - Centralized logging for the server
 */

import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  context: string;
  message: string;
  data?: any;
}

class Logger {
  private logFile: string;
  private errorFile: string;

  constructor() {
    const date = new Date().toISOString().split('T')[0];
    this.logFile = path.join(LOG_DIR, `server-${date}.log`);
    this.errorFile = path.join(LOG_DIR, `server-errors-${date}.log`);
  }

  private writeLog(entry: LogEntry) {
    const logLine = JSON.stringify(entry) + '\n';
    
    // Write to console
    const color = {
      'INFO': '\x1b[36m',    // Cyan
      'WARN': '\x1b[33m',    // Yellow
      'ERROR': '\x1b[31m',   // Red
      'DEBUG': '\x1b[35m',   // Magenta
    }[entry.level];
    const reset = '\x1b[0m';
    
    console.log(`${color}[${entry.timestamp}] [${entry.level}] [${entry.context}] ${entry.message}${reset}`, entry.data || '');
    
    // Write to file
    try {
      fs.appendFileSync(this.logFile, logLine);
      
      // Also write errors to separate file
      if (entry.level === 'ERROR') {
        fs.appendFileSync(this.errorFile, logLine);
      }
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  info(context: string, message: string, data?: any) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      context,
      message,
      data,
    });
  }

  warn(context: string, message: string, data?: any) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      context,
      message,
      data,
    });
  }

  error(context: string, message: string, error?: any) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      context,
      message,
      data: error ? {
        message: error.message,
        stack: error.stack,
        code: error.code,
      } : undefined,
    });
  }

  debug(context: string, message: string, data?: any) {
    if (process.env.DEBUG === 'true') {
      this.writeLog({
        timestamp: new Date().toISOString(),
        level: 'DEBUG',
        context,
        message,
        data,
      });
    }
  }

  /**
   * Get recent logs
   */
  getRecentLogs(lines: number = 100): string {
    try {
      const content = fs.readFileSync(this.logFile, 'utf-8');
      return content.split('\n').slice(-lines).join('\n');
    } catch (err) {
      return 'No logs available';
    }
  }

  /**
   * Get recent errors
   */
  getRecentErrors(lines: number = 50): string {
    try {
      const content = fs.readFileSync(this.errorFile, 'utf-8');
      return content.split('\n').slice(-lines).join('\n');
    } catch (err) {
      return 'No errors logged';
    }
  }
}

export const logger = new Logger();
