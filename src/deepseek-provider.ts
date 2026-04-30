import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Register DeepSeek as a custom pi provider via the OpenAI-compatible API.
 * 
 * This extension is loaded by the DefaultResourceLoader via extensionFactories
 * or can be discovered from .pi/extensions/.
 */
export default function (pi: ExtensionAPI): void {
  pi.registerProvider("deepseek", {
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "DEEPSEEK_API_KEY",
    api: "openai-completions",
    models: [
      {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        reasoning: false,
        input: ["text"],
        cost: { input: 0.3, output: 1.0, cacheRead: 0.3, cacheWrite: 0.3 },
        contextWindow: 64000,
        maxTokens: 8192,
        compat: {
          maxTokensField: "max_tokens",
          supportsDeveloperRole: false,
        },
      },
      {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        reasoning: true,
        input: ["text"],
        cost: { input: 1.0, output: 4.0, cacheRead: 1.0, cacheWrite: 1.0 },
        contextWindow: 64000,
        maxTokens: 8192,
        compat: {
          maxTokensField: "max_tokens",
          supportsDeveloperRole: false,
          thinkingFormat: "deepseek",
        },
      },
    ],
  });
}
