import { describe, it, expect, vi } from "vitest";
import { resolve } from "node:path";
import { applySandbox } from "./sandbox.js";

function createMockSession() {
  let beforeToolCall: ((ctx: any, signal?: any) => any) | undefined;
  const agent = {
    get beforeToolCall() {
      return beforeToolCall;
    },
    set beforeToolCall(fn: any) {
      beforeToolCall = fn;
    },
  };
  const session = {
    agent,
    subscribe: vi.fn(),
  };
  return { session, agent, get beforeToolCall() { return beforeToolCall; } };
}

describe("applySandbox", () => {
  const projectRoot = "/home/user/project";

  it("should set beforeToolCall on the agent", () => {
    const { session, agent } = createMockSession();
    applySandbox(session as any, projectRoot);

    expect(agent.beforeToolCall).toBeInstanceOf(Function);
  });

  it("should allow read within allowed directory", async () => {
    const { session } = createMockSession();
    applySandbox(session as any, projectRoot);

    const result = await session.agent.beforeToolCall({
      toolCall: { name: "read" },
      args: { path: resolve(projectRoot, "src/main.ts") },
    } as any);

    expect(result).toBeUndefined();
  });

  it("should block read outside allowed directory", async () => {
    const { session } = createMockSession();
    applySandbox(session as any, projectRoot);

    const result = await session.agent.beforeToolCall({
      toolCall: { name: "read" },
      args: { path: "/etc/passwd" },
    } as any);

    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining("Access denied"),
    });
  });

  it("should allow write within allowed directory", async () => {
    const { session } = createMockSession();
    applySandbox(session as any, projectRoot);

    const result = await session.agent.beforeToolCall({
      toolCall: { name: "write" },
      args: { path: resolve(projectRoot, "output.txt") },
    } as any);

    expect(result).toBeUndefined();
  });

  it("should block write outside allowed directory", async () => {
    const { session } = createMockSession();
    applySandbox(session as any, projectRoot);

    const result = await session.agent.beforeToolCall({
      toolCall: { name: "write" },
      args: { path: "/tmp/evil.sh" },
    } as any);

    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining("Access denied"),
    });
  });

  it("should allow edit within allowed directory", async () => {
    const { session } = createMockSession();
    applySandbox(session as any, projectRoot);

    const result = await session.agent.beforeToolCall({
      toolCall: { name: "edit" },
      args: { path: resolve(projectRoot, "README.md") },
    } as any);

    expect(result).toBeUndefined();
  });

  it("should block edit outside allowed directory", async () => {
    const { session } = createMockSession();
    applySandbox(session as any, projectRoot);

    const result = await session.agent.beforeToolCall({
      toolCall: { name: "edit" },
      args: { path: "/root/.ssh/authorized_keys" },
    } as any);

    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining("Access denied"),
    });
  });

  it("should block bash with ../ path traversal", async () => {
    const { session } = createMockSession();
    applySandbox(session as any, projectRoot);

    const result = await session.agent.beforeToolCall({
      toolCall: { name: "bash" },
      args: { command: "cat ../secrets.txt" },
    } as any);

    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining("path traversal"),
    });
  });

  it("should allow bash with safe commands", async () => {
    const { session } = createMockSession();
    applySandbox(session as any, projectRoot);

    const result = await session.agent.beforeToolCall({
      toolCall: { name: "bash" },
      args: { command: "ls -la src/" },
    } as any);

    expect(result).toBeUndefined();
  });

  it("should block bash with double-dot in subshell", async () => {
    const { session } = createMockSession();
    applySandbox(session as any, projectRoot);

    const result = await session.agent.beforeToolCall({
      toolCall: { name: "bash" },
      args: { command: "echo $(cat ../../.env)" },
    } as any);

    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining("path traversal"),
    });
  });

  it("should pass through tools that are not path-based", async () => {
    const { session } = createMockSession();
    applySandbox(session as any, projectRoot);

    const result = await session.agent.beforeToolCall({
      toolCall: { name: "some_other_tool" },
      args: { whatever: "value" },
    } as any);

    expect(result).toBeUndefined();
  });

  it("should chain to original beforeToolCall if one existed", async () => {
    const { session, agent } = createMockSession();
    const original = vi.fn(async () => ({ block: false }));
    agent.beforeToolCall = original;

    applySandbox(session as any, projectRoot);

    // This should pass through sandbox and call original
    const result = await session.agent.beforeToolCall({
      toolCall: { name: "some_other_tool" },
      args: {},
    } as any);

    expect(result).toEqual({ block: false });
    expect(original).toHaveBeenCalledTimes(1);
  });

  it("should block if path uses symlink to escape", async () => {
    const { session } = createMockSession();
    applySandbox(session as any, projectRoot);

    const result = await session.agent.beforeToolCall({
      toolCall: { name: "read" },
      args: { path: "/home/user/project/../../etc/passwd" },
    } as any);

    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining("Access denied"),
    });
  });

  it("should allow paths exactly at the project root", async () => {
    const { session } = createMockSession();
    applySandbox(session as any, projectRoot);

    const result = await session.agent.beforeToolCall({
      toolCall: { name: "read" },
      args: { path: projectRoot },
    } as any);

    expect(result).toBeUndefined();
  });

  it("should support custom allowed directories", async () => {
    const { session } = createMockSession();
    applySandbox(session as any, projectRoot, {
      allowedDirs: ["/tmp/work"],
    });

    const result = await session.agent.beforeToolCall({
      toolCall: { name: "read" },
      args: { path: "/tmp/work/output.log" },
    } as any);

    expect(result).toBeUndefined();
  });

  it("should not allow files outside custom allowed directories", async () => {
    const { session } = createMockSession();
    applySandbox(session as any, projectRoot, {
      allowedDirs: ["/tmp/work"],
    });

    const result = await session.agent.beforeToolCall({
      toolCall: { name: "read" },
      args: { path: resolve(projectRoot, "secrets.txt") },
    } as any);

    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining("Access denied"),
    });
  });
});
