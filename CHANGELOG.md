# Changelog

## [Unreleased]

Added voice message support with Google Gemini AI transcription and custom prompt configuration via `CUSTOM_PROMPT` environment variable. Refactored message processing logic and improved access control for better code maintainability.

**NEW**: Added image support for Cursor AI tasks:
- Send photos to bot and they'll be automatically included in tasks
- Images are cached for 3 minutes and attached to next task creation
- Multiple images support (media groups)
- Automatic image conversion to Cursor-compatible format
- File-based image cache stored alongside database (respects DB_PATH location)
- Updated Cursor API to support image attachments in conversation history 