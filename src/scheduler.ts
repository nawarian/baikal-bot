import { Telegraf } from "telegraf";

export interface ScheduledTask {
  id: string;
  schedule: ScheduleDef;
  /** For static messages — sent verbatim */
  message?: string;
  /** For agent prompts — runs through the agent at fire time to produce dynamic content */
  prompt?: string;
  chatId: number;
  active: boolean;
  fireCount: number;
}

export type ScheduleDef =
  | { type: "once"; at: Date }
  | { type: "interval"; minutes: number }
  | { type: "daily"; hour: number; minute: number }
  | { type: "weekly"; weekday: number; hour: number; minute: number }; // 0=Sun

export class Scheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private bot: Telegraf;
  /** Callback for prompt-type tasks — set by the engine */
  onPromptTask: ((task: ScheduledTask) => Promise<string>) | null = null;

  constructor(bot: Telegraf) {
    this.bot = bot;
  }

  start(): void {
    this.intervalId = setInterval(() => this.tick(), 30_000);
    console.log("[Scheduler] Started (checking every 30s)");
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  addTask(task: Omit<ScheduledTask, "active" | "fireCount">): void {
    this.tasks.set(task.id, { ...task, active: true, fireCount: 0 });
  }

  removeTask(id: string): void {
    this.tasks.delete(id);
  }

  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  private async tick(): Promise<void> {
    const now = new Date();

    for (const [id, task] of this.tasks.entries()) {
      if (!task.active) continue;
      if (!this.isDue(task, now)) continue;

      try {
        if (task.prompt) {
          // Dynamic content: run through the agent
          if (this.onPromptTask) {
            const result = await this.onPromptTask(task);
            await this.bot.telegram.sendMessage(task.chatId, result, {
              parse_mode: "Markdown",
            });
          } else {
            console.error(`[Scheduler] No onPromptTask handler for task ${id}`);
          }
        } else if (task.message) {
          // Static content: send verbatim
          await this.bot.telegram.sendMessage(task.chatId, task.message, {
            parse_mode: "Markdown",
          });
        }

        task.fireCount++;

        // Remove one-shot tasks
        if (task.schedule.type === "once") {
          this.tasks.delete(id);
        }
      } catch (err) {
        console.error(`[Scheduler] Failed to execute task ${id}:`, err);
      }
    }
  }

  private isDue(task: ScheduledTask, now: Date): boolean {
    switch (task.schedule.type) {
      case "once":
        return now >= task.schedule.at;
      case "daily":
        return (
          now.getHours() === task.schedule.hour &&
          now.getMinutes() >= task.schedule.minute &&
          now.getMinutes() < task.schedule.minute + 2
        );
      case "weekly":
        return (
          now.getDay() === task.schedule.weekday &&
          now.getHours() === task.schedule.hour &&
          now.getMinutes() >= task.schedule.minute &&
          now.getMinutes() < task.schedule.minute + 2
        );
      default:
        return false;
    }
  }
}
