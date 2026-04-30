import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the pi SDK modules before importing engine
const { mockSetRuntimeApiKey, mockRegisterProvider, mockFind, mockDispose, mockPrompt, mockSetModel } = vi.hoisted(() => ({
  mockSetRuntimeApiKey: vi.fn(),
  mockRegisterProvider: vi.fn(),
  mockFind: vi.fn(),
  mockDispose: vi.fn(),
  mockPrompt: vi.fn(),
  mockSetModel: vi.fn(),
}));

const mockSession = vi.hoisted(() => ({
  prompt: mockPrompt,
  dispose: mockDispose,
  setModel: mockSetModel,
  agent: {
    state: {
      tools: [] as Array<{ name: string; execute: () => void; label?: string; description?: string; parameters?: unknown }>,
      systemPrompt: "",
    },
  },
}));

vi.mock("@mariozechner/pi-coding-agent", () => ({
  AuthStorage: {
    create: vi.fn(() => ({
      setRuntimeApiKey: mockSetRuntimeApiKey,
    })),
  },
  ModelRegistry: {
    create: vi.fn(() => ({
      registerProvider: mockRegisterProvider,
      find: mockFind,
    })),
  },
  createAgentSession: vi.fn(() =>
    Promise.resolve({
      session: mockSession,
      modelFallbackMessage: undefined,
    })
  ),
  SessionManager: {
    create: vi.fn(() => ({})),
    open: vi.fn(() => ({})),
  },
  DefaultResourceLoader: class {
    constructor(_opts: any) {}
    reload = vi.fn(() => Promise.resolve());
  },
}));

vi.mock("dotenv", () => ({
  config: vi.fn(),
}));

vi.mock("./loader.js", () => ({
  loadAll: vi.fn(() =>
    Promise.resolve({
      tools: [],
      skills: "",
      skillsMap: {},
      errors: [],
    })
  ),
}));

import { BaikalEngine, type LoggedMessage } from "./engine.js";
import { MAX_MESSAGE_LOG } from "./config.js";

