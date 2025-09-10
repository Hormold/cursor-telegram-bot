import Database from '../database';
import path from 'path';
import fs from 'fs';

// Mock better-sqlite3 completely
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    prepare: jest.fn(() => ({
      run: jest.fn(() => ({ lastInsertRowid: 1 })),
      get: jest.fn(),
      all: jest.fn(() => []),
    })),
    exec: jest.fn(),
    close: jest.fn(),
  }));
});

describe('Database', () => {
  let db: Database;
  let testDbPath: string;

  beforeEach(() => {
    // Create unique test database for each test
    testDbPath = path.join(__dirname, `test-${Date.now()}-${Math.random()}.db`);
    db = new Database(testDbPath);
  });

  afterEach(() => {
    // Clean up test database
    if (db) {
      db.close();
    }
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  describe('constructor', () => {
    it('should create database instance', () => {
      expect(db).toBeInstanceOf(Database);
    });
  });

  describe('saveMessage', () => {
    it('should save message successfully', async () => {
      const message = {
        user_id: 123,
        chat_id: 456,
        text: 'Test message',
        response: 'Test response'
      };

      const result = await db.saveMessage(message);
      expect(typeof result).toBe('number');
    });
  });

  describe('createTask', () => {
    it('should create task and return task ID', async () => {
      const task = {
        user_id: 123,
        chat_id: 456,
        composer_id: 'bc-test-123',
        repo_url: 'https://github.com/test/repo',
        task_description: 'Test task',
        status: 'RUNNING' as const
      };

      const taskId = await db.createTask(task);
      expect(typeof taskId).toBe('number');
      expect(taskId).toBeGreaterThan(0);
    });
  });

  describe('getActiveTasks', () => {
    it('should return array of tasks', async () => {
      const tasks = await db.getActiveTasks();
      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe('getTaskByComposerId', () => {
    it('should handle task retrieval', async () => {
      const task = await db.getTaskByComposerId('test-id');
      // getTaskByComposerId returns undefined when not found (mocked prepare().get() returns undefined)
      expect(task).toBeUndefined();
    });
  });

  describe('clearHistory', () => {
    it('should clear history without errors', async () => {
      await expect(db.clearHistory(123, 456)).resolves.not.toThrow();
    });
  });

  describe('saveConversationMessage', () => {
    it('should save conversation message', async () => {
      const message = {
        user_id: 123,
        chat_id: 456,
        message_data: JSON.stringify({ content: 'Test' }),
        message_type: 'user',
        role: 'user',
        content: 'Test',
        timestamp: new Date().toISOString(),
        task_id: 1
      };

      await expect(db.saveConversationMessage(message)).resolves.not.toThrow();
    });
  });
});