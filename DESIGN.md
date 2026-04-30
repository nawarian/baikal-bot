# Baikal Home Assistant — Design Document

## Overview

Baikal is a home assistant bot that lives inside a **Telegram group**. It silently observes all messages but only **reacts when explicitly tagged** (e.g. `@BaikalBot what's on the agenda?`). Baikal uses pi.dev's SDK to create an agent session that reasons, makes decisions, and takes actions autonomously.

The bot itself has no hardcoded domain logic — its capabilities are driven entirely by the LLM's reasoning with access to custom tools. What those tools are is defined later; the focus for now is the agent's ability to engage with the group conversationally and decide what to do.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Node.js Process                         │
│                                                              │
│  ┌──────────────┐    ┌────────────────────────────────────┐ │
│  │  Telegram     │◄──►│         Baikal Engine              │ │
│  │  Bot (Telegraf) │    │                                    │ │
│  │              │    │  ┌──────────────────────────────┐   │ │
│  │  updates/    │    │  │  pi.dev Agent Session         │   │ │
│  │  messages    │    │  │  (single, persistent)         │   │ │
│  └──────────────┘    │  │                               │   │ │
│                      │  │  ┌──────────────────────────┐ │   │ │
│                      │  │  │  Tools + Skills            │ │   │ │
│                      │  │  │  (loaded from local dirs)  │ │   │ │
│                      │  │  └──────────────────────────┘ │   │ │
│                      │  └──────────────────────────────┘   │ │
│                      └────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────┐  ┌────────────────────────┐      │
│  │  .env file           │  │  tools/ + skills/       │      │
│  │  TELEGRAM_BOT_TOKEN  │  │  (auto-discovered)      │      │
│  │  DEEPSEEK_API_KEY    │  └────────────────────────┘      │
│  └──────────────────────┘                                    │
└──────────────────────────────────────────────────────────────┘
```

### Components

1. **Telegram Bot** — handles incoming messages via [Telegraf](https://telegraf.js.org/) (modern, well-maintained Telegram Bot API framework). Listens for commands and group messages. Filters messages by whether they tag the bot.

2. **Baikal Engine** — the core orchestrator. Creates a **single** pi.dev `AgentSession` (via `createAgentSession` from `@mariozechner/pi-coding-agent`). The agent session is the "brain" — it reasons about user requests, chooses which tools to call, and synthesizes responses.

3. **Tools & Skills** — loaded from local `tools/` and `skills/` directories, similar to pi's `~/.pi/agent/` discovery. Tools are registered with the agent session as custom tools. Skills are `AGENTS.md`-style instructions injected into the system prompt. Both are auto-discovered at startup.

4. **Configuration (.env)** — holds secrets:
   - `TELEGRAM_BOT_TOKEN` — Telegram bot token from BotFather
   - `DEEPSEEK_API_KEY` — DeepSeek API key (OpenAI-compatible endpoint)

---

## Data Flow

```
1. Any group member sends a message
        │
        ├── Message tags @BaikalBot? ──── No ──► silently store in message log
        │
        Yes
        │
        ▼
2. Telegraf receives update, calls Baikal Engine
        │
        ▼
3. Baikal Engine sends tagged message + recent message log to pi AgentSession
        │
        ▼
4. pi session reasons (LLM via DeepSeek) → decides response or tool calls
        │
        ▼
5. Agent responds or executes tools (to be defined later)
        │
        ▼
6. Baikal Engine sends response text back to Telegraf
        │
        ▼
7. Telegraf replies in-thread to the triggering message on Telegram
```

---

## Telegram Bot Design (Telegraf)

We use [Telegraf](https://telegraf.js.org/) because it has a clean middleware-based API, first-class TypeScript support, and is actively maintained.

### Context: Single Group Chat

Baikal joins one Telegram group. There is a **single pi `AgentSession`** for the entire bot's lifetime. No per-chat session tracking is needed.

### Message Handling

| Condition | Behavior |
|-----------|----------|
| Message tags the bot (e.g. `@BaikalBot ...`) | Forward to pi agent session for processing, then reply in-thread |
| Message does **not** tag the bot | Silently appended to the in-memory message log (for context) |
| `/new` command | Discards current pi session and creates a fresh one (wipe model context). All previously stored messages are kept. |
| `/model` command | Allowed users only. Changes the active model for the agent session (switches between `deepseek-v4-flash` and `deepseek-v4-pro`). |
| `/start` or `/help` | Show welcome message and available commands |

### Tag Detection

Telegram provides `message.entities` of type `mention` or `text_mention`. We check if any entity references the bot's username. The bot's username is read from Telegraf's `bot.botInfo` after startup.

### Context Window: Message Log

Baikal maintains an in-memory list of all messages sent in the group since the last `/new`. When a message tags the bot, the Baikal Engine injects the **recent message log** into the pi session's context alongside the tagged message. This lets the agent understand conversational context and references to earlier discussion.

The message log is trimmed to a reasonable size (e.g. last 100 messages) to stay within the model's context window.

### Reply Format

When responding, Baikal uses `reply_to_message_id` on the original tagged message so the group sees a threaded reply.

---

## Commands

### `/new` — Reset Agent Context

Available to **any group member**. Wipes the pi session's conversation history and starts fresh. The message log is preserved so the bot retains awareness of recent group discussion.

```
User: /new
Baikal: Context reset. I'm ready to start fresh.
```

### `/model` — Switch Active Model

Available to **allowed users only**. Switches the agent session's underlying DeepSeek model.

**Allowed users** are defined by their Telegram username. Initially, only `@nawarian` is authorized.

**Usage:**

```
User: /model
Baikal: Current model: deepseek-v4-flash
       Available: deepseek-v4-flash, deepseek-v4-pro
       To switch, use /model <name>

