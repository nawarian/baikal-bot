import { config } from "dotenv";
import { BaikalEngine } from "./engine.js";
import { BaikalBot } from "./bot.js";

// Load environment variables from .env
config();

async function main(): Promise<void> {
  console.log("[Baikal] Starting Baikal Home Assistant...");

  // 1. Create the engine (manages pi session, tools, skills, message log)
  const engine = new BaikalEngine();
  await engine.init();
  console.log("[Baikal] Engine initialized.");

  // 2. Create the Telegram bot
  const bot = new BaikalBot(engine);

  // 3. Handle graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`\n[Baikal] Received ${signal}, shutting down...`);
    bot.stop(signal);
    engine.dispose();
    process.exit(0);
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  // 4. Start polling
  await bot.start();
  console.log("[Baikal] Ready to assist!");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[Baikal] Fatal error:", message);
  process.exit(1);
});
