import { resolve, normalize } from "node:path";
import type { AgentSession } from "@mariozechner/pi-coding-agent";

export interface SandboxOptions {
  /** Root directory to scope file access to. Defaults to projectRoot. */
  allowedDirs?: string[];
}

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
      if (path && !isPathAllowed(path, allowed)) {
        return {
          block: true,
          reason: `Access denied: "${path}" is outside the allowed directory.`,
        };
      }
    }

    // Check bash for path traversal
    if (toolName === "bash") {
      const command = args.command as string | undefined;
      if (command && hasPathTraversal(command)) {
        return {
          block: true,
          reason:
            "Access denied: command contains path traversal patterns " +
            "that escape the allowed directory.",
        };
      }
    }

    // Chain to original if one exists
    if (originalBeforeToolCall) {
      return originalBeforeToolCall(context, signal);
    }
  };
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
 * Detect path traversal patterns in bash commands.
 */
function hasPathTraversal(command: string): boolean {
  const patterns = [
    /(^|\s)\.\.(\/|\\)/,       // ../ or ..\  (with whitespace before)
    /\$\{.*\.\.[^}]*\}/,       // ${var} with ..
    /`.*\.\..*`/,               // backtick with ..
    /\$\(.*\.\..*\)/,           // $() with ..
  ];

  return patterns.some((pattern) => pattern.test(command));
}
