/**
 * Baikal configuration constants.
 */

/** Telegram usernames (without @) authorized to use /model command. */
export const ALLOWED_USERS: string[] = ["nawarian"];

/** Maximum number of recent messages to keep in the message log. */
export const MAX_MESSAGE_LOG = 100;

/** Default DeepSeek model ID (without provider prefix). */
export const DEFAULT_MODEL_ID = "deepseek-v4-flash";

/** Pro DeepSeek model ID (for /model switching). */
export const PRO_MODEL_ID = "deepseek-v4-pro";

/** Bot's Telegram username (set at runtime after bot info is fetched). */
export let BOT_USERNAME: string | undefined;

export function setBotUsername(username: string | undefined): void {
  BOT_USERNAME = username;
}

export function isAllowedUser(username: string | undefined): boolean {
  if (!username) return false;
  return ALLOWED_USERS.includes(username.toLowerCase());
}
