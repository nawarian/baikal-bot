# Baikal Home Assistant

Baikal is a home assistant bot that lives inside a Telegram group.

## Architecture
- Node.js process using Telegraf for Telegram Bot API, pi.dev SDK for AI agent
- Single persistent AgentSession for the bot's lifetime
- Custom tools auto-discovered from `tools/` directory
- Skills auto-discovered from `skills/` directory
- DeepSeek (OpenAI-compatible) as LLM provider

## Key Files
- `src/index.ts` - Entry point
- `src/bot.ts` - Telegram bot setup (Telegraf)
- `src/engine.ts` - Baikal engine: session lifecycle, message log
- `src/deepseek-provider.ts` - DeepSeek provider extension
- `src/config.ts` - Configuration constants
- `src/loader.ts` - Tool & skill discovery
- `tools/` - Custom tools directory
- `skills/` - Skill markdown files