User: /model deepseek-v4-pro
Baikal: Model switched to deepseek-v4-pro.
```

If an unauthorized user tries `/model`, the bot replies:

```
Baikal: Sorry, only authorized users can change the model.
```

### `/start` and `/help`

Available to **any group member**. Shows a welcome message listing available commands and explaining how to interact with the bot (tag it with `@BaikalBot`).

---

## Session & Context Management

### Single Persistent Session

- One `AgentSession` for the entire bot, persisted to `session.jsonl`
- All interactions with the model happen within this session's conversation history
- The session's model context includes: system prompt + tool call history + the recent message log (injected as context)

### `/new` Command — Wipe Context

When a user sends `/new`:
1. Dispose the current `AgentSession`
2. Create a brand new `AgentSession` (fresh conversation with the model)
3. The in-memory message log is **preserved** (so the bot can still reference recent discussion)
4. Reply with a confirmation

### `/model` Command — Switch Model

When an authorized user sends `/model`:
1. If no argument: reply with current model and available options
2. If valid model name provided: call `session.setModel()` to switch the agent's underlying LLM on-the-fly (pi SDK's `AgentSession.setModel()` supports this without resetting the session)
3. If invalid name: reply with error and available options

### Allowed Users Configuration

Allowed usernames are stored in a simple array at the engine level. Currently hardcoded:

```typescript
const ALLOWED_USERS = ["nawarian"]; // Telegram usernames (without @)
```

Check is done by comparing `message.from?.username` against the list. Extensible later (config file, environment variable).

### System Prompt for Baikal

> You are Baikal, a helpful home assistant for a Telegram group. You have access to various tools to help the group manage their daily life. Below is the recent message history from the group (excluding messages you've already processed). Use it for context. Only respond to messages that tag you. Be friendly, concise, and proactive — help organize the group's life.

The message log is injected below the system prompt as:
```
--- Recent messages (newest first) ---
[12:30] @alice: what's for dinner?
[12:31] @bob: I was thinking pasta
[12:32] @BaikalBot: schedule pasta for tomorrow
---
```

---

## LLM Provider: DeepSeek via OpenAI SDK

Baikal uses **DeepSeek** as its LLM provider. DeepSeek speaks the OpenAI Chat Completions API format, so it's registered as a custom pi provider via `pi.registerProvider()` with `api: "openai-completions"`.

### Models

| Model ID | Purpose | Default? |
|----------|---------|----------|
| `deepseek-v4-flash` | Fast, lightweight model for everyday interactions | Yes |
| `deepseek-v4-pro` | More capable model for complex reasoning | No |

The bot starts with `deepseek-v4-flash` as the default. Users authorized via `/model` can switch between them.

### Provider Registration

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerProvider("deepseek", {
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "DEEPSEEK_API_KEY",
    api: "openai-completions",
    models: [
      {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        reasoning: false,
        input: ["text"],
        cost: { input: 0.3, output: 1.0, cacheRead: 0.3, cacheWrite: 0.3 },
        contextWindow: 64000,
        maxTokens: 8192,
        compat: {
          maxTokensField: "max_tokens",
          supportsDeveloperRole: false,
        },
      },
      {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        reasoning: true,
        input: ["text"],
        cost: { input: 1.0, output: 4.0, cacheRead: 1.0, cacheWrite: 1.0 },
        contextWindow: 64000,
        maxTokens: 8192,
        compat: {
          maxTokensField: "max_tokens",
          supportsDeveloperRole: false,
          thinkingFormat: "deepseek",
        },
      },
    ],
  });
}
```

### Environment Variable

```
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## pi.dev SDK Integration Details

### Session Creation

```typescript
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@mariozechner/pi-coding-agent";
import { config } from "dotenv";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Load .env
config();

const authStorage = AuthStorage.create();
authStorage.setRuntimeApiKey("deepseek", process.env.DEEPSEEK_API_KEY!);

const modelRegistry = ModelRegistry.create(authStorage);

// Current active model (starts with flash, can be changed via /model)
let currentModel = "deepseek/deepseek-v4-flash";

