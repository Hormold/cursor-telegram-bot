import 'dotenv/config';

import { generateText, tool, ToolSet, CoreMessage } from 'ai';
import { z } from 'zod';
import CursorApi from './cursor-api';
import { Database } from './database';
import { SupportedModel } from './types/cursor-api';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generatePrompt } from './prompt';
const apiKey = process.env.OPENROUTER_API_KEY;
const openrouterModel = process.env.OPENROUTER_MODEL || 'openai/gpt-4.1';
const openrouter = createOpenRouter({
  apiKey,
});


interface AgentContext {
  userId: number;
  chatId: number;
  db: Database;
  cursorApi: CursorApi;
}

// Factory function to create tools with context
function createToolsWithContext(context: AgentContext): ToolSet {
  return {
    setCookies: tool({
      description: 'Set Cursor API cookies in database',
      parameters: z.object({
        cookies: z.string().describe('Cursor API cookies string')
      }),
      execute: async ({ cookies }: { cookies: string }) => {
        console.log(`Set cookies: ${cookies}`);
        await context.db.setCookies(cookies);
        return { success: true, message: 'Cookies saved successfully' };
      }
    }),

    validateCookies: tool({
      description: 'Validate current Cursor API cookies by testing API connection',
      parameters: z.object({dummy: z.string().describe('Dummy parameter')}),
      execute: async () => {
        try {
          const cookies = await context.db.getCookies();
          if (!cookies) {
            return { 
              valid: false, 
              message: 'No cookies found in database' 
            };
          }
          
          // Create fresh CursorApi instance with current cookies
          const testCursorApi = new CursorApi({ cookies });
          await testCursorApi.getGitHubInstallations();
          
          // Update context with validated instance
          context.cursorApi = testCursorApi;
          
          return { valid: true, message: 'Cookies are valid' };
        } catch (error) {
          return { 
            valid: false, 
            message: `Cookies are invalid: ${error instanceof Error ? error.message : 'Unknown error'}` 
          };
        }
      }
    }),

    getRepos: tool({
      description: 'Get available GitHub repositories',
      parameters: z.object({dummy: z.string().describe('Dummy parameter')}),
      execute: async () => {
        try {
          const cookies = await context.db.getCookies();
          if (!cookies) {
            return { 
              error: 'No cookies found. Please set Cursor API cookies first.' 
            };
          }
          
          // Create fresh CursorApi instance with current cookies
          const cursorApi = new CursorApi({ cookies });
          const installations = await cursorApi.getGitHubInstallations();
          const repos = [];
          
          for (const installation of installations.installations) {
            const installationRepos = await cursorApi.fetchAllInstallationRepos({
              installationId: installation.installationId,
              totalPages: installation.totalPages
            });
            repos.push(...installationRepos.repos);
          }
          
          // Update context with validated instance
          context.cursorApi = cursorApi;
          
          return { 
            repos: repos.map(r => ({ 
              name: r.name, 
              owner: r.owner, 
              url: r.htmlUrl 
            }))
          };
        } catch (error) {
          return { 
            error: `Failed to get repos: ${error instanceof Error ? error.message : 'Unknown error'}` 
          };
        }
      }
          }),

    startTask: tool({
      description: 'Start a new Cursor AI task in a repository. Available models: claude-4-sonnet-thinking (default), o3',
      parameters: z.object({
        repoUrl: z.string().describe('Repository URL'),
        taskDescription: z.string().describe('Task description for AI'),
        branch: z.string().default('main').describe('Branch name (default: main)'),
        model: z.enum([SupportedModel.CLAUDE_4_SONNET_THINKING, SupportedModel.O3]).default(SupportedModel.CLAUDE_4_SONNET_THINKING).describe('AI model to use (default: claude-4-sonnet-thinking)')
      }),
      execute: async ({ repoUrl, taskDescription, branch, model }: { repoUrl: string; taskDescription: string; branch?: string; model?: SupportedModel }) => {
        try {
          const cookies = await context.db.getCookies();
          if (!cookies) {
            return { 
              error: 'No cookies found. Please set Cursor API cookies first.' 
            };
          }
          
          // Check if repo is allowed
          const allowedRepos = process.env.ALLOWED_REPOS ? process.env.ALLOWED_REPOS.split(',').map(r => r.trim()) : [];
          if (allowedRepos.length > 0 && !allowedRepos.includes(repoUrl)) {
            return { 
              error: `Repository ${repoUrl} is not in allowed list. Allowed repos: ${allowedRepos.join(', ')}` 
            };
          }

          // Create fresh CursorApi instance and start the task
          const cursorApi = new CursorApi({ cookies });
          const result = await cursorApi.startSimpleComposer(repoUrl, taskDescription, branch, model);
          
          // Update context with validated instance
          context.cursorApi = cursorApi;
          
          // Save task to database
          const taskId = await context.db.createTask({
            user_id: context.userId,
            chat_id: context.chatId,
            composer_id: result.composer.bcId,
            repo_url: repoUrl,
            task_description: taskDescription,
            status: result.composer.status
          });

          return {
            success: true,
            composerId: result.composer.bcId,
            taskId,
            message: `Task started in ${repoUrl} with model ${model}: ${taskDescription}`
          };
        } catch (error) {
          return { 
            error: `Failed to start task: ${error instanceof Error ? error.message : 'Unknown error'}` 
          };
        }
      }
    }),

    getTaskStatus: tool({
      description: 'Get status of a specific task by composer ID',
      parameters: z.object({
        composerId: z.string().describe('Composer ID')
      }),
      execute: async ({ composerId }: { composerId: string }) => {
        try {
          const cookies = await context.db.getCookies();
          if (!cookies) {
            return { 
              error: 'No cookies found. Please set Cursor API cookies first.' 
            };
          }
          
          const cursorApi = new CursorApi({ cookies });
          const composer = await cursorApi.findComposerById(composerId);
          if (!composer) {
            return { error: `Composer ${composerId} not found` };
          }

          // Update context with validated instance
          context.cursorApi = cursorApi;

          // Update task status in database
          const task = await context.db.getTaskByComposerId(composerId);
          if (task) {
            await context.db.updateTask(task.id, composer.status);
          }

          return {
            composerId,
            status: composer.status,
            name: composer.name,
            repoUrl: composer.repoUrl,
            branchName: composer.branchName,
            createdAt: new Date(composer.createdAtMs).toISOString(),
            updatedAt: new Date(composer.updatedAtMs).toISOString()
          };
        } catch (error) {
          return { 
            error: `Failed to get task status: ${error instanceof Error ? error.message : 'Unknown error'}` 
          };
        }
      }
    }),

    getActiveTasks: tool({
      description: 'Get all active tasks for current user',
      parameters: z.object({dummy: z.string().describe('Dummy parameter')}),
      execute: async () => {
        const tasks = await context.db.getActiveTasks();
        const userTasks = tasks.filter(t => t.user_id === context.userId && t.chat_id === context.chatId);
        
        return { 
          tasks: userTasks.map(t => ({
            id: t.id,
            composerId: t.composer_id,
            repoUrl: t.repo_url,
            description: t.task_description,
            status: t.status,
            createdAt: t.created_at
          }))
        };
      }
    }),

    stopTask: tool({
      description: 'Stop/archive a running task',
      parameters: z.object({
        composerId: z.string().describe('Composer ID to stop')
      }),
      execute: async ({ composerId }: { composerId: string }) => {
        try {
          const cookies = await context.db.getCookies();
          if (!cookies) {
            return { 
              error: 'No cookies found. Please set Cursor API cookies first.' 
            };
          }
          
          const cursorApi = new CursorApi({ cookies });
          await cursorApi.archiveBackgroundComposer({ bcId: composerId });
          
          // Update context with validated instance
          context.cursorApi = cursorApi;
          
          // Update task status in database
          const task = await context.db.getTaskByComposerId(composerId);
          if (task) {
            await context.db.updateTask(task.id, 'CANCELLED');
          }

          return {
            success: true,
            message: `Task ${composerId} has been stopped`
          };
        } catch (error) {
          return { 
            error: `Failed to stop task: ${error instanceof Error ? error.message : 'Unknown error'}` 
          };
        }
      }
    }),

    sendButtonMessage: tool({
      description: 'Send a message with Telegram inline buttons for external links',
      parameters: z.object({
        text: z.string().describe('Message text to send'),
        buttons: z.array(z.object({
          text: z.string().describe('Button text'),
          url: z.string().describe('Button URL')
        })).describe('Array of buttons with text and URL')
      }),
      execute: async ({ text, buttons }: { text: string; buttons: Array<{ text: string; url: string }> }) => {
        return {
          type: 'button_message',
          text,
          buttons,
          message: 'Button message prepared for Telegram'
        };
      }
    })
  };
}

