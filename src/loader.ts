import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Tool } from "@mariozechner/pi-coding-agent";
import { defineTool } from "@mariozechner/pi-coding-agent";

/**
 * Result of loading tools and skills from the local directories.
 */
export interface LoaderResult {
  /** Custom tool definitions discovered in tools/ */
  tools: Tool[];
  /** Combined skill text from skills/ */
  skills: string;
  /** Individual skill contents keyed by filename */
  skillsMap: Record<string, string>;
  /** Any errors encountered during loading */
  errors: string[];
}

const ROOT_DIR = resolve(import.meta.dirname ?? __dirname, "..");

/**
 * Scan the `tools/` directory and import each `.ts` (or `.js`) file,
 * collecting their default exports as tool definitions.
 */
export async function loadTools(): Promise<{ tools: Tool[]; errors: string[] }> {
  const toolsDir = join(ROOT_DIR, "tools");
  const errors: string[] = [];
  const tools: Tool[] = [];

  if (!existsSync(toolsDir)) {
    return { tools, errors };
  }

  const entries = readdirSync(toolsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".js")) continue;
    if (entry.name.startsWith(".")) continue;

    const filePath = join(toolsDir, entry.name);
    try {
      const mod = await import(pathToFileURL(filePath).href);

      if (mod.default && typeof mod.default === "object" && "name" in mod.default) {
        // Already a Tool object (from defineTool())
        tools.push(mod.default as Tool);
      } else if (typeof mod.default === "function") {
        // It's a factory or defineTool call — try calling it or use the return
        const result = mod.default();
        if (result && typeof result === "object" && "name" in result) {
          tools.push(result as Tool);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`tools/${entry.name}: ${message}`);
    }
  }

  return { tools, errors };
}

/**
 * Scan the `skills/` directory and read all `.md` files,
 * returning their content as a combined string and a map keyed by filename.
 */
export function loadSkills(): { combined: string; skillsMap: Record<string, string>; errors: string[] } {
  const skillsDir = join(ROOT_DIR, "skills");
  const errors: string[] = [];
  const skillsMap: Record<string, string> = {};

  if (!existsSync(skillsDir)) {
    return { combined: "", skillsMap, errors };
  }

  const entries = readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (!entry.name.endsWith(".md")) continue;
    if (entry.name.startsWith(".")) continue;

    const filePath = join(skillsDir, entry.name);
    try {
      const content = readFileSync(filePath, "utf-8");
      skillsMap[entry.name] = content;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`skills/${entry.name}: ${message}`);
    }
  }

  const combined = Object.values(skillsMap).join("\n\n").trim();

  return { combined, skillsMap, errors };
}

/**
 * Load all tools and skills.
 */
export async function loadAll(): Promise<LoaderResult> {
  const { tools, errors: toolErrors } = await loadTools();
  const { combined: skills, skillsMap, errors: skillErrors } = loadSkills();

  return {
    tools,
    skills,
    skillsMap,
    errors: [...toolErrors, ...skillErrors],
  };
}

export { defineTool };
