import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

export interface ResolvedPreset {
  id: string;
  description: string;
  model: string;
  dispatchable: boolean;
  tools: string[];
  tool_groups: string[];
}

interface ToolGroup {
  description?: string;
  tools?: string[];
  includes?: string[];
}

interface PresetDef {
  description: string;
  model: string;
  dispatchable: boolean;
  includes: string[];
  additional_tools?: string[];
}

interface PresetsFile {
  tool_groups: Record<string, ToolGroup>;
  presets: Record<string, PresetDef>;
}

function getPresetsPath(): string {
  const projectRoot = process.env.PROJECT_PATH || join(process.cwd(), "..");
  return join(
    projectRoot,
    ".claude",
    "skills",
    "agent-creation",
    "presets.yaml"
  );
}

/**
 * Recursively resolve a tool group into a flat list of tool strings.
 * Handles groups that reference other groups via `includes`.
 */
function resolveGroup(
  groupName: string,
  groups: Record<string, ToolGroup>,
  visited: Set<string> = new Set()
): string[] {
  if (visited.has(groupName)) {
    return [];
  }
  visited.add(groupName);

  const group = groups[groupName];
  if (!group) {
    return [];
  }

  const tools: string[] = [];

  if (group.includes) {
    for (const ref of group.includes) {
      tools.push(...resolveGroup(ref, groups, visited));
    }
  }

  if (group.tools) {
    tools.push(...group.tools);
  }

  return tools;
}

/**
 * Read presets.yaml and return all presets with resolved tool lists.
 */
export function getResolvedPresets(): ResolvedPreset[] {
  const content = readFileSync(getPresetsPath(), "utf-8");
  const data = yaml.load(content) as PresetsFile;

  const results: ResolvedPreset[] = [];

  for (const [id, preset] of Object.entries(data.presets)) {
    const tools: string[] = [];

    for (const groupName of preset.includes) {
      tools.push(...resolveGroup(groupName, data.tool_groups));
    }

    if (preset.additional_tools) {
      tools.push(...preset.additional_tools);
    }

    // Deduplicate while preserving order
    const seen = new Set<string>();
    const deduped = tools.filter((t) => {
      if (seen.has(t)) {
        return false;
      }
      seen.add(t);
      return true;
    });

    results.push({
      id,
      description: preset.description,
      model: preset.model,
      dispatchable: preset.dispatchable,
      tools: deduped,
      tool_groups: preset.includes,
    });
  }

  return results;
}
