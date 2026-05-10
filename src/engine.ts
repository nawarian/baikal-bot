import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Model, Api } from "@mariozechner/pi-ai";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  type AgentSession,
} from "@mariozechner/pi-coding-agent";
import { config } from "dotenv";
import { loadAll } from "./loader.js";
import {
  DEFAULT_MODEL_ID,
  PRO_MODEL_ID,
  MAX_MESSAGE_LOG,
} from "./config.js";

// Load .env
config();

const __dirname = import.meta.dirname ?? fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");

/**
 * Represents a single message in the in-memory message log.
 */
export interface LoggedMessage {
  /** Telegram user display name or @username */
  from: string;
  /** Message text content */
  text: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
}

/**
 * Baikal Engine — manages the pi AgentSession, message log,
 * tool/skill loading, and model switching.
 */
export class BaikalEngine {
  /** The active pi AgentSession. */
  session!: AgentSession;

  /** Auth storage for API keys. */
  authStorage: AuthStorage;

  /** Model registry for looking up models. */
  modelRegistry: ModelRegistry;

  /** In-memory message log (persists across /new). */
  messageLog: LoggedMessage[] = [];

  /** Current model identifier (e.g. "deepseek/deepseek-chat"). */
  currentModelId: string;

  /** Currently active Model object. */
  private currentModelObj: Model<Api> | undefined;

  /** Loaded custom tools. */
  customTools: ToolDefinition[] = [];

  /** Loaded skills text. */
  skills: string = "";

  /** Loaded memory content (all .md files from memory/ directory). */
  memoryContent: string = "";

  /** Session file path. */
  sessionFile: string;

  /** Project root directory. */
  rootDir: string;

  constructor() {
    this.authStorage = AuthStorage.create();
    this.modelRegistry = ModelRegistry.create(this.authStorage);
    this.currentModelId = `deepseek/${DEFAULT_MODEL_ID}`;
    this.sessionFile = resolve(ROOT, "session.jsonl");
    this.rootDir = ROOT;
  }

  /**
   * Initialize the engine: set runtime API key, register DeepSeek provider,
   * load tools and skills, and create the pi session.
   */
  async init(): Promise<void> {
    // Set the DeepSeek API key at runtime
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error(
        "DEEPSEEK_API_KEY environment variable is required. " +
        "Create a .env file based on .env.example"
      );
    }
    this.authStorage.setRuntimeApiKey("deepseek", apiKey);

    // Register the DeepSeek provider in the model registry
    // We use the inline config helper instead of loading the extension module
    const deepseekConfig = getDeepSeekProviderConfig();
    this.modelRegistry.registerProvider("deepseek", deepseekConfig);

    // Load tools, skills, and memory
    const loaderResult = await loadAll();
    this.customTools = loaderResult.tools;
    this.skills = loaderResult.skills;
    this.memoryContent = this.loadMemory();

    if (loaderResult.errors.length > 0) {
      console.warn("[Baikal] Warnings during tool/skill loading:");
      for (const err of loaderResult.errors) {
        console.warn(`  ${err}`);
      }
    }

    // Resolve the current model
    this.currentModelObj = this.modelRegistry.find("deepseek", DEFAULT_MODEL_ID);
    if (!this.currentModelObj) {
      throw new Error(
        `Model "deepseek/${DEFAULT_MODEL_ID}" not found in registry. ` +
        "Make sure the DeepSeek provider extension is loaded correctly."
      );
    }

    // Build the resource loader with our custom system prompt
    const resourceLoader = await this.createResourceLoader();

    const result = await createAgentSession({
      cwd: this.rootDir,
      sessionManager: SessionManager.open(this.sessionFile, this.rootDir),
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      model: this.currentModelObj,
      resourceLoader,
      customTools: this.customTools,
    });

    this.session = result.session;

    if (result.modelFallbackMessage) {
      console.warn("[Baikal]", result.modelFallbackMessage);
    }

