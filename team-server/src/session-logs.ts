/**
 * Session Logs Module
 *
 * Reads per-session JSONL log files written by the log-conversation.sh hook.
 * Each agent's sessions are stored under .agents/logs/{agent_id}/sessions/{session_id}.jsonl
 *
 * Provides functions for listing, reading, and searching session transcripts.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");
const LOGS_DIR = resolve(PROJECT_ROOT, ".agents/logs");

/** A single log event entry from a session JSONL file */
export interface SessionEvent {
  timestamp: string;
  event: string;
  agent: string;
  session_id: string;
  // Event-specific fields
  prompt?: string;
  tool_name?: string;
  tool_input?: string;
  tool_response?: string;
  error?: string;
  subagent_id?: string;
}

/** Summary metadata for a session */
export interface SessionSummary {
  session_id: string;
  started_at: string | null;
  ended_at: string | null;
  event_count: number;
  has_errors: boolean;
}

/** Result from reading a session */
export interface SessionReadResult {
  session_id: string;
  event_count: number;
  events: SessionEvent[];
}

/** A single search match */
export interface SearchMatch {
  session_id: string;
  event: SessionEvent;
}

/** Result from searching sessions */
export interface SearchResult {
  query: string;
  total_matches: number;
  results: SearchMatch[];
}

/** Result from cross-agent event aggregation */
export interface AggregatedEventsResult {
  events: SessionEvent[];
  total: number;
  agents: string[];
}

/**
 * Get the sessions directory for an agent
 */
function getSessionsDir(agentId: string): string {
  return resolve(LOGS_DIR, agentId, "sessions");
}

/**
 * Parse a JSONL file into an array of session events.
 * Handles both single-line JSONL and pretty-printed multi-line JSON objects.
 * Skips malformed entries silently.
 */
function parseJsonlFile(filePath: string): SessionEvent[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);
  const events: SessionEvent[] = [];

  // First try single-line JSONL parsing
  let singleLineParsed = 0;
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
      singleLineParsed++;
    } catch {
      // Not single-line JSONL
    }
  }

  if (singleLineParsed > 0) {
    return events;
  }

  // Fall back to multi-line JSON object parsing
  // Split on lines that are just "}" (end of a top-level object)
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    current += `${line}\n`;
    if (line.trim() === "}") {
      chunks.push(current.trim());
      current = "";
    }
  }

  for (const chunk of chunks) {
    try {
      events.push(JSON.parse(chunk));
    } catch {
      // Skip malformed chunks
    }
  }

  return events;
}

/**
 * List sessions for an agent with summary metadata.
 * Returns sessions sorted by most recent first.
 */
export function listAgentSessions(
  agentId: string,
  limit = 20
): SessionSummary[] {
  const sessionsDir = getSessionsDir(agentId);

  if (!existsSync(sessionsDir)) {
    return [];
  }

  const files = readdirSync(sessionsDir).filter((f) => f.endsWith(".jsonl"));

  // Get file stats for sorting by modification time (most recent first)
  const fileStats = files.map((f) => {
    const fullPath = resolve(sessionsDir, f);
    const stat = statSync(fullPath);
    return { file: f, mtime: stat.mtimeMs, path: fullPath };
  });

  fileStats.sort((a, b) => b.mtime - a.mtime);

  const summaries: SessionSummary[] = [];

  for (const { file, path } of fileStats.slice(0, limit)) {
    const sessionId = file.replace(".jsonl", "");
    const events = parseJsonlFile(path);

    if (events.length === 0) {
      continue;
    }

    const startEvent = events.find(
      (e) => e.event === "SessionStart" || e.event === "UserPromptSubmit"
    );
    const endEvent = [...events]
      .reverse()
      .find((e) => e.event === "SessionEnd" || e.event === "Stop");
    const hasErrors = events.some((e) => e.event === "PostToolUseFailure");

    summaries.push({
      session_id: sessionId,
      started_at: startEvent?.timestamp ?? events[0].timestamp,
      ended_at: endEvent?.timestamp ?? null,
      event_count: events.length,
      has_errors: hasErrors,
    });
  }

  return summaries;
}

/**
 * Read events from a specific session with pagination support.
 */
