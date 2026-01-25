/**
 * Agent Dispatcher Module
 *
 * Watches team.db for unread messages and triggers agent sessions via Claude Code CLI.
 *
 * Flow: Unread messages -> Poll every 5s -> Debounce (60s cooldown) -> Spawn claude CLI
 * Only triggers if there are NEW messages since last trigger (prevents re-processing).
 */

import { getUnreadMessages } from "./db.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");

// Configuration from environment
const POLL_INTERVAL = parseInt(process.env.DISPATCHER_POLL_INTERVAL || "5000");
const COOLDOWN = parseInt(process.env.DISPATCHER_COOLDOWN || "60000");
const DISPATCHER_ENABLED = process.env.DISPATCHER_ENABLED !== "false";

// Agent configuration
const AGENTS = ["alice", "bob", "charlie"] as const;
type AgentId = (typeof AGENTS)[number];

interface AgentState {
  lastTriggerTime: number;
  lastSeenMessageTime: string; // ISO timestamp of newest message when last triggered
  activeProcess: ReturnType<typeof Bun.spawn> | null;
  triggerCount: number;
}

// State tracking per agent
const agentState: Record<AgentId, AgentState> = {
  alice: { lastTriggerTime: 0, lastSeenMessageTime: "", activeProcess: null, triggerCount: 0 },
  bob: { lastTriggerTime: 0, lastSeenMessageTime: "", activeProcess: null, triggerCount: 0 },
  charlie: { lastTriggerTime: 0, lastSeenMessageTime: "", activeProcess: null, triggerCount: 0 },
};

// Track dispatcher state
let dispatcherEnabled = false;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;
let broadcast: ((event: string, data: unknown) => void) | null = null;

/**
 * Get session ID for an agent from environment
 */
function getSessionId(agent: AgentId): string {
  const envVar = `${agent.toUpperCase()}_SESSION_ID`;
  return process.env[envVar] || `${agent}-session`;
}

/**
 * Check if agent can be triggered (respects cooldown)
 */
function canTrigger(agent: AgentId): boolean {
  const state = agentState[agent];
  const now = Date.now();

  // Check cooldown
  if (now - state.lastTriggerTime < COOLDOWN) {
    return false;
  }

  // Check if already has an active process
  if (state.activeProcess !== null) {
    return false;
  }

  return true;
}

/**
 * Trigger an agent session via Claude CLI
 */
