enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel;
  private context?: string;

  constructor(context?: string) {
    this.context = context;
    this.level = this.parseLogLevel(process.env.LOG_LEVEL || 'INFO');
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toUpperCase()) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const prefix = this.context ? `[${this.context}]` : '';
    return `${timestamp} [${level}]${prefix} ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(this.formatMessage('DEBUG', message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(this.formatMessage('INFO', message), ...args);
    }
  }

  log(message: string, ...args: any[]): void {
    this.info(message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message), ...args);
    }
  }

  error(message: string | Error, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      if (message instanceof Error) {
        console.error(this.formatMessage('ERROR', message.message), message.stack, ...args);
      } else {
        console.error(this.formatMessage('ERROR', message), ...args);
      }
    }
  }

  child(context: string): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    return new Logger(childContext);
  }
}

export const logger = new Logger();
export const createLogger = (context: string) => new Logger(context);
export default Logger;