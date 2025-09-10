import CursorOfficialApi from '../cursor-official-api';
import { AgentImage } from '../types/cursor-official';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('CursorOfficialApi', () => {
  let api: CursorOfficialApi;
  const mockApiKey = 'test-api-key';
  const mockBaseUrl = 'https://api.test.com';

  beforeEach(() => {
    api = new CursorOfficialApi({
      apiKey: mockApiKey,
      baseUrl: mockBaseUrl,
      timeoutMs: 5000,
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(api).toBeInstanceOf(CursorOfficialApi);
    });

    it('should use default baseUrl when not provided', () => {
      const defaultApi = new CursorOfficialApi({ apiKey: 'test' });
      expect(defaultApi).toBeInstanceOf(CursorOfficialApi);
    });
  });

  describe('createAgent', () => {
    const mockResponse = {
      id: 'test-agent-id',
      name: 'Test Agent',
      status: 'RUNNING' as const,
      source: { repository: 'test-repo' },
      target: {},
      createdAt: '2023-01-01T00:00:00Z',
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);
    });

    it('should create agent with minimal params', async () => {
      const result = await api.createAgent({
        text: 'Test task',
        repository: 'https://github.com/test/repo',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/v0/agents`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'accept': 'application/json',
            'content-type': 'application/json',
            'authorization': `Bearer ${mockApiKey}`,
          }),
          body: JSON.stringify({
            prompt: {
              text: 'Test task',
            },
            source: {
              repository: 'https://github.com/test/repo',
            },
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should create agent with all params', async () => {
      const images: AgentImage[] = [{
        data: 'base64-image-data',
        dimension: { width: 100, height: 100 },
      }];

      await api.createAgent({
        text: 'Test task',
        repository: 'https://github.com/test/repo',
        ref: 'main',
        model: 'gpt-4',
        images,
        webhook: { url: 'https://webhook.test' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/v0/agents`,
        expect.objectContaining({
          body: JSON.stringify({
            prompt: {
              text: 'Test task',
              images,
            },
            model: 'gpt-4',
            source: {
              repository: 'https://github.com/test/repo',
              ref: 'main',
            },
            webhook: { url: 'https://webhook.test' },
          }),
        })
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid request',
      } as Response);

      await expect(api.createAgent({
        text: 'Test task',
        repository: 'https://github.com/test/repo',
      })).rejects.toThrow('HTTP 400 Bad Request: Invalid request');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(api.createAgent({
        text: 'Test task',
        repository: 'https://github.com/test/repo',
      })).rejects.toThrow('Network error');
    });
  });

  describe('getAgent', () => {
    it('should get agent by id', async () => {
      const mockAgent = {
        id: 'test-id',
        name: 'Test Agent',
        status: 'FINISHED' as const,
        source: {},
        target: {},
        createdAt: '2023-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockAgent,
      } as Response);

      const result = await api.getAgent('test-id');

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/v0/agents/test-id`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'authorization': `Bearer ${mockApiKey}`,
          }),
        })
      );

      expect(result).toEqual(mockAgent);
    });

    it('should encode agent id in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);

      await api.getAgent('test/id with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/v0/agents/test%2Fid%20with%20spaces`,
        expect.any(Object)
      );
    });
  });

  describe('deleteAgent', () => {
    it('should delete agent', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test-id' }),
      } as Response);

      const result = await api.deleteAgent('test-id');

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/v0/agents/test-id`,
        expect.objectContaining({
          method: 'DELETE',
        })
      );

      expect(result).toEqual({ id: 'test-id' });
    });
  });

  describe('addFollowup', () => {
    it('should add followup message', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'followup-id' }),
      } as Response);

      const result = await api.addFollowup('agent-id', 'Follow up text');

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/v0/agents/agent-id/followup`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            prompt: {
              text: 'Follow up text',
            },
          }),
        })
      );

      expect(result).toEqual({ id: 'followup-id' });
    });
  });

  describe('mapImages', () => {
    it('should return undefined for empty images', () => {
      expect(api.mapImages([])).toBeUndefined();
      expect(api.mapImages(undefined)).toBeUndefined();
    });

    it('should map images correctly', () => {
      const images: AgentImage[] = [{
        data: 'test-data',
        dimension: { width: 100, height: 200 },
      }];

      const result = api.mapImages(images);

      expect(result).toEqual([{
        data: 'test-data',
        dimension: { width: 100, height: 200 },
      }]);
    });
  });

  describe('timeout handling', () => {
    it('should timeout requests', async () => {
      const slowApi = new CursorOfficialApi({
        apiKey: 'test',
        timeoutMs: 100,
      });

      // Mock a slow response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(slowApi.getAgent('test-id')).rejects.toThrow();
    });
  });
});