    // Apply sandbox to restrict file access to the project directory
    const { applySandbox } = await import("./sandbox.js");
    applySandbox(this.session, this.rootDir);
  }

  /**
   * Build the resource loader with our custom system prompt and skills.
   */
  private async createResourceLoader(): Promise<DefaultResourceLoader> {
    const loader = new DefaultResourceLoader({
      cwd: ROOT,
      agentDir: resolve(ROOT, ".pi"),
      systemPromptOverride: () => this.buildSystemPrompt(),
    });

    await loader.reload();
    return loader;
  }

  /**
   * Build the full system prompt from the base prompt + skills.
   */
  private buildSystemPrompt(): string {
    let prompt =
      "You are Baikal, a helpful home assistant for a Telegram group. " +
      "You have access to various tools to help the group manage their daily life. " +
      "Below is the recent message history from the group (excluding messages you've already processed). " +
      "Use it for context. Only respond to messages that tag you. " +
      "Be friendly, concise, and proactive — help organize the group's life.";

    if (this.skills) {
      prompt += `\n\n--- Skills ---\n${this.skills}\n---`;
    }

    return prompt;
  }

  /**
   * Load all .md files from the memory/ directory and return them as a formatted block.
   * This runs on every tagged message so the agent always has the latest memory.
   */
  private loadMemory(): string {
    const memoryDir = join(this.rootDir, "memory");
    if (!existsSync(memoryDir)) return "";

    const entries = readdirSync(memoryDir, { withFileTypes: true });
    const parts: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name.startsWith(".")) {
        continue;
      }

      const filePath = join(memoryDir, entry.name);
      try {
        const content = readFileSync(filePath, "utf-8");
        parts.push(`--- ${entry.name} ---\n${content}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[Baikal] Failed to read memory/${entry.name}: ${message}`);
      }
    }

    return parts.join("\n\n");
  }

  /**
   * Get a formatted block of memory content for injection into context.
   */
  private getMemoryBlock(): string {
    if (!this.memoryContent) return "";
    return `--- Persistent Memory ---\n${this.memoryContent}\n---`;
  }

  /**
   * Get a formatted block of recent messages for injection into context.
   */
  getRecentMessagesBlock(): string {
    if (this.messageLog.length === 0) return "";

    const recent = this.messageLog.slice(-MAX_MESSAGE_LOG);
    const lines = recent.map(
      (m) => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.from}: ${m.text}`
    );

    return `--- Recent messages (newest first) ---\n${lines.join("\n")}\n---`;
  }

  /**
   * Append a message to the in-memory log and trim if needed.
   */
  logMessage(from: string, text: string): void {
    this.messageLog.push({ from, text, timestamp: Date.now() });
    if (this.messageLog.length > MAX_MESSAGE_LOG * 2) {
      this.messageLog = this.messageLog.slice(-MAX_MESSAGE_LOG);
    }
  }

  /**
   * Process a message that tags the bot.
   * Injects persistent memory, the recent message log, and prompts the agent.
   * Memory is freshly read from disk each time to reflect any agent-saved changes.
   */
  async processTaggedMessage(taggedText: string): Promise<void> {
    // Re-read memory from disk to pick up any files the agent may have saved
    this.memoryContent = this.loadMemory();

    const memoryBlock = this.getMemoryBlock();
    const contextBlock = this.getRecentMessagesBlock();

    const parts: string[] = [];
    if (memoryBlock) parts.push(memoryBlock);
    if (contextBlock) parts.push(contextBlock);
    parts.push(taggedText);

    await this.session.prompt(parts.join("\n\n"));
  }

  /**
   * Reset the session (discard conversation history, keep message log).
   */
  async resetSession(): Promise<void> {
    this.session.dispose();

    // Clear the message log so the fresh session starts with no context
    this.messageLog = [];

    const resourceLoader = await this.createResourceLoader();

    const result = await createAgentSession({
      cwd: this.rootDir,
      sessionManager: SessionManager.open(this.sessionFile, this.rootDir),
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      model: this.currentModelObj!,
      resourceLoader,
      customTools: this.customTools,
    });

    this.session = result.session;

    if (result.modelFallbackMessage) {
      console.warn("[Baikal]", result.modelFallbackMessage);
    }

    // Re-apply sandbox on the new session
    const { applySandbox } = await import("./sandbox.js");
    applySandbox(this.session, this.rootDir);
  }

  /**
   * Reload tools and skills at runtime without resetting the conversation.
   * Re-scans the tools/ and skills/ directories and hot-swaps the agent's tool set.
   * Returns a message describing the result.
   */
  async reloadToolsAndSkills(): Promise<string> {
    const loaderResult = await loadAll();
    this.customTools = loaderResult.tools;
    this.skills = loaderResult.skills;
    this.memoryContent = this.loadMemory();

    // Keep built-in tools, replace custom tools in-place
    // The agent's tool array is a mix of built-in tools and custom tools
    const currentTools = this.session.agent.state.tools;
    // Built-in tools are those whose names don't appear in the OLD customTools
    const oldCustomNames = new Set(this.customTools.map((t) => t.name));
    const builtInTools = currentTools.filter((t) => !oldCustomNames.has(t.name));
    // Cast new custom tools (ToolDefinition is structurally compatible with AgentTool)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.session.agent.state.tools = [...builtInTools, ...this.customTools] as any;

    // Update the system prompt with new skills (will apply on next turn)
    const systemPrompt = this.buildSystemPrompt();
    this.session.agent.state.systemPrompt = systemPrompt;

    const warnings: string[] = [];
    if (loaderResult.errors.length > 0) {
      warnings.push(...loaderResult.errors.map((e) => `  ${e}`));
    }

    const toolNames = this.customTools.map((t) => t.name).join(", ");
    const skillCount = Object.keys(loaderResult.skillsMap).length;
    return (
      `Tools, skills, and memory reloaded. ` +
      `Loaded ${this.customTools.length} tool(s)` +
      (this.customTools.length > 0 ? ` (${toolNames})` : "") +
      ` and ${skillCount} skill(s).` +
      (this.memoryContent ? ` Memory has ${this.countMemoryFiles()} file(s).` : " Memory directory is empty.") +
      (warnings.length > 0 ? `\nWarnings:\n${warnings.join("\n")}` : "")
    );
  }

  /**
   * Count the number of .md files in the memory/ directory.
   */
  private countMemoryFiles(): number {
    const memoryDir = join(this.rootDir, "memory");
    if (!existsSync(memoryDir)) return 0;
    return readdirSync(memoryDir)
      .filter((f) => f.endsWith(".md") && !f.startsWith("."))
      .length;
  }

  /**
   * Switch the active model for the agent session.
   * Returns a message describing the result.
   */
  async switchModel(modelName: string): Promise<string> {
    // Normalise: strip "deepseek/" prefix if provided
    const name = modelName.replace(/^deepseek\//, "");

    if (name !== DEFAULT_MODEL_ID && name !== PRO_MODEL_ID) {
      const available = [DEFAULT_MODEL_ID, PRO_MODEL_ID].join(", ");
      return `Invalid model "${modelName}". Available models: ${available}`;
    }

    const model = this.modelRegistry.find("deepseek", name);
    if (!model) {
      return `Model "${name}" not found in registry.`;
    }

    this.currentModelId = `deepseek/${name}`;
    this.currentModelObj = model;
    await this.session.setModel(model);
    return `Model switched to ${name}.`;
  }

  /**
   * Get the current model display name.
   */
  getCurrentModelName(): string {
    return this.currentModelId.replace("deepseek/", "");
  }

  /**
   * Get available model names.
   */
  getAvailableModels(): string[] {
    return [DEFAULT_MODEL_ID, PRO_MODEL_ID];
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.session.dispose();
  }
}

/**
 * Returns the DeepSeek provider config for direct registration on the ModelRegistry,
 * mirroring what the extension module would register via pi.registerProvider().
 */
function getDeepSeekProviderConfig() {
  return {
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "DEEPSEEK_API_KEY",
    api: "openai-completions" as const,
    models: [
      {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        reasoning: false,
        input: ["text" as const],
        cost: { input: 0.3, output: 1.0, cacheRead: 0.3, cacheWrite: 0.3 },
        contextWindow: 64000,
        maxTokens: 8192,
        compat: {
          maxTokensField: "max_tokens" as const,
          supportsDeveloperRole: false,
        },
      },
      {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        reasoning: true,
        input: ["text" as const],
        cost: { input: 1.0, output: 4.0, cacheRead: 1.0, cacheWrite: 1.0 },
        contextWindow: 64000,
        maxTokens: 8192,
        compat: {
          maxTokensField: "max_tokens" as const,
          supportsDeveloperRole: false,
          thinkingFormat: "deepseek" as const,
        },
      },
    ],
  };
}
