import { db, cursorApi } from "./env";
import { safeSendMessage } from "./utils";
import { logger } from "./logger";

// Background task monitoring
export async function monitorTasks() {
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