async function triggerAgent(agent: AgentId): Promise<void> {
  const sessionId = getSessionId(agent);
  const state = agentState[agent];

  console.log(`[Dispatcher] Triggering ${agent} (session: ${sessionId})`);

  state.lastTriggerTime = Date.now();
  state.triggerCount++;

  // Broadcast trigger event
  if (broadcast) {
    broadcast("agent_triggered", {
      agent,
      sessionId,
      timestamp: new Date().toISOString(),
      triggerCount: state.triggerCount,
    });
  }

  try {
    const proc = Bun.spawn(
      [
        "claude",
        "--agent",
        agent,
        "-r",
        sessionId,
        "-p",
        "Check your inbox and respond to new messages. Use message_list with unread_only=true to see unread messages, then respond appropriately.",
      ],
      {
        cwd: PROJECT_ROOT,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          AGENT_ID: agent,
        },
      }
    );

    state.activeProcess = proc;

    // Handle process completion
    proc.exited.then((exitCode) => {
      state.activeProcess = null;

      console.log(`[Dispatcher] ${agent} session ended (exit code: ${exitCode})`);

      if (broadcast) {
        broadcast("agent_session_ended", {
          agent,
          sessionId,
          exitCode,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Collect stdout for logging
    if (proc.stdout) {
      const reader = proc.stdout.getReader();
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = new TextDecoder().decode(value);
            console.log(`[${agent}] ${text.trim()}`);
          }
        } catch {
          // Stream closed
        }
      })();
    }

    // Collect stderr for logging
    if (proc.stderr) {
      const reader = proc.stderr.getReader();
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = new TextDecoder().decode(value);
            console.error(`[${agent}:err] ${text.trim()}`);
          }
        } catch {
          // Stream closed
        }
      })();
    }
  } catch (error) {
    console.error(`[Dispatcher] Failed to trigger ${agent}:`, error);
    state.activeProcess = null;

    if (broadcast) {
      broadcast("agent_trigger_failed", {
        agent,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }
}

/**
 * Poll for unread messages and trigger agents as needed
 */
async function checkAndTrigger(): Promise<void> {
  for (const agent of AGENTS) {
    try {
      const { count, messages } = getUnreadMessages(agent);

      if (count === 0) continue;

      const state = agentState[agent];

      // Find the newest message timestamp
      const newestMessageTime = messages.reduce(
        (newest, m) => (m.timestamp > newest ? m.timestamp : newest),
        ""
      );

      // Only trigger if there are messages newer than what we last saw
      const hasNewMessages = newestMessageTime > state.lastSeenMessageTime;

      if (!hasNewMessages) {
        // Messages exist but we've already triggered for them
        continue;
      }

      if (!canTrigger(agent)) {
        const remaining = Math.max(0, COOLDOWN - (Date.now() - state.lastTriggerTime));
        if (remaining > 0 && state.activeProcess === null) {
          console.log(
            `[Dispatcher] ${agent} has ${count} NEW unread but in cooldown (${Math.ceil(remaining / 1000)}s remaining)`
          );
        } else if (state.activeProcess !== null) {
          console.log(`[Dispatcher] ${agent} has ${count} NEW unread but session is active`);
        }
        continue;
      }

      // Update lastSeenMessageTime before triggering
      state.lastSeenMessageTime = newestMessageTime;

      console.log(`[Dispatcher] ${agent} has ${count} NEW unread message(s) from: ${messages.map((m) => m.from_agent).join(", ")}`);
      await triggerAgent(agent);
    } catch (error) {
      console.error(`[Dispatcher] Error checking ${agent}:`, error);
    }
  }
}

/**
 * Initialize the dispatcher
 */
export function initDispatcher(
  broadcastFn: (event: string, data: unknown) => void
): boolean {
  if (!DISPATCHER_ENABLED) {
    console.log("[Dispatcher] Disabled via DISPATCHER_ENABLED=false");
    return false;
  }

  broadcast = broadcastFn;
  dispatcherEnabled = true;

  console.log(
    `[Dispatcher] Initialized (poll: ${POLL_INTERVAL}ms, cooldown: ${COOLDOWN}ms)`
  );

  // Start polling
  pollIntervalId = setInterval(checkAndTrigger, POLL_INTERVAL);

  // Broadcast dispatcher status
  broadcast("dispatcher_status", { enabled: true, pollInterval: POLL_INTERVAL, cooldown: COOLDOWN });

  return true;
}

/**
 * Stop the dispatcher
 */
export function stopDispatcher(): void {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  dispatcherEnabled = false;

  if (broadcast) {
    broadcast("dispatcher_status", { enabled: false });
  }

  console.log("[Dispatcher] Stopped");
}

/**
 * Get dispatcher status
 */
export function getDispatcherStatus(): {
  enabled: boolean;
  pollInterval: number;
  cooldown: number;
  agents: Record<string, { lastTrigger: string | null; lastSeenMessage: string | null; active: boolean; triggerCount: number }>;
} {
  const agents: Record<string, { lastTrigger: string | null; lastSeenMessage: string | null; active: boolean; triggerCount: number }> = {};

  for (const agent of AGENTS) {
    const state = agentState[agent];
    agents[agent] = {
      lastTrigger: state.lastTriggerTime ? new Date(state.lastTriggerTime).toISOString() : null,
      lastSeenMessage: state.lastSeenMessageTime || null,
      active: state.activeProcess !== null,
      triggerCount: state.triggerCount,
    };
  }

  return {
    enabled: dispatcherEnabled,
    pollInterval: POLL_INTERVAL,
    cooldown: COOLDOWN,
    agents,
  };
}

/**
 * Manually trigger an agent (bypasses cooldown check)
 */
export async function manualTrigger(agent: string): Promise<{ success: boolean; error?: string }> {
  if (!AGENTS.includes(agent as AgentId)) {
    return { success: false, error: `Unknown agent: ${agent}` };
  }

  const agentId = agent as AgentId;
  const state = agentState[agentId];

  if (state.activeProcess !== null) {
    return { success: false, error: `${agent} already has an active session` };
  }

  await triggerAgent(agentId);
  return { success: true };
}