export class Agent {
  private context: AgentContext;
  private tools: ReturnType<typeof createToolsWithContext>;
  private currentStepNumber: number = 0;

  constructor(context: AgentContext) {
    this.context = context;
    this.tools = createToolsWithContext(context);
  }

  private async validateAndRespond(): Promise<string> {
    const cookies = await this.context.db.getCookies();
    if (!cookies) {
      return '❌ No cookies found';
    }

    try {
      const tempCursorApi = new CursorApi({ cookies });
      await tempCursorApi.getGitHubInstallations();
      return '✅ Cookies are valid and working!';
    } catch (error) {
      return `❌ Cookies are invalid: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async saveConversationHistory(messages: CoreMessage[]): Promise<void> {
    try {
      for (const message of messages) {
        await this.context.db.saveConversationMessage({
          user_id: this.context.userId,
          chat_id: this.context.chatId,
          message_data: JSON.stringify(message),
          message_type: message.role as 'user' | 'assistant' | 'tool',
          step_number: this.currentStepNumber,
          is_final: true
        });
      }
    } catch (error) {
      console.error('Error saving conversation history:', error);
    }
  }

  private async saveStepData(stepData: any): Promise<void> {
    try {
      await this.context.db.saveConversationStep({
        user_id: this.context.userId,
        chat_id: this.context.chatId,
        step_number: this.currentStepNumber,
        step_data: JSON.stringify(stepData)
      });
    } catch (error) {
      console.error('Error saving step data:', error);
    }
  }

  async processMessage(message: string): Promise<string | { type: 'button_message'; text: string; buttons: Array<{ text: string; url: string }> }> {
    // Auto-detect cookies in message
    const cookiePatterns = [
      /set cookies?:\s*(.+)/i,
      /cookies?:\s*(.+)/i,
      /^[a-zA-Z0-9_-]+=[^;]+(?:;\s*[a-zA-Z0-9_-]+=[^;]+)*$/,
      /^[a-zA-Z0-9_-]+=[^;]+(?:;\s*[a-zA-Z0-9_-]+=[^;]+)*;?\s*$/
    ];

    for (const pattern of cookiePatterns) {
      const match = message.match(pattern);
      if (match) {
        const cookieValue = match[1] || match[0];
        if (cookieValue && cookieValue.length > 50) { // Basic validation
          try {
            await this.context.db.setCookies(cookieValue.trim());
            // Update the CursorApi instance with new cookies
            this.context.cursorApi = new CursorApi({ cookies: cookieValue.trim() });
            return `✅ Cookies saved successfully! Let me validate them...\n\n${await this.validateAndRespond()}`;
          } catch (error) {
            return `❌ Failed to save cookies: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }
    }

