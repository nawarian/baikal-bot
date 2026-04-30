import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  type AgentSession,
  type Model,
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

  /** Loaded custom tools. */
  customTools: import("@mariozechner/pi-coding-agent").Tool[] = [];

  /** Loaded skills text. */
  skills: string = "";

  /** Session file path. */
  sessionFile: string;

  constructor() {
    this.authStorage = AuthStorage.create();
    this.modelRegistry = ModelRegistry.create(this.authStorage);
    this.currentModelId = `deepseek/${DEFAULT_MODEL_ID}`;
    this.sessionFile = resolve(ROOT, "session.jsonl");
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

    // Load tools and skills
    const loaderResult = await loadAll();
    this.customTools = loaderResult.tools;
    this.skills = loaderResult.skills;

    if (loaderResult.errors.length > 0) {
      console.warn("[Baikal] Warnings during tool/skill loading:");
      for (const err of loaderResult.errors) {
        console.warn(`  ${err}`);
      }
    }

    // Create a DefaultResourceLoader with custom system prompt and skills
    const resourceLoader = await this.createResourceLoader();

    const result = await createAgentSession({
      sessionManager: SessionManager.create(this.sessionFile),
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      model: this.currentModelId,
      customTools: this.customTools,
      resourceLoader,
    });

    this.session = result.session;

    if (result.modelFallbackMessage) {
      console.warn("[Baikal]", result.modelFallbackMessage);
    }
  }

  /**
   * Build the resource loader with our custom system prompt and skills.
   */
  private async createResourceLoader(): Promise<DefaultResourceLoader> {
    const loader = new DefaultResourceLoader({
      cwd: ROOT,
      systemPromptOverride: () => this.buildSystemPrompt(),
    });

    // Register the DeepSeek provider extension
    const { default: deepseekExtension } = await import("./deepseek-provider.js");
    loader.addExtensionFactory(deepseekExtension);

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
   * Injects the recent message log into context and prompts the agent.
   */
  async processTaggedMessage(taggedText: string): Promise<void> {
    const contextBlock = this.getRecentMessagesBlock();
    const fullPrompt = contextBlock
      ? `${contextBlock}\n\n${taggedText}`
      : taggedText;

    await this.session.prompt(fullPrompt);
  }

  /**
   * Reset the session (discard conversation history, keep message log).
   */
  async resetSession(): Promise<void> {
    this.session.dispose();

    const resourceLoader = await this.createResourceLoader();

    const result = await createAgentSession({
      sessionManager: SessionManager.create(this.sessionFile),
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      model: this.currentModelId,
      customTools: this.customTools,
      resourceLoader,
    });

    this.session = result.session;

    if (result.modelFallbackMessage) {
      console.warn("[Baikal]", result.modelFallbackMessage);
    }
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
