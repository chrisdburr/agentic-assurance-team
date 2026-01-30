import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";

export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  system_prompt: string;
  is_system: boolean;
  owner: string | null;
  allowed_tools?: string[];
}

export interface CreateAgentInput {
  name: string;
  description: string;
  model: string;
  system_prompt: string;
  owner?: string;
  allowed_tools?: string[];
}

export interface UpdateAgentInput {
  allowed_tools?: string[];
}

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
      is_system: frontmatter.system === "true",
      owner: (frontmatter.owner as string) || null,
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

  // Sort: user agents first, system agents last, then alphabetically
  return agents.sort((a, b) => {
    if (a.is_system && !b.is_system) {
      return 1;
    }
    if (!a.is_system && b.is_system) {
      return -1;
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
  if (input.owner) {
    lines.push(`owner: ${input.owner}`);
  }
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
    is_system: false,
    owner: input.owner || null,
    allowed_tools: input.allowed_tools,
  };
}

// Delete an agent by ID (only non-system agents, only by the owner)
export function deleteAgent(
  id: string,
  requestingUser: string
): { success: true } | { success: false; error: string } {
  const agent = getAgentById(id);
  if (!agent) {
    return { success: false, error: `Agent not found: ${id}` };
  }

  if (agent.is_system) {
    return { success: false, error: "System agents cannot be deleted" };
  }

  if (agent.owner !== requestingUser) {
    return {
      success: false,
      error: "Only the owner can delete this agent",
    };
  }

  const agentsDir = getAgentsDir();
  const filePath = join(agentsDir, `${id}.md`);

  try {
    unlinkSync(filePath);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Failed to delete agent file: ${message}` };
  }
}

// Update an existing agent (only non-system agents, only by the owner)
export function updateAgent(
  id: string,
  input: UpdateAgentInput,
  requestingUser: string
): Agent {
  const agent = getAgentById(id);
  if (!agent) {
    const err = new Error(`Agent not found: ${id}`);
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  if (agent.is_system) {
    const err = new Error("System agents cannot be modified");
    (err as Error & { status: number }).status = 403;
    throw err;
  }

  if (agent.owner !== requestingUser) {
    const err = new Error("Only the owner can modify this agent");
    (err as Error & { status: number }).status = 403;
    throw err;
  }

  const agentsDir = getAgentsDir();
  const filePath = join(agentsDir, `${id}.md`);
  const content = readFileSync(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(content);

  // Apply updates
  if (input.allowed_tools !== undefined) {
    if (input.allowed_tools.length > 0) {
      frontmatter.allowedTools = input.allowed_tools;
    } else {
      frontmatter.allowedTools = undefined;
    }
  }

  // Rebuild file
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("---");
  lines.push("");
  lines.push(body.trim());

  writeFileSync(filePath, lines.join("\n"), "utf-8");

  let updatedTools = agent.allowed_tools;
  if (input.allowed_tools !== undefined) {
    updatedTools =
      input.allowed_tools.length > 0 ? input.allowed_tools : undefined;
  }

  return {
    ...agent,
    allowed_tools: updatedTools,
  };
}

// Get project root directory (parent of team-server/)
function getProjectRoot(): string {
  return process.env.PROJECT_PATH || join(process.cwd(), "..");
}

// Generate a system prompt using the team-app-assistant agent via Claude CLI
export async function generateSystemPrompt(
  name: string,
  description: string,
  model: string
): Promise<string> {
  const projectRoot = getProjectRoot();

  const prompt = `Create a new agent with the following details:
- Name: ${name}
- Description: ${description}
- Model: ${model}

CRITICAL: Your response must contain ONLY the system prompt markdown body (what goes after the YAML frontmatter in an agent .md file). Do NOT include:
- Any preamble, commentary, or conversational text (e.g. "Here is...", "Perfect!", "I'll create...")
- YAML frontmatter (no --- blocks)
- Code fences or document labels
- Any text that is not part of the system prompt itself

Start your response directly with the first line of the system prompt (typically a # heading).`;

  const proc = Bun.spawn(
    [
      "claude",
      "--agent",
      "team-app-assistant",
      "-p",
      prompt,
      "--output-format",
      "text",
    ],
    {
      cwd: projectRoot,
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  // Apply 120-second timeout
  const timeout = setTimeout(() => {
    proc.kill();
  }, 120_000);

  try {
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      throw new Error(
        `Claude CLI exited with code ${exitCode}: ${stderr.slice(0, 500)}`
      );
    }

    let result = stdout.trim();
    if (!result) {
      throw new Error("Claude CLI returned empty output");
    }

    // Strip any conversational preamble before the actual system prompt.
    // The system prompt should start with a markdown heading (#).
    const headingIndex = result.indexOf("\n#");
    if (headingIndex > 0 && !result.startsWith("#")) {
      result = result.slice(headingIndex + 1);
    }

    return result;
  } finally {
    clearTimeout(timeout);
  }
}
