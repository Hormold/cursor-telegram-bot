import Logger, { logger, createLogger } from '../logger';

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let originalLogLevel: string | undefined;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    originalLogLevel = process.env.LOG_LEVEL;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    if (originalLogLevel !== undefined) {
      process.env.LOG_LEVEL = originalLogLevel;
    } else {
      delete process.env.LOG_LEVEL;
    }
  });

  describe('constructor', () => {
    it('should create logger without context', () => {
      const testLogger = new Logger();
      expect(testLogger).toBeInstanceOf(Logger);
    });

    it('should create logger with context', () => {
      const testLogger = new Logger('test-context');
      expect(testLogger).toBeInstanceOf(Logger);
    });
  });

  describe('log levels', () => {
    it('should respect DEBUG log level', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      const testLogger = new Logger();

      testLogger.debug('debug message');
      testLogger.info('info message');
      testLogger.warn('warn message');
      testLogger.error('error message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2); // debug + info
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should respect INFO log level', () => {
      process.env.LOG_LEVEL = 'INFO';
      const testLogger = new Logger();

      testLogger.debug('debug message');
      testLogger.info('info message');
      testLogger.warn('warn message');
      testLogger.error('error message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1); // only info
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should respect WARN log level', () => {
      process.env.LOG_LEVEL = 'WARN';
      const testLogger = new Logger();

      testLogger.debug('debug message');
      testLogger.info('info message');
      testLogger.warn('warn message');
      testLogger.error('error message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(0);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should respect ERROR log level', () => {
      process.env.LOG_LEVEL = 'ERROR';
      const testLogger = new Logger();

      testLogger.debug('debug message');
      testLogger.info('info message');
      testLogger.warn('warn message');
      testLogger.error('error message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(0);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(0);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('message formatting', () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = 'DEBUG';
    });

    it('should format messages with timestamp and level', () => {
      const testLogger = new Logger();
      testLogger.info('test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[INFO\] test message$/),
      );
    });

    it('should include context in formatted messages', () => {
      const testLogger = new Logger('test-context');
      testLogger.info('test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[INFO\]\[test-context\] test message$/),
      );
    });

    it('should pass additional arguments', () => {
      const testLogger = new Logger();
      const obj = { key: 'value' };
      testLogger.info('test message', obj, 'extra');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/test message$/),
        obj,
        'extra'
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = 'DEBUG';
    });

    it('should handle Error objects', () => {
      const testLogger = new Logger();
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test';

      testLogger.error(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Test error$/),
        error.stack
      );
    });

    it('should handle string error messages', () => {
      const testLogger = new Logger();
      testLogger.error('String error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/String error$/),
      );
    });
  });

  describe('child logger', () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = 'DEBUG';
    });

    it('should create child logger with extended context', () => {
      const parentLogger = new Logger('parent');
      const childLogger = parentLogger.child('child');

      childLogger.info('test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[INFO\]\[parent:child\] test message$/),
      );
    });

    it('should create child logger from logger without context', () => {
      const parentLogger = new Logger();
      const childLogger = parentLogger.child('child');

      childLogger.info('test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[INFO\]\[child\] test message$/),
      );
    });
  });

  describe('log method alias', () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = 'DEBUG';
    });

    it('should behave same as info', () => {
      const testLogger = new Logger();
      testLogger.log('test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[INFO\] test message$/),
      );
    });
  });

  describe('module exports', () => {
    it('should export default logger instance', () => {
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should export createLogger function', () => {
      const customLogger = createLogger('custom');
      expect(customLogger).toBeInstanceOf(Logger);
    });
  });

  describe('invalid log level', () => {
    it('should default to INFO for invalid log level', () => {
      process.env.LOG_LEVEL = 'INVALID';
      const testLogger = new Logger();

      testLogger.debug('debug message');
      testLogger.info('info message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1); // only info, no debug
    });
  });
});