describe("BaikalEngine", () => {
  let engine: BaikalEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEEPSEEK_API_KEY = "sk-test-key-12345";
  });

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
  });

  describe("constructor", () => {
    it("should initialize with default values", () => {
      engine = new BaikalEngine();

      expect(engine.currentModelId).toBe("deepseek/deepseek-v4-flash");
      expect(engine.messageLog).toEqual([]);
      expect(engine.customTools).toEqual([]);
      expect(engine.skills).toBe("");
    });

    it("should set sessionFile to project's session.jsonl", () => {
      engine = new BaikalEngine();
      expect(engine.sessionFile).toContain("session.jsonl");
    });
  });

  describe("init", () => {
    it("should throw if DEEPSEEK_API_KEY is not set", async () => {
      delete process.env.DEEPSEEK_API_KEY;
      engine = new BaikalEngine();

      await expect(engine.init()).rejects.toThrow(
        "DEEPSEEK_API_KEY environment variable is required"
      );
    });

    it("should set runtime API key on auth storage and register provider", async () => {
      mockFind.mockReturnValue({ id: "deepseek-v4-flash", provider: "deepseek" });
      engine = new BaikalEngine();
      await engine.init();

      expect(mockSetRuntimeApiKey).toHaveBeenCalledWith("deepseek", "sk-test-key-12345");
      expect(mockRegisterProvider).toHaveBeenCalledWith("deepseek", expect.objectContaining({
        baseUrl: "https://api.deepseek.com/v1",
      }));
    });
  });

  describe("logMessage", () => {
    beforeEach(() => {
      engine = new BaikalEngine();
    });

    it("should add a message to the log", () => {
      engine.logMessage("@alice", "hello world");
      expect(engine.messageLog).toHaveLength(1);
      expect(engine.messageLog[0].from).toBe("@alice");
      expect(engine.messageLog[0].text).toBe("hello world");
      expect(engine.messageLog[0].timestamp).toBeGreaterThan(0);
    });

    it("should trim log when it exceeds 2x MAX_MESSAGE_LOG", () => {
      const count = MAX_MESSAGE_LOG * 2 + 10;
      for (let i = 0; i < count; i++) {
        engine.logMessage("@user", `message ${i}`);
      }

      expect(engine.messageLog.length).toBe(MAX_MESSAGE_LOG + (count - MAX_MESSAGE_LOG * 2 - 1));
    });

    it("should keep the most recent messages after trimming", () => {
      for (let i = 0; i < MAX_MESSAGE_LOG * 2 + 5; i++) {
        engine.logMessage("@user", `message ${i}`);
      }

      const lastMsg = engine.messageLog[engine.messageLog.length - 1];
      expect(lastMsg.text).toBe(`message ${MAX_MESSAGE_LOG * 2 + 4}`);
    });
  });

  describe("getRecentMessagesBlock", () => {
    beforeEach(() => {
      engine = new BaikalEngine();
    });

    it("should return empty string when log is empty", () => {
      expect(engine.getRecentMessagesBlock()).toBe("");
    });

    it("should format messages with timestamps", () => {
      engine.logMessage("@alice", "hello");
      const block = engine.getRecentMessagesBlock();

      expect(block).toContain("--- Recent messages (newest first) ---");
      expect(block).toContain("@alice: hello");
      expect(block).toContain("---");
    });

    it("should include up to MAX_MESSAGE_LOG messages", () => {
      for (let i = 0; i < 600; i++) {
        engine.logMessage("@user", `msg ${i}`);
      }

      const block = engine.getRecentMessagesBlock();
      const lines = block.split("\n").filter((l) => l.includes("@user:"));
      expect(lines.length).toBe(MAX_MESSAGE_LOG);
    });

    it("should format two messages in the block", () => {
      engine.logMessage("@alice", "first");
      engine.logMessage("@bob", "second");

      const block = engine.getRecentMessagesBlock();
      const lines = block.split("\n").filter((l) => l.includes(":"));
      expect(lines.length).toBe(2);
    });
  });

  describe("getCurrentModelName", () => {
    beforeEach(() => {
      engine = new BaikalEngine();
    });

    it("should return the default model name without provider prefix", () => {
      expect(engine.getCurrentModelName()).toBe("deepseek-v4-flash");
    });

    it("should reflect model changes", () => {
      engine.currentModelId = "deepseek/deepseek-v4-pro";
      expect(engine.getCurrentModelName()).toBe("deepseek-v4-pro");
    });
  });

  describe("getAvailableModels", () => {
    beforeEach(() => {
      engine = new BaikalEngine();
    });

    it("should return both flash and pro models", () => {
      const models = engine.getAvailableModels();
      expect(models).toEqual(["deepseek-v4-flash", "deepseek-v4-pro"]);
    });
  });

  describe("reloadToolsAndSkills", () => {
    beforeEach(() => {
      engine = new BaikalEngine();
      engine.session = mockSession as any;
      engine.session.agent.state.tools = [
        { name: "read", execute: vi.fn(), label: "Read", description: "Read files", parameters: {} },
        { name: "bash", execute: vi.fn(), label: "Bash", description: "Run commands", parameters: {} },
      ] as any;
    });

    it("should return success message with zero tools and skills", async () => {
      const msg = await engine.reloadToolsAndSkills();
      expect(msg).toContain("Tools and skills reloaded");
      expect(msg).toContain("0 tool(s)");
      expect(msg).toContain("0 skill(s)");
    });

    it("should preserve built-in tools and add custom tools", async () => {
      const loader = await import("./loader.js");
      (loader.loadAll as any).mockResolvedValueOnce({
        tools: [
          { name: "my_custom_tool", execute: vi.fn(), label: "My Tool", description: "Test", parameters: {} },
        ],
        skills: "",
        skillsMap: {},
        errors: [],
      });

      await engine.reloadToolsAndSkills();

      const toolNames = engine.session.agent.state.tools.map((t: any) => t.name);
      expect(toolNames).toContain("read");
      expect(toolNames).toContain("bash");
      expect(toolNames).toContain("my_custom_tool");
    });

    it("should include warnings in the response when there are loading errors", async () => {
      const loader = await import("./loader.js");
      (loader.loadAll as any).mockResolvedValueOnce({
        tools: [],
        skills: "",
        skillsMap: {},
        errors: ["tools/bad-tool.ts: SyntaxError"],
      });

      const msg = await engine.reloadToolsAndSkills();
      expect(msg).toContain("Warnings");
      expect(msg).toContain("SyntaxError");
    });

    it("should update the system prompt with new skills", async () => {
      const loader = await import("./loader.js");
      (loader.loadAll as any).mockResolvedValueOnce({
        tools: [],
        skills: "# Meal Planning\n\nSuggest balanced options.",
        skillsMap: { "meal-planning.md": "# Meal Planning\n\nSuggest balanced options." },
        errors: [],
      });

      await engine.reloadToolsAndSkills();
      expect(engine.session.agent.state.systemPrompt).toContain("Meal Planning");
    });
  });

  describe("switchModel", () => {
    beforeEach(() => {
      engine = new BaikalEngine();
      engine.session = mockSession as any;
    });

    it("should return error for invalid model name", async () => {
      const msg = await engine.switchModel("nonexistent-model");
      expect(msg).toContain("Invalid model");
    });

    it("should return error if model not found in registry", async () => {
      mockFind.mockReturnValue(null);
      const msg = await engine.switchModel("deepseek-v4-flash");
      expect(msg).toContain("not found in registry");
    });

    it("should switch to pro model successfully", async () => {
      const proModel = { id: "deepseek-v4-pro", provider: "deepseek", name: "DeepSeek V4 Pro" };
      mockFind.mockReturnValue(proModel);

      const msg = await engine.switchModel("deepseek-v4-pro");
      expect(msg).toBe("Model switched to deepseek-v4-pro.");
      expect(engine.currentModelId).toBe("deepseek/deepseek-v4-pro");
    });

    it("should switch to flash model from pro", async () => {
      const flashModel = { id: "deepseek-v4-flash", provider: "deepseek", name: "DeepSeek V4 Flash" };
      engine.currentModelId = "deepseek/deepseek-v4-pro";
      mockFind.mockReturnValue(flashModel);

      const msg = await engine.switchModel("deepseek-v4-flash");
      expect(msg).toBe("Model switched to deepseek-v4-flash.");
      expect(engine.currentModelId).toBe("deepseek/deepseek-v4-flash");
    });

    it("should strip deepseek/ prefix from model name", async () => {
      const flashModel = { id: "deepseek-v4-flash", provider: "deepseek" };
      mockFind.mockReturnValue(flashModel);

      const msg = await engine.switchModel("deepseek/deepseek-v4-flash");
      expect(msg).toBe("Model switched to deepseek-v4-flash.");
    });

    it("should call session.setModel with the new model", async () => {
      const proModel = { id: "deepseek-v4-pro" };
      mockFind.mockReturnValue(proModel);

      await engine.switchModel("deepseek-v4-pro");
      expect(mockSetModel).toHaveBeenCalledWith(proModel);
    });
  });

  describe("LoggedMessage interface", () => {
    it("should have the correct shape", () => {
      const msg: LoggedMessage = {
        from: "@user",
        text: "hello",
        timestamp: 1234567890,
      };
      expect(msg.from).toBe("@user");
      expect(msg.text).toBe("hello");
      expect(msg.timestamp).toBe(1234567890);
    });
  });
});
