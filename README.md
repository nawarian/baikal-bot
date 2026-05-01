Baikal Home Assistant
---

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

Baikal is a home assistant capable of managing schedule,
meal plans and events. It materializes itself as a
Telegram bot with agentic capabilities.

## Usage

### Prerequisites

- A [Telegram bot token](https://t.me/botfather)
- A [DeepSeek API key](https://platform.deepseek.com/api_keys)

### Development (local)

```bash
# Clone and install
git clone git@github.com:nawarian/baikal-bot.git
cd baikal-bot
npm install

# Configure environment
cp .env.example .env
# Edit .env with your TELEGRAM_BOT_TOKEN and DEEPSEEK_API_KEY

# Run in development mode (with hot-reload via tsx)
npm run dev
```

### Production (Docker Compose)

Build and run the bot in a container with shared volumes for tools, skills, memory, and data:

```bash
# 1. Create a .env file (or export the variables)
cp .env.example .env
# Edit .env with your tokens

# 2. Build and start
#    The first build will take a minute; subsequent runs are instant.
docker compose up --build -d

# 3. Follow logs
docker compose logs -f

# 4. Stop
docker compose down
```

The bot runs as a **non-root user** (UID 1001) inside the container. The following directories are shared between your host and the container in real time:

| Host path        | Container path  | Purpose                                |
|------------------|-----------------|----------------------------------------|
| `./tools/`       | `/app/tools`    | Custom tools (hot-reload via `/reload`) |
| `./skills/`      | `/app/skills`   | Skill markdown files (hot-reload)       |
| `./memory/`      | `/app/memory`   | Long-term memory persisted to disk      |
| `./data/`        | `/app/data`     | User-generated files (.xlsx, etc.)      |

> **Tip**: Add or edit `.ts` files in `tools/` or `.md` files in `skills/` on your host, then run `/reload` in Telegram to pick up changes without restarting the container.

### Telegram commands

| Command                 | Who can use     | Description                                         |
|-------------------------|----------------|-----------------------------------------------------|
| `/start`, `/help`       | Everyone       | Show help message with available commands           |
| `/new`                  | Everyone       | Reset bot's conversation context (keeps message log) |
| `/model [name]`         | Authorized only | Show or switch AI model (`deepseek-v4-flash` / `deepseek-v4-pro`) |
| `/reload`               | Everyone       | Hot-reload tools and skills from disk                |
| `@BaikalBot <message>`  | Everyone       | Tag the bot in any message to get a response         |

### Environment variables

| Variable             | Required | Description                             |
|----------------------|----------|-----------------------------------------|
| `TELEGRAM_BOT_TOKEN` | ✅       | Bot token from @BotFather               |
| `DEEPSEEK_API_KEY`   | ✅       | API key from DeepSeek platform          |
| `NODE_ENV`           | ❌       | Set to `production` (default) or `development` |

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

### Third-Party Components

- **`bin/officecli`** — A CLI tool for manipulating MS Office files (.xlsx, .docx, .pptx).
  Licensed under [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0).
  See [bin/officecli.LICENSE](bin/officecli.LICENSE) for the full text.