    // Reset step number for new conversation
    this.currentStepNumber = 0;

    // Save user message to conversation history
    const userMessage: CoreMessage = { role: 'user', content: message };
    await this.saveConversationHistory([userMessage]);

    // Get conversation history from database
    const conversationHistory = await this.context.db.getConversationHistory(
      this.context.userId, 
      this.context.chatId, 
      50
    );


    // Get current system state
    const activeTasks = await this.context.db.getActiveTasks();
    const userTasks = activeTasks.filter(t => t.user_id === this.context.userId && t.chat_id === this.context.chatId);
    const allowedRepos = process.env.ALLOWED_REPOS ? process.env.ALLOWED_REPOS.split(',').map(r => r.trim()) : [];
    const cookies = await this.context.db.getCookies();
    
    // Test cookies validity
    let cookiesValid = false;
    if (cookies && cookies.trim()) {
      try {
        // Create a fresh CursorApi instance with current cookies from DB
        const testCursorApi = new CursorApi({ cookies });
        await testCursorApi.getGitHubInstallations();
        cookiesValid = true;
        // Update the context with fresh instance if validation succeeds
        this.context.cursorApi = testCursorApi;
      } catch (error) {
        cookiesValid = false;
      }
    }

    const systemContext = `
SYSTEM STATUS:
- Cookies: ${cookies ? (cookiesValid ? '✅ Valid' : '❌ Invalid/Expired') : '❌ Not set'}
- Allowed repositories: ${allowedRepos.length > 0 ? allowedRepos.join(', ') : 'None configured'}
- Active tasks for user: ${userTasks.length}

ACTIVE TASKS:
${userTasks.length > 0 ? userTasks.map(t => 
  `• ${t.composer_id.slice(0, 8)}... - ${t.repo_url} - ${t.status} - "${t.task_description}"`
).join('\n') : 'No active tasks'}
    `;

    const systemPrompt = generatePrompt(systemContext, this.tools);

 

    try {
      console.log(`Get user message: ${message}`);
      const result = await generateText({
        model: openrouter.chat(openrouterModel),
        system: systemPrompt,
        messages: conversationHistory,
        tools: this.tools,
        maxSteps: 20,
        onStepFinish: async (step) => {
          this.currentStepNumber++;
          
          // Save step data to database
          await this.saveStepData({
            stepType: step.stepType,
            text: step.text,
            toolCalls: step.toolCalls,
            toolResults: step.toolResults,
            finishReason: step.finishReason,
            usage: step.usage,
            timestamp: new Date().toISOString()
          });
        },
      });

      // Save all response messages to conversation history
      await this.saveConversationHistory(result.response.messages);

      // Check if any tool returned a button message
      for (const message of result.response.messages) {
        if (message.role === 'tool' && message.content) {
          const toolResults = Array.isArray(message.content) ? message.content : [message.content];
          for (const toolResult of toolResults) {
            if (toolResult.type === 'tool-result' && toolResult.result) {
              try {
                const parsed = typeof toolResult.result === 'string' ? 
                  JSON.parse(toolResult.result) : toolResult.result;
                
                if (parsed && typeof parsed === 'object' && parsed.type === 'button_message') {
                  return {
                    type: 'button_message',
                    text: parsed.text,
                    buttons: parsed.buttons
                  };
                }
              } catch (error) {
                // Ignore JSON parsing errors and continue
                continue;
              }
            }
          }
        }
      }

      return result.text;
    } catch (error) {
      console.error('Error processing message v2:', error);
      return `Error processing message v2: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

export default Agent; 