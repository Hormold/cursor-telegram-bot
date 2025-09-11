import { logger } from './logger';
import 'dotenv/config';

import { generateText, tool, ToolSet, CoreMessage } from 'ai';
import { z } from 'zod';
import CursorOfficialApi from './cursor-official-api';
import { ConversationStep, Database } from './database';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generatePrompt } from './prompt';
import { getImagesFromCache, clearImagesFromCache } from './image-cache';

const apiKey = process.env.OPENROUTER_API_KEY;
const openrouterModel = process.env.OPENROUTER_MODEL || 'openai/gpt-4.1';
const openrouter = createOpenRouter({ apiKey });

interface AgentContext {
  userId: number;
  chatId: number;
  db: Database;
  cursorApi: CursorOfficialApi;
}

// Factory function to create tools with context
function createToolsWithContext(context: AgentContext): ToolSet {
  return {
    getRepos: tool({
      description: 'Get available GitHub repositories (official API)',
      parameters: z.object({ dummy: z.string().describe('Dummy parameter') }),
      execute: async () => {
        try {
          const reposResp = await context.cursorApi.listRepositories();
          const repos = reposResp.repositories || [];
          return {
            repos: repos.map((r) => ({ name: r.name, owner: r.owner, url: r.repository })),
          };
        } catch (error) {
          return {
            error: `Failed to get repos: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),

    startTask: tool({
      description: 'Start a new Cursor Agent task in a repository. Models: Auto (default), claude-4-sonnet-thinking, o3',
      parameters: z.object({
        repoUrl: z.string().describe('Repository URL'),
        taskDescription: z.string().describe('Task description for AI'),
        branch: z.string().default('main').describe('Branch name (default: main)'),
        model: z.string().optional().describe('Optional model; omit for Auto'),
      }),
      execute: async ({ repoUrl, taskDescription, branch, model }: { repoUrl: string; taskDescription: string; branch?: string; model?: string }) => {
        try {
          // Check if repo is allowed
          const allowedRepos = process.env.ALLOWED_REPOS ? process.env.ALLOWED_REPOS.split(',').map((r) => r.trim()) : [];
          if (allowedRepos.length > 0 && !allowedRepos.includes(repoUrl)) {
            return {
              error: `Repository ${repoUrl} is not in allowed list. Allowed repos: ${allowedRepos.join(', ')}`,
            };
          }

          // Get images from cache
          const images = getImagesFromCache(context.userId, context.chatId);
          logger.info(`📸 Found ${images.length} images in cache for user ${context.userId} in chat ${context.chatId}`);

          if (images.length > 0) {
            logger.info(
              `📸 Images details:`,
              images.map((img) => ({ dimensions: `${img.dimension.width}x${img.dimension.height}`, dataSize: `${Math.round(img.data.length / 1024)}KB` }))
            );
          }

          // Start the agent via official API
          logger.info(`🚀 Starting Cursor Agent with ${images.length} images attached`);
          const result = await context.cursorApi.createAgent({
            text: taskDescription,
            images: images.length > 0 ? images : undefined,
            model: model || undefined, // omit for Auto
            repository: repoUrl,
            ref: branch,
          });
          logger.info(`✅ Cursor Agent started successfully: ${result.id}`);

          // Save task to database
          const taskId = await context.db.createTask({
            user_id: context.userId,
            chat_id: context.chatId,
            composer_id: result.id,
            repo_url: repoUrl,
            task_description: taskDescription,
            status: result.status,
          });

          // Clear images from cache after successful task creation
          logger.info(`🧹 Clearing ${images.length} images from cache after successful task creation`);
          clearImagesFromCache(context.userId, context.chatId);

          return {
            success: true,
            composerId: result.id,
            taskId,
            message: `Task started in ${repoUrl}${model ? ` with model ${model}` : ' with model Auto'}: ${taskDescription}${images.length > 0 ? ` (${images.length} image${images.length > 1 ? 's' : ''} attached)` : ''}`,
          };
        } catch (error) {
          return {
            error: `Failed to start task: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),

    getTaskStatus: tool({
      description: 'Get status of a specific task by agent ID',
      parameters: z.object({
        composerId: z.string().describe('Agent ID'),
      }),
      execute: async ({ composerId }: { composerId: string }) => {
        try {
          const agent = await context.cursorApi.getAgent(composerId);

          // Update task status in database
          const task = await context.db.getTaskByComposerId(composerId);
          if (task) {
            await context.db.updateTask(task.id, agent.status);
          }

          return {
            composerId,
            status: agent.status,
            name: agent.name,
            repoUrl: (agent.source && (agent.source.repository || agent.source.repoUrl)) || undefined,
            branchName: (agent.source && (agent.source.branch || agent.source.branchName)) || undefined,
            createdAt: agent.createdAt,
            updatedAt: agent.createdAt,
          };
        } catch (error) {
          return {
            error: `Failed to get task status: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),

    getActiveTasks: tool({
      description: 'Get all active tasks for current user',
      parameters: z.object({ dummy: z.string().describe('Dummy parameter') }),
      execute: async () => {
        const tasks = await context.db.getActiveTasks();
        const userTasks = tasks.filter((t) => t.user_id === context.userId && t.chat_id === context.chatId);

        return {
          tasks: userTasks.map((t) => ({
            id: t.id,
            composerId: t.composer_id,
            repoUrl: t.repo_url,
            description: t.task_description,
            status: t.status,
            createdAt: t.created_at,
          })),
        };
      },
    }),

    stopTask: tool({
      description: 'Stop/archive a running task',
      parameters: z.object({
        composerId: z.string().describe('Agent ID to stop'),
      }),
      execute: async ({ composerId }: { composerId: string }) => {
        try {
          await context.cursorApi.deleteAgent(composerId);

          // Update task status in database
          const task = await context.db.getTaskByComposerId(composerId);
          if (task) {
            await context.db.updateTask(task.id, 'CANCELLED');
          }

          return {
            success: true,
            message: `Task ${composerId} has been stopped`,
          };
        } catch (error) {
          return {
            error: `Failed to stop task: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),

    addFollowup: tool({
      description: 'Add follow-up instruction to a running task',
      parameters: z.object({
        composerId: z.string().describe('Agent ID'),
        text: z.string().describe('Follow-up text'),
      }),
      execute: async ({ composerId, text }: { composerId: string; text: string }) => {
        try {
          const updated = await context.cursorApi.addFollowup(composerId, text);
          return { success: true, composerId: updated.id };
        } catch (error) {
          return { error: `Failed to add follow-up: ${error instanceof Error ? error.message : 'Unknown error'}` };
        }
      },
    }),

    getAvailableModels: tool({
      description: 'Get available models for Cursor Agent',
      parameters: z.object({ dummy: z.string().describe('Dummy parameter') }),
      execute: async () => {
        return { models: await context.cursorApi.listModels() };
      },
    }),

    sendButtonMessage: tool({
      description: 'Send a message with Telegram inline buttons for external links',
      parameters: z.object({
        text: z.string().describe('Message text to send'),
        buttons: z
          .array(
            z.object({
              text: z.string().describe('Button text'),
              url: z.string().describe('Button URL'),
            })
          )
          .describe('Array of buttons with text and URL'),
      }),
      execute: async ({ text, buttons }: { text: string; buttons: Array<{ text: string; url: string }> }) => {
        return {
          type: 'button_message',
          text,
          buttons,
          message: 'Button message prepared for Telegram',
        };
      },
    }),
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

  private async saveConversationHistory(messages: CoreMessage[]): Promise<void> {
    try {
      for (const message of messages) {
        await this.context.db.saveConversationMessage({
          user_id: this.context.userId,
          chat_id: this.context.chatId,
          message_data: JSON.stringify(message),
          message_type: message.role as 'user' | 'assistant' | 'tool',
          step_number: this.currentStepNumber,
          is_final: true,
        });
      }
    } catch (error) {
      logger.error('Error saving conversation history:', error);
    }
  }

  private async saveStepData(stepData: ConversationStep): Promise<void> {
    try {
      await this.context.db.saveConversationStep({
        user_id: this.context.userId,
        chat_id: this.context.chatId,
        step_number: this.currentStepNumber,
        step_data: JSON.stringify(stepData),
      });
    } catch (error) {
      logger.error('Error saving step data:', error);
    }
  }

  async processMessage(
    message: string
  ): Promise<string | { type: 'button_message'; text: string; buttons: Array<{ text: string; url: string }> }> {
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
    const userTasks = activeTasks.filter((t) => t.user_id === this.context.userId && t.chat_id === this.context.chatId);
    const allowedRepos = process.env.ALLOWED_REPOS ? process.env.ALLOWED_REPOS.split(',').map((r) => r.trim()) : [];

    const systemContext = `
SYSTEM STATUS:
- Allowed repositories: ${allowedRepos.length > 0 ? allowedRepos.join(', ') : 'None configured'}
- Active tasks for user: ${userTasks.length}

ACTIVE TASKS:
${userTasks.length > 0 ? userTasks.map(t => 
  `• ${t.composer_id.slice(0, 8)}... - ${t.repo_url} - ${t.status} - "${t.task_description}"`
).join('\n') : 'No active tasks'}
    `;

    const systemPrompt = generatePrompt(systemContext, this.tools);

    try {
      logger.info(`Get user message: ${message}`);
      const result = await generateText({
        model: openrouter.chat(openrouterModel),
        system: systemPrompt,
        messages: conversationHistory,
        tools: this.tools,
        maxSteps: 20,
        onStepFinish: async (step) => {
          this.currentStepNumber++;

          const stepData: ConversationStep = {
            user_id: this.context.userId,
            chat_id: this.context.chatId,
            created_at: new Date().toISOString(),
            step_number: this.currentStepNumber,
            step_data: JSON.stringify(step),
          };

          // Save step data to database
          await this.saveStepData(stepData);
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
                const parsed = typeof toolResult.result === 'string' ? JSON.parse(toolResult.result) : toolResult.result;

                if (parsed && typeof parsed === 'object' && parsed.type === 'button_message') {
                  return {
                    type: 'button_message',
                    text: parsed.text,
                    buttons: parsed.buttons,
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
      logger.error('Error processing message v2:', error);
      return `Error processing message v2: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

export default Agent;
