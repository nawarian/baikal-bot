import { resolve, normalize, isAbsolute } from "node:path";
import { homedir } from "node:os";
import type { AgentSession } from "@mariozechner/pi-coding-agent";

export interface SandboxOptions {
  /** Root directory to scope file access to. Defaults to projectRoot. */
  allowedDirs?: string[];
}

const HOME = homedir();

/**
 * Apply a sandbox to the given agent session that restricts file system access
 * to within the allowed directories.
 *
 * Works by hooking into `session.agent.beforeToolCall` to intercept
 * read/write/edit/bash operations and block those targeting paths
 * outside the allowed scope.
 */
export function applySandbox(
  session: AgentSession,
  projectRoot: string,
  options?: SandboxOptions
): void {
  const allowed = (options?.allowedDirs ?? [projectRoot]).map((p) => resolve(p));
  const agent = session.agent;

  const originalBeforeToolCall = agent.beforeToolCall;

  agent.beforeToolCall = async (context, signal) => {
    const toolCall = context.toolCall;
    const toolName = toolCall.name;
    const args = context.args as Record<string, unknown>;

    // Check path-based tools: read, write, edit
    if (toolName === "read" || toolName === "write" || toolName === "edit") {
      const path = args.path as string | undefined;
      if (path) {
        // Block tilde expansion for file tools (they don't expand ~)
        if (path.startsWith("~")) {
          return {
            block: true,
            reason:
              `Access denied: "${path}" uses tilde expansion which is ` +
              `not allowed. Use an absolute path within the project directory instead.`,
          };
        }
        if (!isPathAllowed(path, allowed)) {
          return {
            block: true,
            reason: `Access denied: "${path}" is outside the allowed directory.`,
          };
        }
      }
    }

    // Check bash — block access to paths outside the project
    if (toolName === "bash") {
      const command = args.command as string | undefined;
      if (command) {
        const violation = checkBashCommand(command, allowed);
        if (violation) {
          return { block: true, reason: violation };
        }
      }
    }

    // Chain to original if one exists
    if (originalBeforeToolCall) {
      return originalBeforeToolCall(context, signal);
    }
  };
}

/**
 * Check if a bash command attempts to access paths outside the allowed directories.
 * Returns a human-readable reason if blocked, or undefined if allowed.
 */
function checkBashCommand(command: string, allowedDirs: string[]): string | undefined {
  // Block explicit cd to directories outside the project
  const cdMatch = command.match(/(?:^|\s*)cd\s+(\S+)/);
  if (cdMatch) {
    const target = cdMatch[1];
    // Allow `cd` with no args (goes to home) or `cd -` (goes to previous)
    if (target && target !== "-" && !target.startsWith("$")) {
      const resolvedTarget = resolveTilde(target);
      if (isAbsolute(resolvedTarget) && !isPathAllowed(resolvedTarget, allowedDirs)) {
        return `Access denied: "cd ${target}" would change to a directory outside the allowed scope.`;
      }
    }
  }

  // Block absolute paths in arguments that point outside the project.
  // This is a best-effort heuristic — look for path-like arguments starting with / or ~.
  const pathArgs = command.match(/(?:^|\s)(\/[^\s|&;<>()`'"$]+|~\/[^\s|&;<>()`'"$]*|~(?=\s|$))(?:\s|$)/g);
  if (pathArgs) {
    for (const match of pathArgs) {
      const trimmed = match.trim();
      const resolved = resolveTilde(trimmed);
      if (isAbsolute(resolved) && !isPathAllowed(resolved, allowedDirs)) {
        // Allow common system commands that reference /dev/null, /tmp, /proc
        if (isSystemPath(resolved)) continue;
        return `Access denied: "${trimmed}" is outside the allowed directory. ` +
               `Only paths within the project directory are permitted.`;
      }
    }
  }

  return undefined;
}

/**
 * Resolve a path that may start with ~ to an absolute path.
 */
function resolveTilde(path: string): string {
  if (path.startsWith("~/")) {
    return resolve(HOME, path.slice(2));
  }
  if (path === "~") {
    return HOME;
  }
  return path;
}

/**
 * Check if a given path resolves within any of the allowed directories.
 */
function isPathAllowed(targetPath: string, allowedDirs: string[]): boolean {
  const resolved = normalize(resolve(targetPath));
  return allowedDirs.some((dir) => {
    const normalizedDir = normalize(dir);
    return (
      resolved === normalizedDir ||
      resolved.startsWith(normalizedDir + "/") ||
      resolved.startsWith(normalizedDir + "\\")
    );
  });
}

/**
 * Allowlist of system paths that bash can safely reference.
 */
function isSystemPath(resolvedPath: string): boolean {
  const safe = [
    "/dev/null",
    "/dev/zero",
    "/dev/random",
    "/dev/urandom",
    "/tmp",
  ];
  return safe.some((p) => resolvedPath.startsWith(p));
}
