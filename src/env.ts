import { Bot } from "grammy";
import { Database } from "./database";
import CursorOfficialApi from "./cursor-official-api";

export const bot = new Bot(process.env.BOT_TOKEN || '');
export const db = new Database();
const apiKey = process.env.CURSOR_API_KEY || '';
if (!apiKey) {
  throw new Error('No CURSOR_API_KEY configured for monitoring');
}
export const cursorApi = new CursorOfficialApi({ apiKey });