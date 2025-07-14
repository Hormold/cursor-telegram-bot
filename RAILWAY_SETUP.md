# Railway Configuration

## ✅ Настройка завершена

### Файлы конфигурации:
- `railway.json` - минимальная конфигурация с volume для SQLite
- `.env.example` - переменные окружения с новой `OPENROUTER_MODEL`
- `README.md` - кнопка Railway deploy + инструкция

### Изменения в коде:
- `src/agent.ts` - кастомная модель OpenRouter через `OPENROUTER_MODEL`
- `src/database.ts` - поддержка volume через `DB_PATH`

### Переменные окружения:
- `BOT_TOKEN` - токен Telegram бота
- `OPENROUTER_API_KEY` - ключ OpenRouter API
- `OPENROUTER_MODEL` - модель (по умолчанию: openai/gpt-4.1)
- `ALLOWED_USERS` - список разрешенных пользователей
- `DB_PATH` - путь к базе данных (/app/data/bot.db)

### Railway Volume:
- Путь: `/app/data`
- Для: SQLite база данных
- Автоматическое создание через `railway.json`

### Готово к деплою! 🚀