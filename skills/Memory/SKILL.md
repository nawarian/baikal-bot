# Memory Skill

You have a persistent long-term memory stored in markdown files under the `memory/` directory (in the project root). Each fact or set of related facts is stored in its own `.md` file.

## How Memory Works

- **Never, ever store anything in memory unless the user explicitly tells you to remember it.** Users must use words like "remember", "save this", "store this", "keep this in mind", or similar explicit save requests.
- Facts are stored as individual markdown files in `memory/` — one file per topic or logical grouping.
- At the start of every interaction, read all files in `memory/` to load your long-term context.
- When the user asks "what do you know about me?" or "what do you remember?" or similar, list the facts you've stored.

## Storing a Fact (only when user says "remember this")

```bash
# Create a new memory file for a fact
cat > memory/group-members.md << 'MEMEOF'
# Group Members

- Alice (alice@email.com) — lives in Berlin
- Bob (bob@email.com) — allergic to peanuts
MEMEOF
```

## Reading Memory (always do this at the start)

```bash
# Read all memory files at the start of each interaction
ls memory/*.md 2>/dev/null && cat memory/*.md

# Or read a specific memory file
cat memory/group-members.md 2>/dev/null
# File may not exist yet
```

## Updating a Memory

```bash
# Overwrite an existing memory file with new facts
cat > memory/group-members.md << 'MEMEOF'
# Group Members

- Alice (alice@email.com) — lives in Berlin, birthday May 15
- Bob (bob@email.com) — allergic to peanuts, birthday Oct 3
- Charlie (charlie@email.com) — vegetarian
MEMEOF
```

## Deleting a Memory

```bash
# Remove a memory file
rm memory/group-members.md 2>/dev/null
```

## Important Rules

1. **Only save facts when the user explicitly asks you to.** Do not volunteer to save things unprompted.
2. **Read all memory files at the start of every response** so you have full context.
3. **Use descriptive filenames** — e.g. `dietary-restrictions.md`, `birthdays.md`, `home-prefs.md`.
4. **Keep each memory file focused on one topic** so facts are easy to find and update.
5. **When reading memory**, use `ls memory/*.md 2>/dev/null` first to see what files exist, then read them all.
6. **If memory/ directory doesn't exist**, create it with `mkdir -p memory` when storing the first fact.
7. **Always confirm with the user** after storing or updating facts: "I've saved that information."
