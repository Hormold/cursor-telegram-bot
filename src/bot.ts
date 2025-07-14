import 'dotenv/config';
import { Bot } from 'grammy';
import { Database } from './database';
import CursorApi from './cursor-api';
import Agent from './agent';
import { BackgroundComposerStatus } from './types/cursor-api';

const bot = new Bot(process.env.BOT_TOKEN || '');
const db = new Database();

// Initialize first cookies if not set
async function initializeCookies() {
  const cookies = await db.getCookies();
  if (!cookies) {
    console.log('No cookies found in database. Bot will request them from users.');
  } else {
    console.log('Cookies found in database');
    
    // Check authentication status
    try {
      const cursorApi = new CursorApi({ cookies });
      const userInfo = await cursorApi.getUserInfo();
      console.log('✅ Authentication successful!');
      console.log(`User: ${userInfo.name} (${userInfo.email})`);
    } catch (error) {
      console.log('❌ Authentication failed:', error instanceof Error ? error.message : 'Unknown error');
      console.log('Cookies may be expired or invalid');
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
  const cookies = await db.getCookies();
  if (!cookies) {
    console.log('No cookies available for monitoring');
    return;
  }

  const cursorApi = new CursorApi({ cookies });
  const tasks = await db.getActiveTasks();

  for (const task of tasks) {
    try {
      const composer = await cursorApi.findComposerById(task.composer_id);
      if (!composer) continue;

      const oldStatus = task.status;
      const newStatus = composer.status;

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
        if (newStatus === BackgroundComposerStatus.FINISHED) {
          
          
          await bot.api.sendMessage(
            task.chat_id,
            `✅ *Task completed!*\n\n*${task.task_description}*\n\nRepo: ${task.repo_url}\nComposer: \`${task.composer_id}\``,
            { 
              parse_mode: 'Markdown',
              reply_markup: keyboard
            }
          );
        } else if (newStatus === BackgroundComposerStatus.ERROR) {
          await bot.api.sendMessage(
            task.chat_id,
            `❌ *Task failed!*\n\n*${task.task_description}*\n\nRepo: ${task.repo_url}\nComposer: \`${task.composer_id}\``,
            { 
              parse_mode: 'Markdown',
              reply_markup: keyboard
            }
          );
        } else if (newStatus === BackgroundComposerStatus.EXPIRED) {
           await bot.api.sendMessage(
             task.chat_id,
             `⏱️ *Task expired!*\n\n*${task.task_description}*\n\nRepo: ${task.repo_url}\nComposer: \`${task.composer_id}\``,
             { 
               parse_mode: 'Markdown',
               reply_markup: keyboard
             }
           );
         } else if (newStatus === BackgroundComposerStatus.RUNNING) {
           await bot.api.sendMessage(
             task.chat_id,
             `🔄 *Task is now running*\n\n*${task.task_description}*\n\nRepo: ${task.repo_url}\nComposer: \`${task.composer_id}\``,
             { 
               parse_mode: 'Markdown'
             }
           );
         } else {
          await bot.api.sendMessage(
            task.chat_id,
            `🔄 *Task status updated to ${newStatus}*\n\n*${task.task_description}*\n\nRepo: ${task.repo_url}\nComposer: \`${task.composer_id}\``,
            { 
              parse_mode: 'Markdown'
            }
          );
         }
      }
    } catch (error) {
      console.error(`Error monitoring task ${task.id}:`, error);
    }
  }
}

// Start task monitoring
setInterval(monitorTasks, 60000); // Check every minute

// Bot handlers
bot.use(async (ctx, next) => {
  if (!ctx.from || !ctx.chat) return;

  // Middleware to check if user is allowed
  if (!isUserAllowed(ctx.from.id)) {
    await ctx.reply('❌ You don\'t have access to this bot. Contact the administrator.');
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
  if (!isUserAllowed(ctx.from!.id)) {
    await ctx.reply('❌ You don\'t have access to this bot. Contact the administrator.');
    return;
  }

  await ctx.reply(`🤖 *Cursor AI Task Bot*

I can help you manage Cursor AI background composers:

• Start AI coding tasks in allowed repositories
• Monitor task status and get notifications
• Manage Cursor API cookies
• Stop running tasks

Just send me a message describing what you want to do!

*Commands:*
/tasks - Show active tasks
/cookies - Manage API cookies
/help - Show this help

Let's start! 🚀`, { parse_mode: 'Markdown' });
});

bot.command('tasks', async (ctx) => {

  const tasks = await db.getActiveTasks();
  const userTasks = tasks.filter(t => t.user_id === ctx.from!.id && t.chat_id === ctx.chat!.id);

  if (userTasks.length === 0) {
    await ctx.reply('No active tasks found.');
    return;
  }

  const taskList = userTasks.map(t => 
    `• *${t.task_description}*\n  Status: \`${t.status}\`\n  Repo: ${t.repo_url}\n  ID: \`${t.composer_id}\``
  ).join('\n\n');

  await ctx.reply(`*Active Tasks:*\n\n${taskList}`, { parse_mode: 'Markdown' });
});

bot.command('cookies', async (ctx) => {
  const cookies = await db.getCookies();
  const status = cookies ? '✅ Set' : '❌ Not set';
  
  await ctx.reply(`*Cursor API Cookies Status:* ${status}\n\nTo set cookies:\n1. Go to https://cursor.com/agents\n2. Open Developer Tools (F12)\n3. Go to Network tab\n4. Copy the Cookie header from any request\n5. Send it to me as a message`, { parse_mode: 'Markdown' });
});

bot.command('clear', async (ctx) => {

  try {
    await db.clearHistory(ctx.from!.id, ctx.chat!.id);
    await ctx.reply('History cleared successfully');
  } catch (error) {
    console.error('Error clearing history:', error);
    await ctx.reply('Failed to clear history');
  }
});

bot.command('help', async (ctx) => {
  await ctx.reply(`🤖 *Cursor AI Task Bot Help*

*Available Commands:*
/start - Start the bot
/tasks - Show your active tasks
/cookies - Manage API cookies
/help - Show this help

*Usage Examples:*
• "Start a task to add README to my-repo"
• "Check status of task bc-123-456"
• "Stop task bc-123-456"
• "Show me available repositories"

*Cookie Management:*
Send me your Cursor cookies when requested. I'll validate them and let you know if they expire.

*Task Management:*
Repository access is configured via environment variables. Tasks are monitored automatically and you'll get notifications when they complete or fail.`, { parse_mode: 'Markdown' });
});

bot.on('message:text', async (ctx) => {

  const message = ctx.message.text;
  
  try {
    // Get or create Cursor API instance
    const cookies = await db.getCookies();
    const cursorApi = new CursorApi({ cookies: cookies || undefined });
    
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
        console.error('Error sending typing action:', error);
      }
    }, 6000);

    let response: string | { type: string; text: string; buttons: { text: string; url: string }[] };
    try {
      // Process message with agent
      response = await agent.processMessage(message);
    } finally {
      // Always clear the typing interval
      clearInterval(typingInterval);
    }
    
    // Save message and response
    await db.saveMessage({
      user_id: ctx.from!.id,
      chat_id: ctx.chat!.id,
      text: message,
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
      
      await ctx.reply(response.text, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else {
      // Send regular response
      await ctx.reply(response as string, { parse_mode: 'Markdown' });
    }
    
  } catch (error) {
    console.error('Error processing message v2:', error);
    await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start bot
async function startBot() {
  await initializeCookies();
  await bot.start();
}

startBot().catch(console.error);
