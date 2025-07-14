# 🚀 Quick Setup Guide

## 1. Create Telegram Bot
1. Message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Follow instructions to create bot
4. Save the bot token

## 2. Get OpenRouter API Key
1. Go to [OpenRouter](https://openrouter.ai)
2. Sign up/Login
3. Go to [API Keys](https://openrouter.ai/keys)
4. Create new key
5. Copy the key (starts with `sk-or-v1-...`)

## 3. Get Your Telegram User ID
1. Message [@userinfobot](https://t.me/userinfobot)
2. It will show your User ID (numbers like `123456789`)
3. Use this for `ALLOWED_USERS` to restrict access

## 4. Deploy on Railway
1. Click the Railway deploy button in README
2. Enter your tokens in the Variables section
3. Create volume with mount path `/app/data`
4. Deploy!

## 5. Setup Cursor Cookies
1. Go to [cursor.com/agents](https://cursor.com/agents)
2. Open DevTools (F12) → Network tab
3. Refresh page
4. Find any request to cursor.com
5. Copy `WorkosCursorSessionToken` value from Cookie header
6. Send to your bot as: `WorkosCursorSessionToken=your_token_here`

That's it! Your bot is ready to manage Cursor AI tasks! 🎉