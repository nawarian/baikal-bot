import { describe, it, expect, vi } from "vitest";
import deepseekExtension from "./deepseek-provider.js";

describe("deepseek-provider", () => {
  it("should export a default function", () => {
    expect(deepseekExtension).toBeInstanceOf(Function);
  });

  it("should register the deepseek provider with two models", () => {
    const registerProvider = vi.fn();
    const pi = { registerProvider } as any;

    deepseekExtension(pi);

    expect(registerProvider).toHaveBeenCalledTimes(1);
    expect(registerProvider).toHaveBeenCalledWith("deepseek", expect.any(Object));

    const config = registerProvider.mock.calls[0][1];
    expect(config.baseUrl).toBe("https://api.deepseek.com/v1");
    expect(config.apiKey).toBe("DEEPSEEK_API_KEY");
    expect(config.api).toBe("openai-completions");
    expect(config.models).toHaveLength(2);
  });

  it("should register deepseek-v4-flash as first model", () => {
    const registerProvider = vi.fn();
    const pi = { registerProvider } as any;

    deepseekExtension(pi);

    const config = registerProvider.mock.calls[0][1];
    const flashModel = config.models[0];

    expect(flashModel.id).toBe("deepseek-v4-flash");
    expect(flashModel.name).toBe("DeepSeek V4 Flash");
    expect(flashModel.reasoning).toBe(false);
    expect(flashModel.input).toEqual(["text"]);
    expect(flashModel.cost.input).toBe(0.3);
    expect(flashModel.cost.output).toBe(1.0);
    expect(flashModel.contextWindow).toBe(64000);
    expect(flashModel.maxTokens).toBe(8192);
  });

  it("should register deepseek-v4-pro as second model with thinking enabled", () => {
    const registerProvider = vi.fn();
    const pi = { registerProvider } as any;

    deepseekExtension(pi);

    const config = registerProvider.mock.calls[0][1];
    const proModel = config.models[1];

    expect(proModel.id).toBe("deepseek-v4-pro");
    expect(proModel.name).toBe("DeepSeek V4 Pro");
    expect(proModel.reasoning).toBe(true);
    expect(proModel.input).toEqual(["text"]);
    expect(proModel.cost.input).toBe(1.0);
    expect(proModel.cost.output).toBe(4.0);
    expect(proModel.contextWindow).toBe(64000);
    expect(proModel.maxTokens).toBe(8192);
    expect(proModel.compat.thinkingFormat).toBe("deepseek");
  });

  it("should configure flash model compat without thinking", () => {
    const registerProvider = vi.fn();
    const pi = { registerProvider } as any;

    deepseekExtension(pi);

    const config = registerProvider.mock.calls[0][1];
    const flashModel = config.models[0];

    expect(flashModel.compat.maxTokensField).toBe("max_tokens");
    expect(flashModel.compat.supportsDeveloperRole).toBe(false);
    expect(flashModel.compat.thinkingFormat).toBeUndefined();
  });

  it("should configure pro model compat with deepseek thinking", () => {
    const registerProvider = vi.fn();
    const pi = { registerProvider } as any;

    deepseekExtension(pi);

    const config = registerProvider.mock.calls[0][1];
    const proModel = config.models[1];

    expect(proModel.compat.maxTokensField).toBe("max_tokens");
    expect(proModel.compat.supportsDeveloperRole).toBe(false);
    expect(proModel.compat.thinkingFormat).toBe("deepseek");
  });
});
