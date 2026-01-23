import { spawn } from "bun";
import { nanoid } from "nanoid";
import { postStandup, getTodayStandups } from "./db.js";

export interface StandupSession {
  id: string;
  date: string;
  agents: string[];
  updates: AgentUpdate[];
  status: "pending" | "in_progress" | "completed" | "cancelled";
  startedAt: string;
  completedAt?: string;
}

export interface AgentUpdate {
  agentId: string;
  content: string;
  timestamp: string;
}

// Active sessions (in-memory for now)
const activeSessions = new Map<string, StandupSession>();

// Agent order for standups
const STANDUP_ORDER = ["alice", "bob", "charlie"];

// Broadcast function (will be set by index.ts)
let broadcastFn: ((event: string, data: unknown) => void) | null = null;

export function setBroadcast(fn: (event: string, data: unknown) => void) {
  broadcastFn = fn;
}

function broadcast(event: string, data: unknown) {
  if (broadcastFn) {
    broadcastFn(event, data);
  }
}

/**
 * Start a new standup session
 */
export async function startStandupSession(): Promise<StandupSession> {
  const sessionId = nanoid(10);
  const session: StandupSession = {
    id: sessionId,
    date: new Date().toISOString().split("T")[0],
    agents: STANDUP_ORDER,
    updates: [],
    status: "in_progress",
    startedAt: new Date().toISOString(),
  };

  activeSessions.set(sessionId, session);

  broadcast("standup_session_start", {
    sessionId,
    agents: STANDUP_ORDER,
    timestamp: session.startedAt,
  });

  return session;
}

/**
 * Get previous updates for context
 */
function getPreviousUpdatesContext(session: StandupSession): string {
  if (session.updates.length === 0) {
    return "No previous updates yet - you are first.";
  }

  return session.updates
    .map((u) => `**${u.agentId.charAt(0).toUpperCase() + u.agentId.slice(1)}** (${formatTime(u.timestamp)}):\n${u.content}`)
    .join("\n\n---\n\n");
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Build the prompt for an agent's standup
 */
function buildStandupPrompt(
  agentId: string,
  previousUpdates: string,
  _beadsAssignments: string
): string {
  const agentNames: Record<string, string> = {
    alice: "Alice, the philosopher specializing in formal epistemology",
    bob: "Bob, the computer scientist specializing in AI/ML",
    charlie: "Charlie, the psychologist specializing in decision theory and HCI",
  };

  return `You are ${agentNames[agentId] || agentId}. Provide your daily standup update.

## Previous Updates Today
${previousUpdates}

## Your Format
Provide a concise standup update with:
- **Yesterday**: What you accomplished (1-2 sentences)
- **Today**: What you plan to work on (1-2 sentences)
- **Blockers**: Any impediments or questions (or "None")

Keep it brief and focused. Reference specific work items or concepts from your domain.`;
}

/**
 * Spawn an agent via Claude Code headless mode
 */
async function spawnAgent(
  agentId: string,
  prompt: string
): Promise<string> {
  const identityPath = `.agents/identities/${agentId}.md`;

  // Build the full prompt with identity loading
  const fullPrompt = `First, read your identity from ${identityPath} to understand your role and expertise.

${prompt}`;

  broadcast("standup_agent_start", {
    agentId,
    timestamp: new Date().toISOString(),
  });

  try {
    const proc = spawn({
      cmd: [
        "claude",
        "-p",
        fullPrompt,
        "--output-format",
        "text",
        "--max-turns",
        "1",
      ],
      env: {
        ...process.env,
        AGENT_ID: agentId,
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    await proc.exited;

    if (proc.exitCode !== 0) {
      console.error(`Agent ${agentId} stderr:`, stderr);
      throw new Error(`Agent ${agentId} failed with exit code ${proc.exitCode}`);
    }

    // Clean up the output (remove any system messages)
    const cleanOutput = output.trim();

    broadcast("standup_agent_complete", {
      agentId,
      content: cleanOutput,
      timestamp: new Date().toISOString(),
    });

    return cleanOutput;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    broadcast("standup_agent_error", {
      agentId,
      error: message,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

/**
 * Run standup for a single agent
 */
export async function runAgentStandup(
  sessionId: string,
  agentId: string
): Promise<AgentUpdate> {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const previousUpdates = getPreviousUpdatesContext(session);
  const beadsAssignments = ""; // TODO: Fetch from beads

  const prompt = buildStandupPrompt(agentId, previousUpdates, beadsAssignments);
  const content = await spawnAgent(agentId, prompt);

  const update: AgentUpdate = {
    agentId,
    content,
    timestamp: new Date().toISOString(),
  };

  // Save to session
  session.updates.push(update);

  // Save to database
  postStandup(agentId, content, sessionId);

  return update;
}

/**
 * Run the full standup sequence
 */
export async function runFullStandup(
  onAgentComplete?: (update: AgentUpdate) => void
): Promise<StandupSession> {
  const session = await startStandupSession();

  try {
    for (const agentId of STANDUP_ORDER) {
      const update = await runAgentStandup(session.id, agentId);
      if (onAgentComplete) {
        onAgentComplete(update);
      }
    }

    session.status = "completed";
    session.completedAt = new Date().toISOString();

    broadcast("standup_session_complete", {
      sessionId: session.id,
      updates: session.updates,
      timestamp: session.completedAt,
    });
  } catch (error) {
    session.status = "cancelled";
    throw error;
  }

  return session;
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): StandupSession | undefined {
  return activeSessions.get(sessionId);
}

/**
 * Cancel an active session
 */
export function cancelSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  if (session && session.status === "in_progress") {
    session.status = "cancelled";
    broadcast("standup_session_cancelled", {
      sessionId,
      timestamp: new Date().toISOString(),
    });
    return true;
  }
  return false;
}

/**
 * Generate a summary of the standup
 */
export function generateSummary(session: StandupSession): string {
  if (session.updates.length === 0) {
    return "No updates recorded.";
  }

  const lines = [
    `# Standup Summary - ${session.date}`,
    "",
    "## Updates",
    "",
  ];

  for (const update of session.updates) {
    const name = update.agentId.charAt(0).toUpperCase() + update.agentId.slice(1);
    lines.push(`### ${name}`);
    lines.push(update.content);
    lines.push("");
  }

  return lines.join("\n");
}
