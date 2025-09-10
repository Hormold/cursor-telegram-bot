# Cursor AI Telegram Bot

A powerful Telegram bot for managing Cursor Background Agents with intelligent task management and real-time monitoring.

## ✨ Features

- **AI Task Management**: Start, monitor, follow up, and manage Cursor AI tasks
- **Secure Authentication**: Official API via `CURSOR_API_KEY` (no cookies)
- **Real-time Monitoring**: Automatic task progress tracking and notifications
- **Interactive Interface**: Telegram buttons for external links and actions
- **Security**: Repository and user access control via environment variables
- **User-friendly**: Simple commands with rich status information
- **Voice Messages**: AI-powered voice message transcription using Gemini
- **Image Support**: Send photos to include in Cursor AI tasks (cached for 3 minutes)
- **Customizable**: Custom prompts and instructions via environment variables

### Quick Setup:

1. **Create Telegram Bot**: Message [@BotFather](https://t.me/BotFather) → `/newbot`
2. **Get your User ID**: Message [@userinfobot](https://t.me/userinfobot) 
3. **Deploy**: Click Railway button, add your `BOT_TOKEN`, `OPENROUTER_API_KEY`, and `CURSOR_API_KEY`
4. **Volume**: Railway will auto-create volume for `/app/data` (SQLite database storage)
5. Done — no cookies required

## 🛠️ Local Development

### 1. Installation

```bash
git clone https://github.com/hormold/cursor-telegram-bot
cd cursor-telegram-bot
pnpm install  # Installs all dependencies including sharp for image processing
```

### 2. Configuration

Create `.env` file:

```env
# Required
BOT_TOKEN=your_telegram_bot_token_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
CURSOR_API_KEY=your_cursor_api_key_here

# Optional: OpenRouter model (default: openai/gpt-4.1)
OPENROUTER_MODEL=openai/gpt-4.1

# Optional: Repository access control
ALLOWED_REPOS=https://github.com/user/repo1,https://github.com/user/repo2

# Optional: User access control (get your ID from @userinfobot)
ALLOWED_USERS=123456,789012

# Optional: Google Gemini API key for voice message transcription
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here

# Optional: Custom prompt for additional instructions
CUSTOM_PROMPT="Focus on repos with skipcalls prefix if user asks to add something"
```

### 3. Run the Bot

```bash
pnpm run build
pnpm start
```

## 🎮 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and setup guide |
| `/tasks` | View your active tasks |
| `/help` | Show available commands |
| 🎤 **Voice Messages** | Send voice messages for AI transcription and processing |

## 🔧 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Telegram bot token from @BotFather |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for AI functionality |
| `OPENROUTER_MODEL` | No | OpenRouter model (default: 'openai/gpt-4.1') |
| `CURSOR_API_KEY` | Yes | API key for official Cursor Background Agents API |
| `CURSOR_REPOS_TTL_MS` | No | In-memory cache TTL for `/v0/repositories` (default: 60000) |
| `CURSOR_MODELS_TTL_MS` | No | In-memory cache TTL for `/v0/models` (default: 7200000, i.e. 2 hours) |
| `ALLOWED_REPOS` | No | Comma-separated list of allowed repository URLs |
| `ALLOWED_USERS` | No | Comma-separated list of allowed Telegram user IDs |
| `DB_PATH` | No | Database file path (defaults to 'bot.db', Railway: '/app/data/bot.db') |
| `GOOGLE_GENERATIVE_AI_API_KEY` | No | Google Gemini API key for voice message transcription and image processing |
| `CUSTOM_PROMPT` | No | Custom instructions to add to the bot's system prompt |

## 🛡️ Security

- **No Secrets Exposure**: The bot never exposes API keys or secrets
- **Repository/User Control**: Optional repository and user access control via environment variables
- **Operation Tracking**: All actions are logged for audit purposes

## 📖 Usage Examples

### Starting a Task

```
User: Add authentication to my React app
Bot: ✅ Task started successfully!
     🔗 [Open in Cursor] (button)
```

### Voice Message Support

```
User: [voice message] "Start a new task to add dark mode to my app"
Bot: 🎤 Transcribing voice message...
     ✅ Task started successfully!
     🔗 [Open in Cursor] (button)
```

### Image Support

```
User: [sends photo of UI mockup]
Bot: 📸 Photo received and saved to cache (1 image total). I'll include it when you create a task.

User: Create a React component based on this design
Bot: ✅ Task started successfully! (1 image attached)
     🔗 [Open in Cursor] (button)
```

### Checking Task Status

```
User: /tasks
Bot: 📊 Active Tasks (2):
     
     🔄 Task: "Add authentication system"
     📍 Repository: user/react-app
     ⏱️ Status: RUNNING
     🔗 [Open in Cursor] (button)
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Telegram Bot  │───▶│   AI Agent      │───▶│   Cursor API    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │    Database     │
                       └─────────────────┘
```

## 🔄 Task Lifecycle

1. **Start**: Create background agent task in repository
2. **Monitor**: Real-time status tracking and updates
3. **Notify**: Automatic notifications on completion/failure
4. **Manage**: Stop or cancel running tasks as needed

## 🧪 Development

### Build

```bash
pnpm run build
```

### Watch Mode

```bash
pnpm run dev
```

### Database Schema

The bot uses SQLite with the following main tables:
- `users` - User management
- `chats` - Chat configuration
- `tasks` - Task tracking and status
- `messages` - Conversation history
- `config` - Bot configuration

## 📝 API Integration

The bot integrates with:
- **Cursor API**: For Background Agents management (official API)
- **OpenRouter API**: For AI-powered interactions
- **Telegram Bot API**: For messaging and user interface

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)

## �📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Cursor AI](https://cursor.com) for the amazing AI coding assistant
- [Grammy](https://grammy.dev) for the Telegram bot framework
- [OpenRouter](https://openrouter.ai) for AI API access
- [Railway](https://railway.app) for seamless deployment

---

**Ready to supercharge your Cursor AI workflow with intelligent automation!** 🚀 
