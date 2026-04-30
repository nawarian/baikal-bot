import { Telegraf, type Context } from "telegraf";
import type { Message } from "@telegraf/types";
import { BOT_USERNAME, setBotUsername, isAllowedUser } from "./config.js";
import type { BaikalEngine } from "./engine.js";

/**
 * Baikal Telegram Bot — handles message routing, tag detection,
 * and command dispatching.
 */
export class BaikalBot {
  bot: Telegraf;
  engine: BaikalEngine;

  constructor(engine: BaikalEngine) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error(
        "TELEGRAM_BOT_TOKEN environment variable is required. " +
        "Create a .env file based on .env.example"
      );
    }

    this.bot = new Telegraf(token);
    this.engine = engine;

    this.setupHandlers();
  }

  /**
   * Start the bot: launch Telegraf and set bot info.
   */
  async start(): Promise<void> {
    // Fetch bot info to get the bot's username
    await this.bot.telegram.getMe().then((botInfo) => {
      setBotUsername(botInfo.username ?? undefined);
      console.log(`[Baikal] Bot started as @${BOT_USERNAME}`);
    });

    // Start polling
    this.bot.launch();
    console.log("[Baikal] Polling for updates...");
  }

  /**
   * Stop the bot gracefully.
   */
  stop(signal?: string): void {
    this.bot.stop(signal);
  }

  /**
   * Set up all message and command handlers.
   */
  private setupHandlers(): void {
    // /start and /help commands
    this.bot.command(["start", "help"], async (ctx) => {
      await this.handleHelp(ctx);
    });

    // /new command — reset agent context
    this.bot.command("new", async (ctx) => {
      await this.handleNew(ctx);
    });

    // /model command — switch model (authorized users only)
    this.bot.command("model", async (ctx) => {
      await this.handleModel(ctx);
    });

    // /reload command — reload tools and skills
    this.bot.command("reload", async (ctx) => {
      await this.handleReload(ctx);
    });

    // All other messages — check for tag
    this.bot.on("text", async (ctx) => {
      await this.handleMessage(ctx);
    });
  }

  /**
   * Check if a message tags the bot via mention entities.
   */
  private isTagged(message: Message.TextMessage): boolean {
    const botUsername = BOT_USERNAME;
    if (!botUsername) return false;

    if (!message.entities || message.entities.length === 0) return false;

    return message.entities.some((entity) => {
      if (entity.type === "mention") {
        // Extract the mention text (e.g. "@BaikalBot")
        const mention = message.text.slice(
          entity.offset,
          entity.offset + entity.length
        );
        return mention.toLowerCase() === `@${botUsername.toLowerCase()}`;
      }
      return false;
    });
  }

  /**
   * Handle /start and /help commands.
   */
  private async handleHelp(ctx: Context): Promise<void> {
    const helpText =
      `🤖 *Welcome to Baikal Home Assistant!*\n\n` +
      `I'm a helpful bot that assists with managing the group. ` +
      `To interact with me, simply tag me in a message:\n` +
      `\`@${BOT_USERNAME ?? "BaikalBot"} what's on the agenda?\`\n\n` +
      `*Commands:*\n` +
      `/start, /help — Show this message\n` +
      `/new — Reset my conversation context (keeps message history)\n` +
      `/model — Switch AI model (authorized users only)\n` +
      `/reload — Reload tools and skills from disk without resetting\n\n` +
      `I silently observe all messages but only respond when tagged. ` +
      `My capabilities can be extended with custom tools and skills.`;

    await ctx.reply(helpText, { parse_mode: "Markdown" as const });
  }

  /**
   * Handle /new command — reset agent context.
   */
  private async handleNew(ctx: Context): Promise<void> {
    try {
      await this.engine.resetSession();
      await ctx.reply("Context reset. I'm ready to start fresh.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[Baikal] Failed to reset session:", message);
      await ctx.reply("Sorry, I couldn't reset my context. Please try again.");
    }
  }

  /**
   * Handle /reload command — reload tools and skills from disk.
   */
  private async handleReload(ctx: Context): Promise<void> {
    try {
      const result = await this.engine.reloadToolsAndSkills();
      await ctx.reply(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[Baikal] Failed to reload tools/skills:", message);
      await ctx.reply("Failed to reload tools and skills. Check server logs.");
    }
  }

  /**
   * Handle /model command — show or switch model.
   */
  private async handleModel(ctx: Context): Promise<void> {
    const username = ctx.from?.username;

    if (!isAllowedUser(username)) {
      await ctx.reply("Sorry, only authorized users can change the model.");
      return;
    }

    // Extract args from the command
    const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
    const parts = text.split(/\s+/);
    const modelArg = parts[1];

    if (!modelArg) {
      // Show current model and available options
      const current = this.engine.getCurrentModelName();
      const available = this.engine.getAvailableModels().join(", ");
      await ctx.reply(
        `Current model: ${current}\nAvailable: ${available}\nTo switch, use /model <name>`
      );
      return;
    }

    try {
      const result = await this.engine.switchModel(modelArg);
      await ctx.reply(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[Baikal] Failed to switch model:", message);
      await ctx.reply(`Failed to switch model: ${message}`);
    }
  }

  /**
   * Handle a regular text message — log it, and if it tags the bot, respond.
   */
  private async handleMessage(ctx: Context): Promise<void> {
    const message = ctx.message;
    if (!message || !("text" in message)) return;

    const text = message.text;
    const fromName = ctx.from?.username
      ? `@${ctx.from.username}`
      : ctx.from?.first_name ?? "Unknown";

    // Log the message
    this.engine.logMessage(fromName, text);

    // Check if the bot is tagged
    if (!this.isTagged(message)) return;

    // Strip the bot mention from the message to get the actual query
    const query = this.stripMention(text);

    if (!query || query.trim().length === 0) return;

    // Subscribe to session events to capture the response
    let responseText = "";
    const unsubscribe = this.engine.session.subscribe((event) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        responseText += event.assistantMessageEvent.delta;
      }

      if (event.type === "turn_end") {
        // Send the response as a threaded reply
        if (responseText.trim()) {
          const parseMode = responseText.includes("*") ? "Markdown" as const : undefined;
          ctx
            .reply(responseText, {
              parse_mode: parseMode,
              reply_parameters: { message_id: message.message_id },
            } as any)
            .catch((err) =>
              console.error("[Baikal] Failed to send reply:", err)
            );
        }
        unsubscribe();
      }
    });

    try {
      await this.engine.processTaggedMessage(query);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[Baikal] Error processing tagged message:", errorMsg);
      await ctx.reply("Sorry, I ran into an issue processing your request.");
      unsubscribe();
    }
  }

  /**
   * Remove the bot's @mention from the message text.
   * Handles mentions at the beginning, middle, or end of the message.
   */
  private stripMention(text: string): string {
    if (!BOT_USERNAME) return text;

    // Remove @BaikalBot mentions (case-insensitive)
    const mentionPattern = new RegExp(
      `@${BOT_USERNAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      "gi"
    );
    return text.replace(mentionPattern, "").trim();
  }
}
