import { logger } from './logger';
import 'dotenv/config';
import { Bot, Context } from 'grammy';
import { Database } from './database';
import CursorOfficialApi from './cursor-official-api';
import Agent from './agent';
import { transcribeAudio, convertTelegramImageToCursorFormat } from './utils';
import { saveImagesToCache, getImagesFromCache } from './image-cache';

const bot = new Bot(process.env.BOT_TOKEN || '');
const db = new Database();
const apiKey = process.env.CURSOR_API_KEY || '';
if (!apiKey) {
  throw new Error('No CURSOR_API_KEY configured for monitoring');
}
const cursorApi = new CursorOfficialApi({ apiKey });
// Official API uses CURSOR_API_KEY; no cookie initialization required

// Safe message sending with retry and fallback
async function safeSendMessage(
  chatId: number, 
  text: string, 
  options: any = {},
  maxRetries: number = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await bot.api.sendMessage(chatId, text, options);
      return; // Success
    } catch (error: any) {
      logger.error(`Attempt ${attempt}/${maxRetries} failed:`, error);
      
      // If it's a parsing error, try fallback formats
      if (error.description?.includes("can't parse entities")) {
        // First try HTML if we were using Markdown
        if (options.parse_mode === 'Markdown') {
          logger.info('Markdown parsing failed, trying HTML...');
          try {
            const htmlOptions = { ...options, parse_mode: 'HTML' };
            // Convert basic Markdown to HTML
            const htmlText = text
              .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
              .replace(/\*(.*?)\*/g, '<i>$1</i>')
              .replace(/`(.*?)`/g, '<code>$1</code>');
            await bot.api.sendMessage(chatId, htmlText, htmlOptions);
            return; // Success with HTML
          } catch (htmlError) {
            logger.error('HTML also failed:', htmlError);
          }
        }
        
        // Finally try plain text
        logger.info('Trying plain text...');
        try {
          const plainOptions = { ...options };
          delete plainOptions.parse_mode;
          await bot.api.sendMessage(chatId, text, plainOptions);
          return; // Success with plain text
        } catch (plainError) {
          logger.error('Plain text also failed:', plainError);
        }
      }
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Safe context reply with retry and fallback
async function safeReply(
  ctx: Context,
  text: string,
  options: any = {},
  maxRetries: number = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await ctx.reply(text, options);
      return; // Success
    } catch (error: any) {
      logger.error(`Reply attempt ${attempt}/${maxRetries} failed:`, error);
      
      // If it's a parsing error, try fallback formats
      if (error.description?.includes("can't parse entities")) {
        // First try HTML if we were using Markdown
        if (options.parse_mode === 'Markdown') {
          logger.info('Markdown parsing failed, trying HTML reply...');
          try {
            const htmlOptions = { ...options, parse_mode: 'HTML' };
            // Convert basic Markdown to HTML
            const htmlText = text
              .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
              .replace(/\*(.*?)\*/g, '<i>$1</i>')
              .replace(/`(.*?)`/g, '<code>$1</code>');
            await ctx.reply(htmlText, htmlOptions);
            return; // Success with HTML
          } catch (htmlError) {
            logger.error('HTML reply also failed:', htmlError);
          }
        }
        
        // Finally try plain text
        logger.info('Trying plain text reply...');
        try {
          const plainOptions = { ...options };
          delete plainOptions.parse_mode;
          await ctx.reply(text, plainOptions);
          return; // Success with plain text
        } catch (plainError) {
          logger.error('Plain text reply also failed:', plainError);
        }
      }
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Access control via ENV
function isUserAllowed(userId: number): boolean {
  const allowed = process.env.ALLOWED_USERS;
  if (!allowed) return true;
  return allowed.split(',').map(x => x.trim()).includes(userId.toString());
}

// Background task monitoring
async function monitorTasks() {
  const tasks = await db.getActiveTasks();

  for (const task of tasks) {
    try {
      const agent = await cursorApi.getAgent(task.composer_id);
      const oldStatus = task.status;
      const newStatus = agent.status;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: '🔍 Check Task Details',
              url: `https://cursor.com/agents?selectedBcId=${task.composer_id}`
            },
            {
              text: '📁 Open Repository',
              url: task.repo_url
            }
          ]
        ]
      };

      if (oldStatus !== newStatus) {
        await db.updateTask(task.id, newStatus);
        
        // Notify user if task completed or failed
        if (newStatus === 'FINISHED') {
          
          
          await safeSendMessage(
            task.chat_id,
            `✅ *Task completed!*\n\n*${task.task_description}*\n\nRepo: ${task.repo_url}\nComposer: \`${task.composer_id}\``,
            { 
              parse_mode: 'Markdown',
              reply_markup: keyboard
            }
          );
        } else if (newStatus === 'ERROR') {
          await safeSendMessage(
            task.chat_id,
            `❌ *Task failed!*\n\n*${task.task_description}*\n\nRepo: ${task.repo_url}\nComposer: \`${task.composer_id}\``,
            { 
              parse_mode: 'Markdown',
              reply_markup: keyboard
            }
          );
        } else if (newStatus === 'EXPIRED') {
           await safeSendMessage(
             task.chat_id,
             `⏱️ *Task expired!*\n\n*${task.task_description}*\n\nRepo: ${task.repo_url}\nComposer: \`${task.composer_id}\``,
             { 
               parse_mode: 'Markdown',
               reply_markup: keyboard
             }
           );
         } else if (newStatus === 'RUNNING') {
           await safeSendMessage(
             task.chat_id,
             `🔄 *Task is now running*\n\n*${task.task_description}*\n\nRepo: ${task.repo_url}\nComposer: \`${task.composer_id}\``,
             { 
               parse_mode: 'Markdown'
             }
           );
         } else {
          await safeSendMessage(
            task.chat_id,
            `🔄 *Task status updated to ${newStatus}*\n\n*${task.task_description}*\n\nRepo: ${task.repo_url}\nComposer: \`${task.composer_id}\``,
            { 
              parse_mode: 'Markdown'
            }
          );
         }
      }
    } catch (error) {
      logger.error(`Error monitoring task ${task.id}:`, error);
    }
  }
}

