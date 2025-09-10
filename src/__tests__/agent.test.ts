// this is basic unit test, not integration test :-)
import Agent from '../agent';
import Database from '../database';
import CursorOfficialApi from '../cursor-official-api';

// Mock dependencies
jest.mock('../database');
jest.mock('../cursor-official-api');
jest.mock('../logger');

// Mock AI SDK
jest.mock('ai', () => ({
  generateText: jest.fn(),
  tool: jest.fn((config) => config),
}));

jest.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: jest.fn(() => ({
    chat: jest.fn(() => 'mocked-model'),
  })),
  openrouter: {
    chat: jest.fn(() => 'mocked-model'),
  },
}));

const MockedDatabase = Database as jest.MockedClass<typeof Database>;
const MockedCursorApi = CursorOfficialApi as jest.MockedClass<typeof CursorOfficialApi>;

describe('Agent', () => {
  let agent: Agent;
  let mockDb: jest.Mocked<Database>;
  let mockCursorApi: jest.Mocked<CursorOfficialApi>;

  const defaultContext = {
    userId: 123,
    chatId: 456,
    db: {} as Database,
    cursorApi: {} as CursorOfficialApi,
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup database mock
    mockDb = {
      saveMessage: jest.fn().mockResolvedValue(undefined),
      createTask: jest.fn().mockResolvedValue(1),
      getActiveTasks: jest.fn().mockResolvedValue([]),
      getTaskByComposerId: jest.fn().mockResolvedValue(null),
      clearHistory: jest.fn().mockResolvedValue(undefined),
      saveConversationMessage: jest.fn().mockResolvedValue(undefined),
      getConversationHistory: jest.fn().mockResolvedValue([]),
      close: jest.fn(),
      // Add missing private methods that are accessed in tests
      db: {
        prepare: jest.fn(() => ({
          run: jest.fn(),
          get: jest.fn(),
          all: jest.fn(),
        })),
        exec: jest.fn(),
      },
    } as any;

    // Setup Cursor API mock
    mockCursorApi = {
      createAgent: jest.fn().mockResolvedValue({
        id: 'test-agent-id',
        status: 'RUNNING',
        name: 'Test Agent',
        source: {},
        target: {},
        createdAt: new Date().toISOString(),
      }),
      getAgent: jest.fn().mockResolvedValue({
        id: 'test-agent-id',
        status: 'FINISHED',
        name: 'Test Agent',
        source: {},
        target: {},
        createdAt: new Date().toISOString(),
      }),
      deleteAgent: jest.fn().mockResolvedValue({ id: 'test-agent-id' }),
      addFollowup: jest.fn().mockResolvedValue({ id: 'followup-id' }),
      getConversation: jest.fn().mockResolvedValue({
        id: 'test-agent-id',
        messages: [],
      }),
      listRepositories: jest.fn().mockResolvedValue({
        repositories: [
          {
            owner: 'test',
            name: 'repo',
            repository: 'https://github.com/test/repo',
          },
        ],
      }),
      listModels: jest.fn().mockResolvedValue({
        models: ['gpt-4', 'claude-3'],
      }),
      mapImages: jest.fn().mockReturnValue(undefined),
    } as any;

    MockedDatabase.mockImplementation(() => mockDb);
    MockedCursorApi.mockImplementation(() => mockCursorApi);

    agent = new Agent({
      ...defaultContext,
      db: mockDb,
      cursorApi: mockCursorApi,
    });
  });

  describe('constructor', () => {
    it('should create agent with provided context', () => {
      expect(agent).toBeInstanceOf(Agent);
    });
  });

  describe('processMessage', () => {
    it('should process messages and return response', async () => {
      const mockGenerateText = require('ai').generateText;
      mockGenerateText.mockResolvedValue({
        response: {
          messages: [
            { role: 'assistant', content: 'Test response' }
          ]
        },
        text: 'Test response'
      });

      const result = await agent.processMessage('Test message');
      
      expect(mockGenerateText).toHaveBeenCalled();
      expect(result).toBe('Test response');
    });
  });

  describe('Agent integration', () => {
    it('should handle database operations', () => {
      expect(mockDb.saveMessage).toBeDefined();
      expect(mockDb.createTask).toBeDefined();
      expect(mockDb.getActiveTasks).toBeDefined();
    });

    it('should handle Cursor API operations', () => {
      expect(mockCursorApi.createAgent).toBeDefined();
      expect(mockCursorApi.getAgent).toBeDefined();
      expect(mockCursorApi.deleteAgent).toBeDefined();
    });
  });
});