// Create a single, persistent session
let { session } = await createAgentSession({
  sessionManager: SessionManager.create("session.jsonl"),
  authStorage,
  modelRegistry,
  model: currentModel,
  customTools: [/* loaded from tools/ directory */],
});
```

### Switching Models at Runtime

```typescript
// Find the model by provider/id
const model = modelRegistry.find("deepseek", modelId);
if (model) {
  currentModel = `deepseek/${modelId}`;
  await session.setModel(model);
}
```

`sdk.setModel()` is available on `AgentSession` and switches the underlying LLM without losing conversation history.

### Session Reset (on `/new`)

```typescript
async function resetSession() {
  session.dispose();
  const result = await createAgentSession({
    sessionManager: SessionManager.create("session.jsonl"),
    authStorage,
    modelRegistry,
    model: currentModel,
    customTools: [/* loaded from tools/ directory */],
  });
  session = result.session;
}
```

### Injecting Message Log into Context

When sending a tagged message to the agent session, the engine prepends the recent message log:

```typescript
async function processTaggedMessage(taggedText: string, messageLog: string[]) {
  const contextBlock = messageLog.length > 0
    ? `--- Recent messages (newest first) ---\n${messageLog.join("\n")}\n---`
    : "";

  const fullPrompt = contextBlock
    ? `${contextBlock}\n\n${taggedText}`
    : taggedText;

  await session.prompt(fullPrompt);
}
```

---

## Tool & Skill Discovery

Baikal discovers tools and skills from local directories, mirroring pi's `~/.pi/agent/` pattern. This keeps Baikal extensible without code changes.

### Tools Directory (`tools/`)

Each file in `tools/` exports a tool definition using `defineTool()` from the pi SDK. The engine loads them at startup and registers them with the `AgentSession` via `customTools`.

```typescript
// Example: tools/weather.ts
import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

export default defineTool({
  name: "get_weather",
  label: "Get Weather",
  description: "Get the current weather.",
  parameters: Type.Object({
    location: Type.String({ description: "City name" }),
  }),
  execute: async (_toolCallId, params) => {
    // ...
  },
});
```

The engine scans `tools/*.ts` (and optionally `tools/*.js` after compilation), imports each module's default export, and collects them into the `customTools` array passed to `createAgentSession()`.

### Skills Directory (`skills/`)

Each file in `skills/` is a Markdown file containing instructions that get appended to the system prompt, similar to pi's skill system.

```markdown
<!-- skills/meal-planning.md -->
# Meal Planning

When asked about meal plans, always suggest balanced options.
Consider dietary preferences mentioned in the conversation.
```

The engine reads all `skills/*.md` files at startup, concatenates their content, and appends it to the system prompt as a skills block.

### Combined System Prompt

The final system prompt is assembled from:
1. The base Baikal system prompt
2. Concatenated skill files from `skills/`
3. The recent message log (injected per-request)

```
You are Baikal, a helpful home assistant...

--- Skills ---
[content of skills/*.md files]
---

--- Recent messages (newest first) ---
...
---
```

---

## Allowed Users

```typescript
const ALLOWED_USERS: string[] = ["nawarian"];

function isAllowedUser(username: string | undefined): boolean {
  if (!username) return false;
  return ALLOWED_USERS.includes(username.toLowerCase());
}
```

Future: move to environment variable or config file for easy extension.

---

## File Structure

```
baikal-home-assist/
├── AGENTS.md                   ← pi.dev standard agent context file
├── DESIGN.md                   ← this file
├── package.json
├── tsconfig.json
├── .env                        ← secrets (gitignored)
├── .env.example                ← template for .env
├── src/
│   ├── index.ts                ← entry point: start Telegram bot
│   ├── bot.ts                  ← Telegraf setup, tag detection, command handlers
│   ├── engine.ts               ← Baikal Engine: session lifecycle, message log, model switching
│   ├── deepseek-provider.ts    ← pi extension: register DeepSeek as custom provider
│   ├── config.ts               ← allowed users, constants
│   └── loader.ts               ← loads tools/ and skills/ directories
├── tools/                      ← tool modules (auto-discovered by engine)
│   └── .gitkeep
├── skills/                     ← skill markdown files (auto-discovered by engine)
│   └── .gitkeep
└── session.jsonl               ← pi session file (gitignored)
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@mariozechner/pi-coding-agent` | pi.dev SDK for session management, tools, and events |
| `telegraf` | Telegram Bot API framework |
| `dotenv` | Load .env files |
| `typescript` | Type safety |
| `@types/node` | Node.js type definitions |
| `tsx` or `ts-node` | Run TypeScript directly in development |

---

## Implementation Order

1. **Project scaffold** — `package.json`, `tsconfig.json`, `.env.example`, `AGENTS.md`, directory structure with `tools/` and `skills/`
2. **DeepSeek provider extension** — register DeepSeek as a custom pi provider via `pi.registerProvider()`
3. **Tool & skill loader** — `src/loader.ts`: scan `tools/` and `skills/` directories, import/read their contents
4. **Baikal Engine** — single pi session creation, message log, session reset on `/new`, model switching on `/model`, inject skills into system prompt
5. **Telegram bot** — Telegraf setup, tag detection, `/new` handler, `/model` handler with auth check, message routing
6. **Integration** — wire everything together in `index.ts`

---

## Future Enhancements

- Custom tools for specific capabilities (schedule, meal plans, recipes, etc.)
- Configurable allowed users via environment variable or config file
- Push notifications for reminders
- Voice message support
