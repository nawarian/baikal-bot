import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

let schedulerInstance: any = null;

export function setScheduler(scheduler: any): void {
  schedulerInstance = scheduler;
}

// Build the tool definition with the correct execute signature using a cast
const tool: ToolDefinition = {
  name: "schedule",
  label: "Schedule",
  description:
    "Schedule a message or an agent action to run at a specific time. " +
    "Use this for reminders, recurring reports, or any timed automation. " +
    "The agent will execute your instructions fresh at the scheduled time.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["remind", "run"],
        description:
          '"remind" — send a fixed message at the given time (use message param). ' +
          '"run" — execute instructions fresh at the given time (use instructions param). ' +
          "For weather forecasts, daily briefings, or any dynamic content, use run.",
      },
      message: {
        type: "string",
        description:
          "The exact text to send (for action=remind). E.g. 'Buy milk!'",
      },
      instructions: {
        type: "string",
        description:
          "Instructions for the agent to execute at the scheduled time (for action=run). " +
          "E.g. 'Check the weather forecast for Berlin and summarize it for the group'",
      },
      when: {
        type: "string",
        description:
          "When to run. Formats: " +
          "'in 15 minutes', 'in 2 hours', " +
          "'tomorrow at 9am', 'tomorrow at 14:30', " +
          "'every day at 6am', 'daily at 7:30', " +
          "'every Monday at 9am', 'weekly on Friday at 5pm', " +
          "or an ISO date like '2026-12-25T10:00:00Z'",
      },
    },
    required: ["action", "when"],
  },

  execute: async (
    toolCallId: string,
    params: Record<string, unknown>,
    signal: AbortSignal | undefined,
    onUpdate,
    ctx,
  ) => {
    const { action, message, instructions, when } = params as {
      action: string;
      message?: string;
      instructions?: string;
      when: string;
    };

    if (!schedulerInstance) {
      return {
        content: [{ type: "text" as const, text: "Scheduler is not initialized. Cannot schedule tasks." }],
        details: {},
      };
    }

    const scheduleDef = parseSchedule(when);
    if (!scheduleDef) {
      return {
        content: [{ type: "text" as const, text: `Could not understand the time "${when}". See help for supported formats.` }],
        details: {},
      };
    }

    const chatId = Number(process.env.TELEGRAM_CHAT_ID);
    if (!chatId) {
      return {
        content: [{ type: "text" as const, text: "TELEGRAM_CHAT_ID is not configured. Ask an admin to set it in .env" }],
        details: {},
      };
    }

    if (action === "remind") {
      if (!message) {
        return {
          content: [{ type: "text" as const, text: "You must provide a message for reminders." }],
          details: {},
        };
      }
      const task = {
        id: crypto.randomUUID(),
        schedule: scheduleDef,
        message,
        chatId,
      };
      schedulerInstance.addTask(task);
      return {
        content: [{ type: "text" as const, text: `Scheduled: will send "${message}" at ${describeSchedule(when)}.` }],
        details: {},
      };
    }

    if (action === "run") {
      if (!instructions) {
        return {
          content: [{ type: "text" as const, text: "You must provide instructions for agent actions." }],
          details: {},
        };
      }
      const task = {
        id: crypto.randomUUID(),
        schedule: scheduleDef,
        prompt: instructions,
        chatId,
      };
      schedulerInstance.addTask(task);
      return {
        content: [{ type: "text" as const, text: `Scheduled: I will run "${instructions}" at ${describeSchedule(when)} and post the result to the group.` }],
        details: {},
      };
    }

    return {
      content: [{ type: "text" as const, text: "Invalid action. Use remind or run." }],
      details: {},
    };
  },
};

export default tool;

function parseSchedule(when: string): any {
  // "in X minutes/hours"
  const inMatch = when.match(/^in\s+(\d+)\s+(minute|minutes|hour|hours)$/i);
  if (inMatch) {
    const amount = parseInt(inMatch[1]);
    const unit = inMatch[2].toLowerCase();
    const ms = amount * (unit.startsWith("minute") ? 60000 : 3600000);
    return { type: "once" as const, at: new Date(Date.now() + ms) };
  }

  // "tomorrow at X"
  const tomorrowMatch = when.match(
    /^tomorrow\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i,
  );
  if (tomorrowMatch) {
    const at = new Date();
    at.setDate(at.getDate() + 1);
    at.setHours(
      parseHour(tomorrowMatch[1], tomorrowMatch[3]),
      parseInt(tomorrowMatch[2] ?? "0"),
      0,
      0,
    );
    return { type: "once" as const, at };
  }

  // "every day at X" / "daily at X"
  const dailyMatch = when.match(
    /^(every day|daily)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i,
  );
  if (dailyMatch) {
    return {
      type: "daily" as const,
      hour: parseHour(dailyMatch[2], dailyMatch[4]),
      minute: parseInt(dailyMatch[3] ?? "0"),
    };
  }

  // "every Monday at X" / "weekly on Friday at X"
  const weeklyMatch = when.match(
    /^(every|weekly on)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i,
  );
  if (weeklyMatch) {
    const weekdays: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    return {
      type: "weekly" as const,
      weekday: weekdays[weeklyMatch[2].toLowerCase()],
      hour: parseHour(weeklyMatch[3], weeklyMatch[5]),
      minute: parseInt(weeklyMatch[4] ?? "0"),
    };
  }

  // ISO date
  const isoDate = new Date(when);
  if (!isNaN(isoDate.getTime()) && isoDate > new Date()) {
    return { type: "once" as const, at: isoDate };
  }

  return null;
}

function parseHour(hour: string, ampm?: string): number {
  let h = parseInt(hour);
  if (ampm?.toLowerCase() === "pm" && h < 12) h += 12;
  if (ampm?.toLowerCase() === "am" && h === 12) h = 0;
  return h;
}

function describeSchedule(when: string): string {
  return `the requested time (${when})`;
}
