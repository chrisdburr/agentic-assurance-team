import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";

export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  system_prompt: string;
  is_team_agent: boolean;
  allowed_tools?: string[];
}

export interface CreateAgentInput {
  name: string;
  description: string;
  model: string;
  system_prompt: string;
  allowed_tools?: string[];
}

// Team agents defined in .claude/agents (alice, bob, charlie)
const TEAM_AGENTS = new Set(["alice", "bob", "charlie"]);

// Top-level regex patterns for performance
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const ARRAY_ITEM_REGEX = /^\s+-\s+/;
const KEY_VALUE_REGEX = /^(\w+):\s*(.*)$/;
const AGENT_NAME_REGEX = /^[a-z][a-z0-9-]*$/;

// Get project root - agents are stored in PROJECT_PATH/.claude/agents/
// When running from team-server/, cwd is team-server so we go up one level
function getAgentsDir(): string {
  if (process.env.PROJECT_PATH) {
    return join(process.env.PROJECT_PATH, ".claude", "agents");
  }
  // Default: assume we're in team-server/ subdirectory, go up to project root
  return join(process.cwd(), "..", ".claude", "agents");
}

// Parse YAML frontmatter from markdown file content
function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const [, yamlContent, body] = match;
  const frontmatter: Record<string, unknown> = {};

  // Simple YAML parser for the frontmatter we need
  const lines = yamlContent.split("\n");
  let currentKey = "";
  let inArray = false;
  let arrayValues: string[] = [];

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) {
      continue;
    }

    // Check for array item
    if (ARRAY_ITEM_REGEX.test(line)) {
      const value = line.replace(ARRAY_ITEM_REGEX, "").trim();
      arrayValues.push(value);
      continue;
    }

    // If we were collecting array values, save them
    if (inArray && currentKey) {
      frontmatter[currentKey] = arrayValues;
      inArray = false;
      arrayValues = [];
    }

    // Check for key: value
    const keyMatch = line.match(KEY_VALUE_REGEX);
    if (keyMatch) {
      const [, key, value] = keyMatch;
      currentKey = key;
      if (value.trim()) {
        frontmatter[key] = value.trim();
      } else {
        // Value will be on next lines (array)
        inArray = true;
        arrayValues = [];
      }
    }
  }

  // Handle trailing array
  if (inArray && currentKey) {
    frontmatter[currentKey] = arrayValues;
  }

  return { frontmatter, body };
}

// Parse a single agent file
function parseAgentFile(filePath: string): Agent | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    const { frontmatter, body } = parseFrontmatter(content);

    const filename = basename(filePath, ".md");
    const name = (frontmatter.name as string) || filename;

    return {
      id: filename,
      name,
      description: (frontmatter.description as string) || "",
      model: (frontmatter.model as string) || "sonnet",
      system_prompt: body.trim(),
      is_team_agent: TEAM_AGENTS.has(filename),
      allowed_tools: frontmatter.allowedTools as string[] | undefined,
    };
  } catch (error) {
    console.error(`Failed to parse agent file ${filePath}:`, error);
    return null;
  }
}

// List all agents in the .claude/agents directory
export function listAgents(): Agent[] {
  const agentsDir = getAgentsDir();

  // Create directory if it doesn't exist
  if (!existsSync(agentsDir)) {
    mkdirSync(agentsDir, { recursive: true });
    return [];
  }

  const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
  const agents: Agent[] = [];

  for (const file of files) {
    const agent = parseAgentFile(join(agentsDir, file));
    if (agent) {
      agents.push(agent);
    }
  }

  // Sort: team agents first, then alphabetically
  return agents.sort((a, b) => {
    if (a.is_team_agent && !b.is_team_agent) {
      return -1;
    }
    if (!a.is_team_agent && b.is_team_agent) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
}

// Get a single agent by ID
export function getAgentById(id: string): Agent | null {
  const agentsDir = getAgentsDir();
  const filePath = join(agentsDir, `${id}.md`);

  if (!existsSync(filePath)) {
    return null;
  }

  return parseAgentFile(filePath);
}

// Validate agent name for creating new agents
export function validateAgentName(
  name: string
): { valid: true } | { valid: false; error: string } {
  // Check format: lowercase letters, numbers, and hyphens
  if (!AGENT_NAME_REGEX.test(name)) {
    return {
      valid: false,
      error:
        "Name must start with a letter and contain only lowercase letters, numbers, and hyphens",
    };
  }

  // Check length
  if (name.length < 2 || name.length > 50) {
    return {
      valid: false,
      error: "Name must be between 2 and 50 characters",
    };
  }

  // Check for existing agent
  const existing = getAgentById(name);
  if (existing) {
    return {
      valid: false,
      error: `An agent with the name "${name}" already exists`,
    };
  }

  return { valid: true };
}

// Create a new agent
export function createAgent(input: CreateAgentInput): Agent {
  const validation = validateAgentName(input.name);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const agentsDir = getAgentsDir();

  // Ensure directory exists
  if (!existsSync(agentsDir)) {
    mkdirSync(agentsDir, { recursive: true });
  }

  // Build the markdown content with YAML frontmatter
  const lines: string[] = ["---"];
  lines.push(`name: ${input.name}`);
  lines.push(`description: ${input.description}`);
  lines.push(`model: ${input.model}`);
  lines.push("permissionMode: dontAsk");

  // Add allowed tools if provided
  if (input.allowed_tools && input.allowed_tools.length > 0) {
    lines.push("allowedTools:");
    for (const tool of input.allowed_tools) {
      lines.push(`  - ${tool}`);
    }
  }

  lines.push("---");
  lines.push("");
  lines.push(input.system_prompt);

  const content = lines.join("\n");
  const filePath = join(agentsDir, `${input.name}.md`);

  writeFileSync(filePath, content, "utf-8");

  return {
    id: input.name,
    name: input.name,
    description: input.description,
    model: input.model,
    system_prompt: input.system_prompt,
    is_team_agent: false,
    allowed_tools: input.allowed_tools,
  };
}