// Common message processing function
async function processUserMessage(
  ctx: Context,
  messageText: string,
  originalMessage: string = messageText
): Promise<void> {
  // Create agent
  const agent = new Agent({
    userId: ctx.from!.id,
    chatId: ctx.chat!.id,
    db,
    cursorApi
  });

  // Show typing indicator periodically
  await ctx.replyWithChatAction('typing');
  const typingInterval = setInterval(async () => {
    try {
      await ctx.replyWithChatAction('typing');
    } catch (error) {
      logger.error('Error sending typing action:', error);
    }
  }, 6000);

  let response: string | { type: string; text: string; buttons: { text: string; url: string }[] };
  try {
    // Process message with agent
    response = await agent.processMessage(messageText);
  } finally {
    // Always clear the typing interval
    clearInterval(typingInterval);
  }
  
  // Save message and response
  await db.saveMessage({
    user_id: ctx.from!.id,
    chat_id: ctx.chat!.id,
    text: originalMessage,
    response: typeof response === 'string' ? response : JSON.stringify(response)
  });

  // Handle button messages
  if (typeof response === 'object' && response.type === 'button_message') {
    const keyboard = {
      inline_keyboard: [
        response.buttons.map((button: any) => ({
          text: button.text,
          url: button.url
        }))
      ]
    };
    
    await safeReply(ctx, response.text, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } else {
    // Send regular response
    await safeReply(ctx, response as string, { parse_mode: 'Markdown' });
  }
}

let monitorInterval: NodeJS.Timeout | null = null;

// Bot handlers
bot.use(async (ctx, next) => {
  logger.info('ctx.from', ctx.from);
  logger.info('ctx.chat', ctx.chat);
  if (!ctx.from || !ctx.chat) return;

  // Middleware to check if user is allowed
  // If chat is allowed, we don't need to check user permissions
  if (!isUserAllowed(ctx.chat.id) && !isUserAllowed(ctx.from.id)) {
    await safeReply(ctx, '❌ You don\'t have access to this bot. Contact the administrator.');
    return;
  }

  // Save user and chat info (no allowed field)
  await db.createUser({
    id: ctx.from.id,
    username: ctx.from.username,
    first_name: ctx.from.first_name
  });

  await db.createChat({
    id: ctx.chat.id,
    title: ctx.chat.title || ctx.chat.first_name,
    type: ctx.chat.type
  });

  await next();
});

bot.command('start', async (ctx) => {
  await safeReply(ctx, `🤖 *Cursor AI Task Bot*

I can help you manage Cursor Background Agents:

• Start AI coding tasks in allowed repositories
• Monitor task status and get notifications
• Stop running tasks
• Process voice messages (if Gemini API is configured)

Just send me a message or voice note describing what you want to do!

*Commands:*
/tasks - Show active tasks
/help - Show this help

Let's start! 🚀`, { parse_mode: 'Markdown' });
});

bot.command('tasks', async (ctx) => {

  const tasks = await db.getActiveTasks();
  const userTasks = tasks.filter(t => t.user_id === ctx.from!.id && t.chat_id === ctx.chat!.id);

  if (userTasks.length === 0) {
    await safeReply(ctx, 'No active tasks found.');
    return;
  }

  const taskList = userTasks.map(t => 
    `• *${t.task_description}*\n  Status: \`${t.status}\`\n  Repo: ${t.repo_url}\n  ID: \`${t.composer_id}\``
  ).join('\n\n');

  await safeReply(ctx, `*Active Tasks:*\n\n${taskList}`, { parse_mode: 'Markdown' });
});

bot.command('clear', async (ctx) => {

  try {
    await db.clearHistory(ctx.from!.id, ctx.chat!.id);
    await safeReply(ctx, 'History cleared successfully');
  } catch (error) {
    logger.error('Error clearing history:', error);
    await safeReply(ctx, 'Failed to clear history');
  }
});

bot.command('help', async (ctx) => {
  await safeReply(ctx, `🤖 *Cursor AI Task Bot Help*

*Available Commands:*
/start - Start the bot
/tasks - Show your active tasks
/help - Show this help

*Usage Examples:*
• "Start a task to add README to my-repo"
• "Check status of task bc-123-456"
• "Stop task bc-123-456"
• "Show me available repositories"

*Voice Messages:*
🎤 Send voice messages - I'll transcribe them using Gemini AI and process as text commands

*Task Management:*
Repository access is configured via environment variables. Tasks are monitored automatically and you'll get notifications when they complete or fail.`, { parse_mode: 'Markdown' });
});

bot.on('message:text', async (ctx) => {
  logger.info('message:text', ctx);

  const message = ctx.message.text;
  
  // Check if mention-only mode is enabled
  const mentionOnlyMode = process.env.MENTION_ONLY_MODE === 'true';
  if (mentionOnlyMode) {
    const botInfo = await ctx.api.getMe();
    const botMention = `@${botInfo.username}`;
    const isDirectMessage = ctx.chat?.type === 'private';
    const isMentioned = message.includes(botMention);
    
    // Only respond if it's a direct message or bot is mentioned
    if (!isDirectMessage && !isMentioned) {
      logger.info('Skipping message - mention-only mode enabled and bot not mentioned');
      return;
    }
  }
  
  try {
    await processUserMessage(ctx, message);
  } catch (error) {
    logger.error('Error processing message v2:', error);
    await safeReply(ctx, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// Handle single photo and media group
bot.on('message:photo', async (ctx) => {
  logger.info('message:photo', ctx);
  try {
    await ctx.replyWithChatAction('typing');
    
    // Get the largest photo (highest resolution)
    const photo = ctx.message.photo.sort((a, b) => (b.file_size || 0) - (a.file_size || 0))[0];
    
    // Get file info
    const file = await ctx.api.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    
    // Download photo
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download photo: ${response.statusText}`);
    }
    
    const photoBuffer = Buffer.from(await response.arrayBuffer());
    
    // Convert to Cursor format
    logger.info(`📸 Converting Telegram photo ${photo.file_id} to Cursor format`);
    const cursorImage = await convertTelegramImageToCursorFormat(photoBuffer, photo.file_id);
    logger.info(`📸 Converted image: ${cursorImage.dimension.width}x${cursorImage.dimension.height}, ${Math.round(cursorImage.data.length / 1024)}KB`);
    
    // Get existing images from cache and add new one
    const existingImages = getImagesFromCache(ctx.from!.id, ctx.chat!.id);
    const allImages = [...existingImages, cursorImage];
    logger.info(`📸 Total images in cache: ${allImages.length} (${existingImages.length} existing + 1 new)`);
    
    // Save to cache
    saveImagesToCache(ctx.from!.id, ctx.chat!.id, allImages);
    
    // Process caption if exists
    const caption = ctx.message.caption || '';
    if (caption) {
      await processUserMessage(ctx, caption, `[PHOTO] ${caption}`);
    } else {
      await safeReply(ctx, `📸 Photo received and saved to cache (${allImages.length} image${allImages.length > 1 ? 's' : ''} total). I'll include ${allImages.length > 1 ? 'them' : 'it'} when you create a task.`);
    }
    
  } catch (error) {
    logger.error('Error processing photo:', error);
    await safeReply(ctx, `❌ Error processing photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

bot.on('message:voice', async (ctx) => {
  // Check if Gemini API key is available
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    await safeReply(ctx, '🔇 Voice message transcription is not available. Contact admin to enable this feature.');
    return;
  }

  try {
    await ctx.replyWithChatAction('typing');
    
    // Check file size (Telegram voice messages are usually small, but let's be safe)
    const voice = ctx.message.voice;
    if (voice.file_size && voice.file_size > 20 * 1024 * 1024) { // 20MB limit
      await safeReply(ctx, '❌ Voice message is too large (max 20MB)');
      return;
    }
    
    // Get voice file info
    const file = await ctx.api.getFile(voice.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    
    // Download voice file
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download voice file: ${response.statusText}`);
    }
    
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    
    // Transcribe audio
    await ctx.replyWithChatAction('typing');
    const { transcribedText, tldr } = await transcribeAudio(audioBuffer, 'audio/ogg');
    
    if (!transcribedText || transcribedText.trim() === '') {
      await safeReply(ctx, '❌ Could not transcribe voice message. Please try again or send text.');
      return;
    }
    
    // Process transcribed text through agent
    await processUserMessage(ctx, transcribedText, `[VOICE] ${transcribedText}${tldr ? ` (TL;DR: ${tldr})` : ''}`);
    
  } catch (error) {
    logger.error('Error processing voice message:', error);
    
    // More specific error messages
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        await safeReply(ctx, '❌ Voice transcription timed out. Please try a shorter message.');
      } else if (error.message.includes('quota') || error.message.includes('limit')) {
        await safeReply(ctx, '❌ API quota exceeded. Please try again later.');
      } else {
        await safeReply(ctx, `❌ Error processing voice message: ${error.message}`);
      }
    } else {
      await safeReply(ctx, '❌ Unknown error occurred while processing voice message.');
    }
  }
});

// Error handler
bot.catch((err) => {
  logger.error('Bot error:', err);
});

// Start/Stop bot
export async function startBot() {
  if (!monitorInterval) {
    monitorInterval = setInterval(monitorTasks, 60000); // Check every minute
  }
  logger.info('Starting bot');
  await bot.start({
    onStart: () => {
      logger.info('Bot started');
    },
  });
}

export async function stopBot() {
  try {
    if (monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = null;
    }
    logger.info('Stopping bot');
    await bot.stop();
  } catch (e) {
    logger.error('Error stopping bot:', e);
  }
}

if (process.env.BOT_AUTOSTART !== '0') {
  startBot().catch(logger.error);
}
