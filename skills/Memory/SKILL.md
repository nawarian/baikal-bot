# Memory Skill

You have a persistent long-term memory stored in markdown files under the `memory/` directory (in the project root). Each fact or set of related facts is stored in its own `.md` file.

## How Memory Works

- **Never, ever store anything in memory unless the user explicitly tells you to remember it.** Users must use words like "remember", "save this", "store this", "keep this in mind", or similar explicit save requests.
- Facts are stored as individual markdown files in `memory/` — one file per topic or logical grouping.
- **All memory files are automatically loaded into your context at the start of every interaction** (every time you are tagged). You do NOT need to manually `cat` or `ls` memory files — their content is already available in the `--- Persistent Memory ---` block at the top of your context.
- Because all memory is pre-loaded, **you already know the topics and their contents**. There is no need to list or read files separately unless you need to verify the current state of a file you just wrote.
- When the user asks "what do you know about me?" or "what do you remember?" — just summarise what you see in the persistent memory block. You already have the full content.

## Writing / Updating / Deleting Memory

You still use bash to persist new information:

### Storing a Fact (only when user says "remember this")

```bash
# Create a new memory file for a fact
mkdir -p memory
cat > memory/group-members.md << 'MEMEOF'
# Group Members

- Alice (alice@email.com) — lives in Berlin
- Bob (bob@email.com) — allergic to peanuts
MEMEOF
```

### Updating a Memory

```bash
# Overwrite an existing memory file with new facts
cat > memory/group-members.md << 'MEMEOF'
# Group Members

- Alice (alice@email.com) — lives in Berlin, birthday May 15
- Bob (bob@email.com) — allergic to peanuts, birthday Oct 3
- Charlie (charlie@email.com) — vegetarian
MEMEOF
```

### Deleting a Memory

```bash
# Remove a memory file
rm memory/group-members.md 2>/dev/null
```

## Important Rules

1. **Only save facts when the user explicitly asks you to.** Do not volunteer to save things unprompted.
2. **Do NOT manually `cat` or `ls` memory files to read them.** Memory is pre-loaded into your context on every interaction.
3. **Use descriptive filenames** — e.g. `dietary-restrictions.md`, `birthdays.md`, `home-prefs.md`.
4. **Keep each memory file focused on one topic** so facts are easy to find and update.
5. **If memory/ directory doesn't exist**, create it with `mkdir -p memory` when storing the first fact.
6. **Always confirm with the user** after storing or updating facts: "I've saved that information."
7. **After writing a memory file**, note that the pre-loaded context still shows the old version for the *current* interaction. Your changes will be picked up on the *next* tagged message when memory is re-read from disk.
