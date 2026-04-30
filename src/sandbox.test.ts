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
  return { session, agent };
}

describe("applySandbox", () => {
  const projectRoot = "/home/user/project";

  it("should set beforeToolCall on the agent", () => {
    const { session, agent } = createMockSession();
    applySandbox(session as any, projectRoot);
    expect(agent.beforeToolCall).toBeInstanceOf(Function);
  });

  describe("read / write / edit", () => {
    it("should allow paths within the project directory", async () => {
      const { session } = createMockSession();
      applySandbox(session as any, projectRoot);

      for (const tool of ["read", "write", "edit"]) {
        const result = await session.agent.beforeToolCall({
          toolCall: { name: tool },
          args: { path: resolve(projectRoot, "src/main.ts") },
        } as any);
        expect(result).toBeUndefined();
      }
    });

    it("should block paths outside the project directory", async () => {
      const { session } = createMockSession();
      applySandbox(session as any, projectRoot);

      for (const tool of ["read", "write", "edit"]) {
        const result = await session.agent.beforeToolCall({
          toolCall: { name: tool },
          args: { path: "/etc/passwd" },
        } as any);
        expect(result).toEqual({
          block: true,
          reason: expect.stringContaining("Access denied"),
        });
      }
    });

    it("should block tilde paths", async () => {
      const { session } = createMockSession();
      applySandbox(session as any, projectRoot);

      for (const tool of ["read", "write", "edit"]) {
        const result = await session.agent.beforeToolCall({
          toolCall: { name: tool },
          args: { path: "~/Documents/file.txt" },
        } as any);
        expect(result).toEqual({
          block: true,
          reason: expect.stringContaining("tilde expansion"),
        });
      }
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

    it("should block symlink escape paths", async () => {
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
  });

  describe("bash", () => {
    it("should allow safe commands within the project", async () => {
      const { session } = createMockSession();
      applySandbox(session as any, projectRoot);

      const result = await session.agent.beforeToolCall({
        toolCall: { name: "bash" },
        args: { command: "ls -la src/" },
      } as any);

      expect(result).toBeUndefined();
    });

    it("should block ls ~/Documents", async () => {
      const { session } = createMockSession();
      applySandbox(session as any, projectRoot);

      const result = await session.agent.beforeToolCall({
        toolCall: { name: "bash" },
        args: { command: "ls ~/Documents" },
      } as any);

      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("Access denied"),
      });
    });

    it("should block cat /etc/passwd", async () => {
      const { session } = createMockSession();
      applySandbox(session as any, projectRoot);

      const result = await session.agent.beforeToolCall({
        toolCall: { name: "bash" },
        args: { command: "cat /etc/passwd" },
      } as any);

      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("Access denied"),
      });
    });

    it("should block ls /home/user/Documents", async () => {
      const { session } = createMockSession();
      applySandbox(session as any, projectRoot);

      const result = await session.agent.beforeToolCall({
        toolCall: { name: "bash" },
        args: { command: "ls /home/user/Documents" },
      } as any);

      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("Access denied"),
      });
    });

    it("should block cd to a directory outside the project", async () => {
      const { session } = createMockSession();
      applySandbox(session as any, projectRoot);

      const result = await session.agent.beforeToolCall({
        toolCall: { name: "bash" },
        args: { command: "cd /etc && ls" },
      } as any);

      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("Access denied"),
      });
    });

    it("should allow cd with no args", async () => {
      const { session } = createMockSession();
      applySandbox(session as any, projectRoot);

      const result = await session.agent.beforeToolCall({
        toolCall: { name: "bash" },
        args: { command: "cd" },
      } as any);

      expect(result).toBeUndefined();
    });

    it("should allow cd with relative path within project", async () => {
      const { session } = createMockSession();
      applySandbox(session as any, projectRoot);

      const result = await session.agent.beforeToolCall({
        toolCall: { name: "bash" },
        args: { command: "cd src && ls" },
      } as any);

      expect(result).toBeUndefined();
    });

    it("should allow /dev/null references", async () => {
      const { session } = createMockSession();
      applySandbox(session as any, projectRoot);

      const result = await session.agent.beforeToolCall({
        toolCall: { name: "bash" },
        args: { command: "ls 2>/dev/null" },
      } as any);

      expect(result).toBeUndefined();
    });

    it("should allow /tmp references", async () => {
      const { session } = createMockSession();
      applySandbox(session as any, projectRoot);

      const result = await session.agent.beforeToolCall({
        toolCall: { name: "bash" },
        args: { command: "cat /tmp/test.txt" },
      } as any);

      expect(result).toBeUndefined();
    });

    it("should allow project-relative paths in bash", async () => {
      const { session } = createMockSession();
      applySandbox(session as any, "/home/user/project");

      const result = await session.agent.beforeToolCall({
        toolCall: { name: "bash" },
        args: { command: "cat /home/user/project/src/index.ts" },
      } as any);

      expect(result).toBeUndefined();
    });

    it("should pass through non-path-based tools", async () => {
      const { session } = createMockSession();
      applySandbox(session as any, projectRoot);

      const result = await session.agent.beforeToolCall({
        toolCall: { name: "some_other_tool" },
        args: { whatever: "value" },
      } as any);

      expect(result).toBeUndefined();
    });
  });

  describe("chaining", () => {
    it("should chain to original beforeToolCall if one existed", async () => {
      const { session, agent } = createMockSession();
      const original = vi.fn(async () => ({ block: false }));
      agent.beforeToolCall = original;

      applySandbox(session as any, projectRoot);

      const result = await session.agent.beforeToolCall({
        toolCall: { name: "some_other_tool" },
        args: {},
      } as any);

      expect(result).toEqual({ block: false });
      expect(original).toHaveBeenCalledTimes(1);
    });
  });

  describe("custom allowed directories", () => {
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

    it("should block paths outside custom allowed directories", async () => {
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
});
