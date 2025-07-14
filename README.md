# Cursor AI Telegram Bot

A powerful Telegram bot for managing Cursor AI Background Composers with intelligent task management and real-time monitoring.

## ✨ Features

- 🤖 **AI Task Management**: Start, monitor, and manage Cursor AI coding tasks
- 🔐 **Secure Authentication**: Cookie-based authentication with validation
- 📊 **Real-time Monitoring**: Automatic task progress tracking and notifications
- 💬 **Interactive Interface**: Telegram buttons for external links and actions
- 🛡️ **Security**: Repository and user access control via environment variables
- 📱 **User-friendly**: Simple commands with rich status information

## 🚀 Quick Start

### 1. Installation

```bash
git clone https://github.com/hormold/cursor-telegram-bot
cd cursor-telegram-bot
pnpm install
```

### 2. Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Required
BOT_TOKEN=your_telegram_bot_token_here
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Optional: Repository access control
ALLOWED_REPOS=https://github.com/user/repo1,https://github.com/user/repo2

# Optional: User access control
ALLOWED_USERS=123456,789012
```

### 3. Setup Cursor API Cookies

1. Go to [https://cursor.com/agents](https://cursor.com/agents)
2. Open Developer Tools (F12)
3. Go to Network tab
4. Refresh the page
5. Find any request to cursor.com
6. Copy the entire Cookie header value
7. Send it to the bot. YOU NEED ONLY WorkosCursorSessionToken cookie value. Send it in format WorkosCursorSessionToken=...

### 4. Run the Bot

```bash
pnpm run build
pnpm start
```

## 🎮 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and setup guide |
| `/tasks` | View your active tasks |
| `/cookies` | Get cookie setup instructions |
| `/help` | Show available commands |

## 🔧 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Telegram bot token from @BotFather |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for AI functionality |
| `ALLOWED_REPOS` | No | Comma-separated list of allowed repository URLs |
| `ALLOWED_USERS` | No | Comma-separated list of allowed Telegram user IDs |
| `DATABASE_PATH` | No | Database file path (defaults to 'bot.db') |

## 🛡️ Security

- **No Cookie Exposure**: The bot never exposes actual cookie values
- **Repository/User Control**: Optional repository and user access control via environment variables
- **Authentication Validation**: Cookies are validated before every operation
- **Operation Tracking**: All actions are logged for audit purposes

## 📖 Usage Examples

### Starting a Task

```
User: Add authentication to my React app
Bot: ✅ Task started successfully!
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

1. **Start**: Create background composer task in repository
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
- **Cursor API**: For background composer management
- **OpenRouter API**: For AI-powered interactions
- **Telegram Bot API**: For messaging and user interface

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Cursor AI](https://cursor.com) for the amazing AI coding assistant
- [Grammy](https://grammy.dev) for the Telegram bot framework
- [OpenRouter](https://openrouter.ai) for AI API access

---

**Ready to supercharge your Cursor AI workflow with intelligent automation!** 🚀 