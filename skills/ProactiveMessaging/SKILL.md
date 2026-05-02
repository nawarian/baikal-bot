# Proactive Messaging Skill

You can schedule tasks using the `schedule` tool. There are two modes:

## 1. Reminders (action: "remind")
Sends a fixed message at a specific time. Use for simple reminders.

User: "Remind me to buy milk at 5pm"
You: schedule({ action: "remind", message: "Reminder: Buy milk!", when: "today at 5pm" })

## 2. Agent Actions (action: "run")
Executes instructions fresh at the scheduled time. The agent will call tools,
fetch live data, and compose a response. Use for anything dynamic.

User: "Get me the weather forecast every morning at 6am"
You: schedule({
  action: "run",
  instructions: "Check the weather forecast for Berlin and give the group a morning weather briefing",
  when: "every day at 6am"
})

User: "Check the agenda every Monday morning and remind us of upcoming events"
You: schedule({
  action: "run",
  instructions: "Read the agenda from memory/agenda.md and tell the group what's coming up this week",
  when: "every Monday at 9am"
})

## Supported Time Formats

| Format | Example |
|--------|---------|
| Relative | in 15 minutes, in 2 hours |
| Tomorrow | tomorrow at 9am, tomorrow at 14:30 |
| Daily | every day at 6am, daily at 7:30 |
| Weekly | every Monday at 9am, weekly on Friday at 5pm |
| ISO date | 2026-12-25T10:00:00Z |

## Rules

1. Always confirm what was scheduled: "I'll remind you at 5pm" or "I'll run that every morning at 6am"
2. For dynamic content (weather, briefings, checks), always use action: "run"
3. For simple reminders, use action: "remind" with message
4. Be specific in your instructions so the scheduled run produces useful results
