import { logger } from './logger';
import BetterSqlite3 from 'better-sqlite3';
import { CoreMessage } from 'ai';
import * as fs from 'fs';
import * as path from 'path';

export interface User {
  id: number;
  username?: string;
  first_name?: string;
  created_at: string;
}

export interface Chat {
  id: number;
  title?: string;
  type: string;
  created_at: string;
}

export interface Message {
  id: number;
  user_id: number;
  chat_id: number;
  text: string;
  response?: string;
  created_at: string;
}

// New interface for storing complete conversation history
export interface ConversationMessage {
  id: number;
  user_id: number;
  chat_id: number;
  message_data: string; // JSON string of CoreMessage
  message_type: 'user' | 'assistant' | 'tool';
  step_number: number;
  is_final: boolean;
  created_at: string;
}

// Interface for conversation steps (from onStepFinish)
export interface ConversationStep {
  id?: number;
  user_id: number;
  chat_id: number;
  step_number: number;
  step_data: string; // JSON string of step data
  created_at: string;
}

export interface Task {
  id: number;
  user_id: number;
  chat_id: number;
  composer_id: string;
  repo_url: string;
  task_description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Config {
  key: string;
  value: string;
  updated_at: string;
}

export class Database {
  private db: BetterSqlite3.Database;

  constructor(dbPath: string = process.env.DB_PATH || 'bot.db') {
    // Ensure directory exists for the database file
    const dbDir = path.dirname(dbPath);
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new BetterSqlite3(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY,
        title TEXT,
        type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        chat_id INTEGER,
        text TEXT,
        response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (chat_id) REFERENCES chats (id)
      )
    `);

    // New table for complete conversation history
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        chat_id INTEGER,
        message_data TEXT NOT NULL,
        message_type TEXT NOT NULL,
        step_number INTEGER DEFAULT 0,
        is_final INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (chat_id) REFERENCES chats (id)
      )
    `);

    // New table for storing step data from onStepFinish
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        chat_id INTEGER,
        step_number INTEGER,
        step_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (chat_id) REFERENCES chats (id)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        chat_id INTEGER,
        composer_id TEXT,
        repo_url TEXT,
        task_description TEXT,
        status TEXT DEFAULT 'CREATING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (chat_id) REFERENCES chats (id)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async getUser(id: number): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | null;
  }

  async createUser(user: Omit<User, 'created_at'>): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO users (id, username, first_name)
      VALUES (?, ?, ?)
    `);
    stmt.run(
      user.id, 
      user.username || null, 
      user.first_name || null
    );
  }

  async getChat(id: number): Promise<Chat | null> {
    const stmt = this.db.prepare('SELECT * FROM chats WHERE id = ?');
    return stmt.get(id) as Chat | null;
  }

  async createChat(chat: Omit<Chat, 'created_at'>): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO chats (id, title, type)
      VALUES (?, ?, ?)
    `);
    stmt.run(
      chat.id, 
      chat.title || null, 
      chat.type
    );
  }

  async saveMessage(message: Omit<Message, 'id' | 'created_at'>): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO messages (user_id, chat_id, text, response)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(message.user_id, message.chat_id, message.text, message.response);
    return result.lastInsertRowid as number;
  }

  async getMessages(userId: number, chatId: number, limit: number = 10): Promise<Message[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE user_id = ? AND chat_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(userId, chatId, limit) as Message[];
  }

  // New methods for conversation history
  async saveConversationMessage(message: Omit<ConversationMessage, 'id' | 'created_at'>): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO conversation_messages (user_id, chat_id, message_data, message_type, step_number, is_final)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      message.user_id, 
      message.chat_id, 
      message.message_data, 
      message.message_type, 
      message.step_number, 
      message.is_final ? 1 : 0
    );
    return result.lastInsertRowid as number;
  }

  async getConversationMessages(userId: number, chatId: number, limit: number = 50): Promise<ConversationMessage[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM conversation_messages 
      WHERE user_id = ? AND chat_id = ?
      ORDER BY created_at ASC, step_number ASC
      LIMIT ?
    `);
    return stmt.all(userId, chatId, limit) as ConversationMessage[];
  }

  async saveConversationStep(step: Omit<ConversationStep, 'id' | 'created_at'>): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO conversation_steps (user_id, chat_id, step_number, step_data)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(step.user_id, step.chat_id, step.step_number, step.step_data);
    return result.lastInsertRowid as number;
  }

  async getConversationSteps(userId: number, chatId: number, limit: number = 50): Promise<ConversationStep[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM conversation_steps 
      WHERE user_id = ? AND chat_id = ?
      ORDER BY created_at ASC, step_number ASC
      LIMIT ?
    `);
    return stmt.all(userId, chatId, limit) as ConversationStep[];
  }

  // Helper method to get conversation history as CoreMessage[]
  async getConversationHistory(userId: number, chatId: number, limit: number = 50): Promise<CoreMessage[]> {
    const messages = await this.getConversationMessages(userId, chatId, limit);
    return messages.map(msg => {
      try {
        return JSON.parse(msg.message_data) as CoreMessage;
      } catch (error) {
        logger.error('Error parsing message data:', error);
        return { role: 'user', content: 'Error parsing message' } as CoreMessage;
      }
    });
  }

  async createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (user_id, chat_id, composer_id, repo_url, task_description, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(task.user_id, task.chat_id, task.composer_id, task.repo_url, task.task_description, task.status);
    return result.lastInsertRowid as number;
  }

  async updateTask(id: number, status: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE tasks 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(status, id);
  }

  async getActiveTasks(): Promise<Task[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks 
      WHERE status NOT IN ('CANCELLED', 'COMPLETED')
      ORDER BY created_at DESC
    `);
    return stmt.all() as Task[];
  }

  async getTaskByComposerId(composerId: string): Promise<Task | null> {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE composer_id = ?');
    return stmt.get(composerId) as Task | null;
  }

  async getConfig(key: string): Promise<string | null> {
    const stmt = this.db.prepare('SELECT value FROM config WHERE key = ?');
    const result = stmt.get(key) as { value: string } | null;
    return result?.value || null;
  }

  async setConfig(key: string, value: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO config (key, value)
      VALUES (?, ?)
    `);
    stmt.run(key, value);
  }

  async clearHistory(userId: number, chatId: number): Promise<void> {
    this.db.exec(`DELETE FROM messages WHERE user_id = ${userId} AND chat_id = ${chatId}`);
    this.db.exec(`DELETE FROM conversation_messages WHERE user_id = ${userId} AND chat_id = ${chatId}`);
    this.db.exec(`DELETE FROM conversation_steps WHERE user_id = ${userId} AND chat_id = ${chatId}`);
  }

  // Removed cookie helpers: official API uses CURSOR_API_KEY

  close(): void {
    this.db.close();
  }
}

export default Database;
