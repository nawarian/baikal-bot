/**
 * Shared registry for the scheduler instance.
 *
 * The scheduler tool definition in tools/scheduler.ts needs access to the
 * active Scheduler instance at runtime (to add tasks), but bot.ts also
 * needs to set it during initialization. Since tools/ is excluded from the
 * Docker build (it's a mountable volume for user custom tools), the direct
 * import from bot.ts into tools/ would fail.
 *
 * This registry decouples them: bot.ts sets the instance here, and the
 * scheduler tool reads it from here.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _instance: any = null;

/**
 * Set the active scheduler instance.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setScheduler(scheduler: any): void {
  _instance = scheduler;
}

/**
 * Get the active scheduler instance.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getScheduler(): any {
  return _instance;
}
