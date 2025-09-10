import { convertTelegramImageToCursorFormat } from '../utils';
import { generatePrompt } from '../prompt';

describe('Utils', () => {
  describe('convertTelegramImageToCursorFormat', () => {
    it('should be a function', () => {
      expect(typeof convertTelegramImageToCursorFormat).toBe('function');
    });
  });

  describe('generatePrompt', () => {
    const mockTools = {
      start_cursor_task: {
        description: 'Start a Cursor AI task',
        parameters: {
          type: 'object',
          properties: {
            task_description: { type: 'string' },
            repo_url: { type: 'string' },
          },
        },
      },
      check_task_status: {
        description: 'Check task status',
        parameters: {
          type: 'object',
          properties: {
            composer_id: { type: 'string' },
          },
        },
      },
    };

    it('should generate prompt with system context and tools', () => {
      const systemContext = 'You are a helpful assistant.';
      const prompt = generatePrompt(systemContext, mockTools);

      expect(prompt).toContain('You are a helpful assistant.');
      expect(prompt).toContain('start_cursor_task');
      expect(prompt).toContain('check_task_status');
    });

    it('should include tool parameters', () => {
      const systemContext = 'Test context';
      const prompt = generatePrompt(systemContext, mockTools);

      expect(prompt).toContain('start_cursor_task, check_task_status');
    });

    it('should handle empty tools', () => {
      const systemContext = 'Test context';
      const prompt = generatePrompt(systemContext, {});

      expect(prompt).toContain('Test context');
      expect(prompt).toContain('Available tools:');
    });
  });
});