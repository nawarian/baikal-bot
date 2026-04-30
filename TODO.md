# TODO: Questions and Follow-ups

## DeepSeek Model IDs
- **DESIGN.md** specifies model IDs: `deepseek-v4-flash` and `deepseek-v4-pro`
- **Implementation** uses: `deepseek-chat` and `deepseek-reasoner` (actual DeepSeek API model names)
- **Question:** Should we use the DESIGN.md names or the actual DeepSeek API model IDs? The actual API uses `deepseek-chat` and `deepseek-reasoner`.

## Telegram Threaded Replies
- The latest `@telegraf/types` API uses `reply_parameters` (with `message_id`) instead of the old `reply_to_message_id` field
- Implementation uses `reply_parameters: { message_id }` cast as `any` to work around type differences
- **Question:** Verify threaded replies work correctly in the target Telegram group.

## Built-in Tools
- Implementation uses `tools: []` to disable pi's built-in tools (read, bash, edit, write)
- This means the LLM will only have access to custom tools loaded from `tools/`
- **Question:** Should some built-in tools be enabled? The DESIGN.md implies tools are loaded from `tools/` directory.

## Skill Prompt Injection
- Implementation injects skills into the system prompt via `systemPromptOverride`
- Skills are loaded from `skills/*.md` files at startup
- **Question:** Confirm this approach is correct — skills don't change at runtime.

## Message Log Context
- Message log is injected as a text block before each tagged prompt
- The log is trimmed to 100 entries
- **Question:** Is the context injection format clear enough for the LLM?

## Error Handling
- `/new` failures send a generic error message to the user
- `/model` failures send the actual error message
- **Question:** Should all user-facing errors be generic to avoid leaking internals?
