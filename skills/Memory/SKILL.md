# Memory Skill

You have a persistent long-term memory stored in markdown files under the `memory/` directory (in the project root). Each fact or set of related facts is stored in its own `.md` file.

## How Memory Works

- **Never, ever store anything in memory unless the user explicitly tells you to remember it.** Users must use words like "remember", "save this", "store this", "keep this in mind", or similar explicit save requests.
- Facts are stored as individual markdown files in `memory/` — one file per topic or logical grouping.
- **Do NOT read all memory files on every interaction.** Memory files can be large and numerous. Instead, **list the available topics** by scanning filenames, then only read specific files when the user's question relates to that topic.
- When the user asks "what do you know about me?" or "what do you remember?" or similar, list the topics (filenames) you've stored.

## How to Decide Which File to Read

For example, given these files in `memory/`:

```
agenda.md               → important dates, appointments, visa deadlines
family.md               → family member info (names, allergies, preferences)
meal-plans.md           → links to meal plan spreadsheets
```

When the user asks about:
- "what's for lunch today?" → read `meal-plans.md` (tells you where the spreadsheet is)
- "when is the visa appointment?" → read `agenda.md`
- "what do you remember?" → **list filenames only**, do not read them

## Listing Topics (always safe, no file reading needed)

```bash
ls memory/*.md 2>/dev/null
# Output example:
# memory/agenda.md
# memory/family.md
# memory/meal-plans.md
# memory/kw19-mealplan-adults.md
# memory/kw19-mealplan-lua.md
```

## Reading a Specific Memory File

```bash
cat memory/family.md
cat memory/agenda.md
```

Only read files whose topic matches the user's question. Do not read irrelevant files.

## Storing a Fact (only when user says "remember this")

```bash
# Create a new memory file for a fact
mkdir -p memory
cat > memory/group-members.md << 'MEMEOF'
# Group Members

- Alice (alice@email.com) — lives in Berlin
- Bob (bob@email.com) — allergic to peanuts
MEMEOF
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
2. **Do NOT read all memory files upfront.** List filenames first, then read only what's relevant to the current question.
3. **Use descriptive filenames** — e.g. `dietary-restrictions.md`, `birthdays.md`, `home-prefs.md`.
4. **Keep each memory file focused on one topic** so facts are easy to find and update.
5. **When listing memory**, use `ls memory/*.md 2>/dev/null` to show available topics.
6. **Only read a file** with `cat memory/<filename>` when the user's question matches its topic.
7. **If memory/ directory doesn't exist**, create it with `mkdir -p memory` when storing the first fact.
8. **Always confirm with the user** after storing or updating facts: "I've saved that information."