export function readAgentSession(
  agentId: string,
  sessionId: string,
  limit = 100,
  offset = 0
): SessionReadResult | null {
  const filePath = resolve(getSessionsDir(agentId), `${sessionId}.jsonl`);

  if (!existsSync(filePath)) {
    return null;
  }

  const allEvents = parseJsonlFile(filePath);
  const paginatedEvents = allEvents.slice(offset, offset + limit);

  return {
    session_id: sessionId,
    event_count: allEvents.length,
    events: paginatedEvents,
  };
}

/**
 * Search across all sessions for an agent.
 * Case-insensitive text search across event fields.
 * Optionally filter by event types.
 */
export function searchAgentSessions(
  agentId: string,
  query: string,
  limit = 20,
  eventTypes?: string[]
): SearchResult {
  const sessionsDir = getSessionsDir(agentId);
  const lowerQuery = query.toLowerCase();
  const matches: SearchMatch[] = [];

  if (!existsSync(sessionsDir)) {
    return { query, total_matches: 0, results: [] };
  }

  const files = readdirSync(sessionsDir).filter((f) => f.endsWith(".jsonl"));

  // Sort by most recent first
  const fileStats = files.map((f) => {
    const fullPath = resolve(sessionsDir, f);
    const stat = statSync(fullPath);
    return { file: f, mtime: stat.mtimeMs, path: fullPath };
  });
  fileStats.sort((a, b) => b.mtime - a.mtime);

  for (const { file, path } of fileStats) {
    if (matches.length >= limit) {
      break;
    }

    const sessionId = file.replace(".jsonl", "");
    const events = parseJsonlFile(path);

    for (const event of events) {
      if (matches.length >= limit) {
        break;
      }

      // Filter by event type if specified
      if (
        eventTypes &&
        eventTypes.length > 0 &&
        !eventTypes.includes(event.event)
      ) {
        continue;
      }

      // Search across all string fields
      const searchableText = [
        event.event,
        event.prompt,
        event.tool_name,
        event.tool_input,
        event.tool_response,
        event.error,
        event.subagent_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (searchableText.includes(lowerQuery)) {
        matches.push({ session_id: sessionId, event });
      }
    }
  }

  return {
    query,
    total_matches: matches.length,
    results: matches,
  };
}

/**
 * Get recent events across all agents.
 * Discovers agent directories, reads the 3 most recent session files per agent,
 * merges events, applies optional filters, and returns sorted by timestamp desc.
 */
export function getRecentEventsAcrossAgents(
  limit = 50,
  eventTypes?: string[],
  since?: string
): AggregatedEventsResult {
  if (!existsSync(LOGS_DIR)) {
    return { events: [], total: 0, agents: [] };
  }

  const agentDirs = readdirSync(LOGS_DIR).filter((d) => {
    // Skip "unknown" directory — these are non-agent CLI sessions
    if (d === "unknown") return false;
    const sessionsPath = resolve(LOGS_DIR, d, "sessions");
    return existsSync(sessionsPath);
  });

  const allEvents: SessionEvent[] = [];
  const sinceTime = since ? new Date(since).getTime() : 0;
  const maxFilesPerAgent = 3;

  for (const agentId of agentDirs) {
    const sessionsDir = resolve(LOGS_DIR, agentId, "sessions");
    const files = readdirSync(sessionsDir).filter((f) => f.endsWith(".jsonl"));

    // Sort by modification time, most recent first
    const fileStats = files.map((f) => {
      const fullPath = resolve(sessionsDir, f);
      const stat = statSync(fullPath);
      return { file: f, mtime: stat.mtimeMs, path: fullPath };
    });
    fileStats.sort((a, b) => b.mtime - a.mtime);

    for (const { path } of fileStats.slice(0, maxFilesPerAgent)) {
      const events = parseJsonlFile(path);
      for (const event of events) {
        // Filter by timestamp if since is specified
        if (sinceTime > 0 && new Date(event.timestamp).getTime() <= sinceTime) {
          continue;
        }

        // Filter by event type if specified
        if (
          eventTypes &&
          eventTypes.length > 0 &&
          !eventTypes.includes(event.event)
        ) {
          continue;
        }

        allEvents.push(event);
      }
    }
  }

  // Sort by timestamp descending (most recent first)
  allEvents.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return {
    events: allEvents.slice(0, limit),
    total: allEvents.length,
    agents: agentDirs,
  };
}
