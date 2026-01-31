/**
 * Agent Dispatcher Module
 *
 * Watches team.db for unread messages and triggers agent sessions via Claude Code CLI.
 *
 * Flow: Unread messages -> Poll every 5s -> Debounce (60s cooldown) -> Spawn claude CLI
 * Only triggers if there are NEW messages since last trigger (prevents re-processing).
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
import { getDispatchableAgentIds, isDispatchableAgent } from "./agents.js";
import {
  deleteAgentSessions,
  getAgentSession,
  getUnreadMessages,
  type Message,
  postStandup,
} from "./db.js";
import { logger } from "./logger.js";

export interface DispatchContext {
  timestamp: string;
  agent_id: string;
  trigger: "dm" | "mention" | "standup" | "ask_agent" | "orchestrate";
  source: string;
  sender: string | null;
  senders?: string[];
  channel?: string;
  message_preview?: string;
}

export function buildDispatchContext(ctx: DispatchContext): string {
  return `<dispatch_context>\n${JSON.stringify(ctx)}\n</dispatch_context>\n\n`;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");

// Configuration from environment
const POLL_INTERVAL = Number.parseInt(
  process.env.DISPATCHER_POLL_INTERVAL || "5000",
  10
);
const COOLDOWN = Number.parseInt(
  process.env.DISPATCHER_COOLDOWN || "60000",
  10
);
const DISPATCHER_ENABLED = process.env.DISPATCHER_ENABLED !== "false";
const WATCHDOG_INACTIVITY_MS = Number.parseInt(
  process.env.DISPATCHER_WATCHDOG_INACTIVITY || "300000",
  10
);
const MAX_SESSION_DURATION_MS = Number.parseInt(
  process.env.DISPATCHER_MAX_SESSION_DURATION || "600000",
  10
);

// Standup queue for sequential agent triggering
interface StandupQueue {
  sessionId: string;
  channel: string;
  pendingAgents: string[];
  currentAgent: string | null;
  completedAgents: string[];
  startedAt: string;
}

interface AgentState {
  lastTriggerTime: number;
  lastSeenMessageTime: string; // ISO timestamp of newest message when last triggered
  activeProcess: ReturnType<typeof Bun.spawn> | null;
  triggerCount: number;
  lastExitCode: number | null;
  lastActiveStart: number | null;
  lastOutputTime: number | null; // Timestamp of last stdout/stderr activity
}

/**
 * Spawn a Claude CLI process for an agent, with automatic fallback.
 * Tries `-r` (resume) first. If the session doesn't exist, retries with `--session-id` (create).
 */
function spawnClaudeSession(
  agent: string,
  sessionId: string,
  prompt: string,
  onComplete: (exitCode: number, retried: boolean) => void,
  mode: "resume" | "create" = "resume"
): void {
  const spawnEnv = { ...process.env, AGENT_ID: agent };

  function attachLogging(proc: ReturnType<typeof Bun.spawn>): void {
    if (proc.stdout) {
      const reader = proc.stdout.getReader();
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            state.lastOutputTime = Date.now();
            const text = new TextDecoder().decode(value);
            logger.debug(agent, text.trim());
          }
        } catch {
          // Stream closed
        }
      })();
    }
    if (proc.stderr) {
      const reader = proc.stderr.getReader();
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            state.lastOutputTime = Date.now();
            const text = new TextDecoder().decode(value);
            logger.error(agent, text.trim());
          }
        } catch {
          // Stream closed
        }
      })();
    }
  }

  const state = ensureAgentState(agent);

  // "create" mode: skip resume attempt, go straight to --session-id
  if (mode === "create") {
    const proc = Bun.spawn(
      ["claude", "--agent", agent, "--session-id", sessionId, prompt, "-p"],
      { cwd: PROJECT_ROOT, stdout: "pipe", stderr: "pipe", env: spawnEnv }
    );
    state.activeProcess = proc;
    attachLogging(proc);

    proc.exited
      .then((exitCode) => {
        onComplete(exitCode, false);
      })
      .catch((err) => {
        logger.error("Dispatcher", `${agent} proc.exited promise rejected`, {
          error: err instanceof Error ? err.message : String(err),
        });
        onComplete(-1, false);
      });
    return;
  }

  // "resume" mode: try -r first, fall back to --session-id if not found
  const proc = Bun.spawn(
    ["claude", "--agent", agent, "-r", sessionId, prompt, "-p"],
    {
      cwd: PROJECT_ROOT,
      stdout: "pipe",
      stderr: "pipe",
      env: spawnEnv,
    }
  );

  state.activeProcess = proc;

  // Collect stderr to detect "No conversation found"
  const stderrChunks: string[] = [];
  if (proc.stderr) {
    const reader = proc.stderr.getReader();
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          state.lastOutputTime = Date.now();
          const text = new TextDecoder().decode(value);
          stderrChunks.push(text);
          logger.error(agent, text.trim());
        }
      } catch {
        // Stream closed
      }
    })();
  }

  // Attach stdout logging for first attempt
  if (proc.stdout) {
    const reader = proc.stdout.getReader();
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          state.lastOutputTime = Date.now();
          const text = new TextDecoder().decode(value);
          logger.debug(agent, text.trim());
        }
      } catch {
        // Stream closed
      }
    })();
  }

  proc.exited
    .then((exitCode) => {
      const stderrText = stderrChunks.join("");
      const isSessionNotFound =
        exitCode !== 0 && stderrText.includes("No conversation found");

      if (isSessionNotFound) {
        logger.info(
          "Dispatcher",
          `${agent} session not found, creating new session`,
          { sessionId }
        );

        // Retry with --session-id to create the session
        const retryProc = Bun.spawn(
          ["claude", "--agent", agent, "--session-id", sessionId, prompt, "-p"],
          { cwd: PROJECT_ROOT, stdout: "pipe", stderr: "pipe", env: spawnEnv }
        );
        state.activeProcess = retryProc;
        attachLogging(retryProc);

        retryProc.exited
          .then((retryExitCode) => {
            onComplete(retryExitCode, true);
          })
          .catch((err) => {
            logger.error(
              "Dispatcher",
              `${agent} retry proc.exited promise rejected`,
              { error: err instanceof Error ? err.message : String(err) }
            );
            onComplete(-1, true);
          });
      } else {
        onComplete(exitCode, false);
      }
    })
    .catch((err) => {
      logger.error("Dispatcher", `${agent} proc.exited promise rejected`, {
        error: err instanceof Error ? err.message : String(err),
      });
      onComplete(-1, false);
    });
}

// State tracking per agent (built dynamically)
const agentState: Record<string, AgentState> = {};

/** Ensure an agent has state entry, creating one lazily if needed */
function ensureAgentState(agentId: string): AgentState {
  if (!agentState[agentId]) {
    agentState[agentId] = {
      lastTriggerTime: 0,
      lastSeenMessageTime: "",
      activeProcess: null,
      triggerCount: 0,
      lastExitCode: null,
      lastActiveStart: null,
      lastOutputTime: null,
    };
  }
  return agentState[agentId];
}

/**
 * Check if an agent's process is still alive.
 * If the process has exited (exitCode is set), reap the stale state.
 * Returns true if the process is genuinely still running.
 */
function isProcessAlive(state: AgentState): boolean {
  if (state.activeProcess === null) {
    return false;
  }

  // Bun's proc.exitCode is synchronously set once the process exits
  if (state.activeProcess.exitCode !== null) {
    logger.info("Dispatcher", "Reaped stale process (already exited)", {
      exitCode: state.activeProcess.exitCode,
    });
    state.lastExitCode = state.activeProcess.exitCode;
    state.activeProcess = null;
    state.lastActiveStart = null;
    return false;
  }

  return true;
}

/**
 * Kill a stale process and clean up agent state.
 */
function killStaleProcess(
  agent: string,
  state: AgentState,
  reason: "inactivity" | "max_duration"
): void {
  const proc = state.activeProcess;
  if (!proc) {
    return;
  }

  try {
    proc.kill();
  } catch {
    // Process already dead
  }

  state.activeProcess = null;
  state.lastExitCode = -1;
  state.lastActiveStart = null;
  state.lastOutputTime = null;

  // Clear orchestrator concurrency guard if applicable
  if (agent === "orchestrator") {
    activeOrchestratorProcess = null;
  }

  logger.warn("Dispatcher", `Watchdog killed ${agent} (${reason})`);

  if (broadcast) {
    broadcast("agent_session_ended", {
      agent,
      exitCode: -1,
      reason: `watchdog_${reason}`,
      timestamp: new Date().toISOString(),
    });
  }
}

// Track dispatcher state
let dispatcherEnabled = false;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;
let broadcast: ((event: string, data: unknown) => void) | null = null;

// Active standup queue (null when no standup in progress)
let activeStandupQueue: StandupQueue | null = null;

/**
 * Get session ID for an agent.
 * Each agent has ONE session shared across all contexts (DMs, channels, etc).
 */
function getSessionId(agent: string): string {
  return getAgentSession(PROJECT_ROOT, agent);
}

/**
 * Check if agent can be triggered (respects cooldown)
 */
function canTrigger(agent: string): boolean {
  const state = agentState[agent];
  const now = Date.now();

  // Check cooldown
  if (now - state.lastTriggerTime < COOLDOWN) {
    return false;
  }

  // Check if already has an active process
  if (isProcessAlive(state)) {
    return false;
  }

  return true;
}

export type HealthStatus = "green" | "yellow" | "red";

/**
 * Get health status for an agent
 * - green: No active process, last exit was 0 or never triggered
 * - yellow: In cooldown period, or active but < 2 minutes
 * - red: Active > 2 minutes (stuck), or last exit non-zero
 */
export function getAgentHealth(agent: string): HealthStatus {
  const state = agentState[agent];
  const now = Date.now();
  const TWO_MINUTES = 2 * 60 * 1000;

  // If process is active
  if (isProcessAlive(state) && state.lastActiveStart !== null) {
    const activeTime = now - state.lastActiveStart;
    if (activeTime > TWO_MINUTES) {
      return "red"; // Stuck - active for more than 2 minutes
    }
    return "yellow"; // Active but still healthy
  }

  // If in cooldown period
  if (now - state.lastTriggerTime < COOLDOWN) {
    return "yellow";
  }

  // If last exit was non-zero
  if (state.lastExitCode !== null && state.lastExitCode !== 0) {
    return "red";
  }

  // Green: idle, no issues
  return "green";
}

/**
 * Extract reply_to_channel from message metadata (Layer 1 routing).
 * Scans messages for the first metadata.reply_to_channel value.
 */
function extractChannelRouting(messages?: Message[]): string | null {
  if (!messages) {
    return null;
  }
  for (const msg of messages) {
    if (msg.metadata) {
      try {
        const meta = JSON.parse(msg.metadata);
        if (meta.reply_to_channel) {
          return meta.reply_to_channel;
        }
      } catch {
        // ignore malformed metadata
      }
    }
  }
  return null;
}

/**
 * Trigger an agent session via Claude CLI
 */
function triggerAgent(
  agent: string,
  senders?: string[],
  messagePreview?: string,
  messages?: Message[]
): void {
  const sessionId = getSessionId(agent);

  logger.info("Dispatcher", `Triggering ${agent}`, { sessionId });

  const state = ensureAgentState(agent);
  state.lastTriggerTime = Date.now();
  state.lastActiveStart = Date.now();
  state.lastOutputTime = Date.now();
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
    const header = buildDispatchContext({
      timestamp: new Date().toISOString(),
      agent_id: agent,
      trigger: "dm",
      source: senders?.length === 1 ? `dm:${senders[0]}` : "dm:multiple",
      sender: senders?.[0] ?? null,
      senders,
      message_preview: messagePreview,
    });

    let prompt: string;

    if (agent === "orchestrator") {
      prompt =
        header +
        "You have new messages from agents reporting task completions or requesting coordination. Do this:\n" +
        "1. Call message_list with unread_only=true to see completion notifications\n" +
        "2. For each completed task mentioned, verify it's closed: run `bd show <issue-id>`\n" +
        "3. Check if any blocked tasks are now unblocked: run `bd blocked`\n" +
        "4. For each newly-unblocked task, DM the assigned agent via message_send\n" +
        '   with metadata {"reply_to_channel": "general"}:\n' +
        '   "Dependency resolved — you can now start: <title> (<issue-id>)\n' +
        "    Run `/plan-issue <issue-id>` to review and begin.\n" +
        "    Post your work output to #general using channel_write for team visibility.\n" +
        '    When complete, close the issue with `bd close <issue-id>` and message me back."\n' +
        "5. Post a progress update to the #general channel via channel_write summarizing what advanced\n" +
        "6. Mark all processed messages as read via message_mark_read\n" +
        "7. Reply to each sender via message_send acknowledging their completion";
    } else {
      // Extract channel routing from message metadata (Layer 1)
      const channelRouting = extractChannelRouting(messages);

      prompt =
        header +
        "You have new DMs. Follow this protocol:\n\n" +
        "1. Call message_list with unread_only=true to read your messages.\n" +
        "2. For each message, determine the response channel:\n" +
        "   a. METADATA: If the message has metadata.reply_to_channel, post substantive output there via channel_write.\n" +
        "   b. CONTENT: If the message references a #channel, post substantive output there via channel_write.\n" +
        "   c. DEFAULT: If it's a task assignment with no channel specified, post results to #general via channel_write.\n" +
        "   d. For simple questions or greetings, reply via message_send.\n" +
        '3. ALWAYS send a brief DM acknowledgment to the sender ("Done — posted results to #channel").\n' +
        "4. Mark processed messages as read.\n\n" +
        "PRINCIPLE: Substantive work goes to channels for team visibility. DMs are for acknowledgments and coordination.";

      // Append explicit routing if metadata was found (Layer 1 override)
      if (channelRouting) {
        prompt += `\n\nROUTING: Post your work output to #${channelRouting} using channel_write.`;
      }
    }

    spawnClaudeSession(agent, sessionId, prompt, (exitCode) => {
      if (state.activeProcess === null) {
        return; // Watchdog already cleaned up
      }
      state.activeProcess = null;
      state.lastExitCode = exitCode;
      state.lastActiveStart = null;
      state.lastOutputTime = null;

      logger.info("Dispatcher", `${agent} session ended`, { exitCode });

      if (broadcast) {
        broadcast("agent_session_ended", {
          agent,
          sessionId,
          exitCode,
          timestamp: new Date().toISOString(),
        });
      }
    });
  } catch (error) {
    logger.error("Dispatcher", `Failed to trigger ${agent}`, {
      error: error instanceof Error ? error.message : String(error),
    });
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
/**
 * Reap any stale processes across all agents.
 * Called every poll cycle to ensure exited processes are cleaned up promptly.
 */
function reapStaleProcesses(): void {
  const now = Date.now();
  for (const agent of getDispatchableAgentIds()) {
    const state = agentState[agent];
    if (!state) {
      continue;
    }

    // Check if process already exited synchronously (existing behavior)
    if (!isProcessAlive(state)) {
      continue;
    }

    // Max session duration exceeded
    if (
      state.lastActiveStart !== null &&
      now - state.lastActiveStart > MAX_SESSION_DURATION_MS
    ) {
      logger.warn("Dispatcher", `${agent}: max session duration exceeded`, {
        durationMs: now - state.lastActiveStart,
        maxMs: MAX_SESSION_DURATION_MS,
      });
      killStaleProcess(agent, state, "max_duration");
      continue;
    }

    // No output activity for too long
    if (
      state.lastOutputTime !== null &&
      now - state.lastOutputTime > WATCHDOG_INACTIVITY_MS
    ) {
      logger.warn(
        "Dispatcher",
        `${agent}: no output for ${Math.round((now - state.lastOutputTime) / 1000)}s`,
        {
          inactivityMs: now - state.lastOutputTime,
          thresholdMs: WATCHDOG_INACTIVITY_MS,
        }
      );
      killStaleProcess(agent, state, "inactivity");
    }
  }
}

function checkAndTrigger(): void {
  reapStaleProcesses();

  for (const agent of getDispatchableAgentIds()) {
    try {
      const { count, messages } = getUnreadMessages(agent);

      if (count === 0) {
        continue;
      }

      const state = ensureAgentState(agent);

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
        const remaining = Math.max(
          0,
          COOLDOWN - (Date.now() - state.lastTriggerTime)
        );
        if (remaining > 0 && !isProcessAlive(state)) {
          logger.debug(
            "Dispatcher",
            `${agent} has ${count} NEW unread but in cooldown`,
            { remainingSeconds: Math.ceil(remaining / 1000) }
          );
        } else if (isProcessAlive(state)) {
          logger.debug(
            "Dispatcher",
            `${agent} has ${count} NEW unread but session is active`
          );
        }
        continue;
      }

      // Update lastSeenMessageTime before triggering
      state.lastSeenMessageTime = newestMessageTime;

      const senders = [...new Set(messages.map((m) => m.from_agent))];
      const messagePreview = messages[0]?.content?.slice(0, 200);

      logger.info("Dispatcher", `${agent} has ${count} NEW unread message(s)`, {
        from: senders.join(", "),
      });
      triggerAgent(agent, senders, messagePreview, messages);
    } catch (error) {
      logger.error("Dispatcher", `Error checking ${agent}`, {
        error: error instanceof Error ? error.message : String(error),
      });
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
    logger.info("Dispatcher", "Disabled via DISPATCHER_ENABLED=false");
    return false;
  }

  broadcast = broadcastFn;
  dispatcherEnabled = true;

  logger.info("Dispatcher", "Initialized", {
    pollInterval: POLL_INTERVAL,
    cooldown: COOLDOWN,
    watchdogInactivity: WATCHDOG_INACTIVITY_MS,
    maxSessionDuration: MAX_SESSION_DURATION_MS,
  });

  // Start polling
  pollIntervalId = setInterval(checkAndTrigger, POLL_INTERVAL);

  // Broadcast dispatcher status
  broadcast("dispatcher_status", {
    enabled: true,
    pollInterval: POLL_INTERVAL,
    cooldown: COOLDOWN,
    watchdogInactivity: WATCHDOG_INACTIVITY_MS,
    maxSessionDuration: MAX_SESSION_DURATION_MS,
  });

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

  logger.info("Dispatcher", "Stopped");
}

/**
 * Get dispatcher status
 */
export function getDispatcherStatus(): {
  enabled: boolean;
  pollInterval: number;
  cooldown: number;
  agents: Record<
    string,
    {
      lastTrigger: string | null;
      lastSeenMessage: string | null;
      active: boolean;
      triggerCount: number;
      health: HealthStatus;
      lastExitCode: number | null;
      activeForMs: number | null;
      lastOutputMs: number | null;
      cooldownRemainingMs: number | null;
    }
  >;
} {
  const agents: Record<
    string,
    {
      lastTrigger: string | null;
      lastSeenMessage: string | null;
      active: boolean;
      triggerCount: number;
      health: HealthStatus;
      lastExitCode: number | null;
      activeForMs: number | null;
      lastOutputMs: number | null;
      cooldownRemainingMs: number | null;
    }
  > = {};

  const now = Date.now();

  for (const agent of getDispatchableAgentIds()) {
    const state = ensureAgentState(agent);
    const cooldownRemaining = Math.max(
      0,
      COOLDOWN - (now - state.lastTriggerTime)
    );

    agents[agent] = {
      lastTrigger: state.lastTriggerTime
        ? new Date(state.lastTriggerTime).toISOString()
        : null,
      lastSeenMessage: state.lastSeenMessageTime || null,
      active: isProcessAlive(state),
      triggerCount: state.triggerCount,
      health: getAgentHealth(agent),
      lastExitCode: state.lastExitCode,
      activeForMs:
        state.lastActiveStart !== null ? now - state.lastActiveStart : null,
      lastOutputMs:
        state.lastOutputTime !== null ? now - state.lastOutputTime : null,
      cooldownRemainingMs: cooldownRemaining > 0 ? cooldownRemaining : null,
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
 * @param agent - The agent to trigger
 * @param sender - Username of who triggered this
 * @param messagePreview - First 200 chars of triggering message
 */
export function manualTrigger(
  agent: string,
  sender?: string,
  messagePreview?: string
): { success: boolean; error?: string } {
  if (!isDispatchableAgent(agent)) {
    return { success: false, error: `Unknown agent: ${agent}` };
  }

  const state = ensureAgentState(agent);

  if (isProcessAlive(state)) {
    return { success: false, error: `${agent} already has an active session` };
  }

  const senders = sender ? [sender] : undefined;
  triggerAgent(agent, senders, messagePreview);
  return { success: true };
}

/**
 * Refresh an agent's session by deleting old sessions and creating a fresh one.
 * This forces a clean context on the next trigger.
 */
export function refreshAgentSession(
  agent: string,
  force = false
): {
  success: boolean;
  error?: string;
  oldSessionId?: string;
  newSessionId?: string;
} {
  if (!isDispatchableAgent(agent)) {
    return { success: false, error: `Unknown agent: ${agent}` };
  }

  const state = ensureAgentState(agent);

  if (isProcessAlive(state)) {
    if (force) {
      logger.warn("Dispatcher", `Force-killing ${agent} for session refresh`);
      killStaleProcess(agent, state, "inactivity");
    } else {
      return {
        success: false,
        error: `${agent} has an active session — cannot refresh while running (use force=true to kill)`,
      };
    }
  }

  // Capture old session ID
  const oldSessionId = getAgentSession(PROJECT_ROOT, agent);

  // Delete all sessions for this agent
  deleteAgentSessions(PROJECT_ROOT, agent);

  // Get (auto-creates) a new session
  const newSessionId = getAgentSession(PROJECT_ROOT, agent);

  // Reset agent state so it picks up new messages cleanly
  state.lastExitCode = null;
  state.lastSeenMessageTime = "";

  logger.info("Dispatcher", `Refreshed ${agent} session`, {
    oldSessionId,
    newSessionId,
  });

  // Broadcast refresh event
  if (broadcast) {
    broadcast("session_refreshed", {
      agent,
      oldSessionId,
      newSessionId,
      timestamp: new Date().toISOString(),
    });
  }

  return { success: true, oldSessionId, newSessionId };
}

/**
 * Trigger an agent for a channel @mention
 * Uses a channel-specific prompt instructing the agent to use channel_read/channel_write
 */
export function triggerAgentForChannel(
  agent: string,
  channel: string,
  sender?: string,
  messagePreview?: string
): { success: boolean; error?: string } {
  if (!isDispatchableAgent(agent)) {
    return { success: false, error: `Unknown agent: ${agent}` };
  }

  const state = ensureAgentState(agent);

  // Check if agent has an active session (skip if busy)
  if (isProcessAlive(state)) {
    logger.debug(
      "Dispatcher",
      `${agent} is busy, skipping channel trigger for #${channel}`
    );
    return { success: false, error: `${agent} is busy` };
  }

  // Check cooldown
  if (!canTrigger(agent)) {
    logger.debug(
      "Dispatcher",
      `${agent} in cooldown, skipping channel trigger for #${channel}`
    );
    return { success: false, error: `${agent} in cooldown` };
  }

  // Get agent session (shared across all contexts)
  const sessionId = getSessionId(agent);

  logger.info("Dispatcher", `Triggering ${agent} for #${channel} @mention`, {
    sessionId,
  });

  state.lastTriggerTime = Date.now();
  state.lastActiveStart = Date.now();
  state.lastOutputTime = Date.now();
  state.triggerCount++;

  // Broadcast trigger event
  if (broadcast) {
    broadcast("agent_triggered", {
      agent,
      sessionId,
      channel,
      reason: "channel_mention",
      timestamp: new Date().toISOString(),
      triggerCount: state.triggerCount,
    });
  }

  try {
    const header = buildDispatchContext({
      timestamp: new Date().toISOString(),
      agent_id: agent,
      trigger: "mention",
      source: `channel:${channel}`,
      sender: sender ?? null,
      channel,
      message_preview: messagePreview,
    });

    const prompt =
      header +
      `You were @mentioned in the #${channel} channel. Do this:
1. Call channel_read with channel="${channel}" and unread_only=true to see recent messages
2. Read and understand the context of the conversation
3. Call channel_write with channel="${channel}" and your response to participate in the discussion
Remember: Use channel_write to respond in the channel, NOT message_send (that's for DMs).`;

    spawnClaudeSession(agent, sessionId, prompt, (exitCode) => {
      if (state.activeProcess === null) {
        return; // Watchdog already cleaned up
      }
      state.activeProcess = null;
      state.lastExitCode = exitCode;
      state.lastActiveStart = null;
      state.lastOutputTime = null;

      logger.info("Dispatcher", `${agent} channel session ended`, {
        exitCode,
      });

      if (broadcast) {
        broadcast("agent_session_ended", {
          agent,
          sessionId,
          channel,
          exitCode,
          timestamp: new Date().toISOString(),
        });
      }
    });

    return { success: true };
  } catch (error) {
    logger.error("Dispatcher", `Failed to trigger ${agent} for channel`, {
      error: error instanceof Error ? error.message : String(error),
    });
    state.activeProcess = null;
    state.lastActiveStart = null;

    if (broadcast) {
      broadcast("agent_trigger_failed", {
        agent,
        channel,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Start a standup queue - triggers agents sequentially via their resumed sessions
 */
export function startStandupQueue(
  channel: string,
  agents: string[] = getDispatchableAgentIds()
): string {
  if (activeStandupQueue) {
    throw new Error("A standup session is already in progress");
  }

  const sessionId = `standup_${nanoid(10)}`;
  activeStandupQueue = {
    sessionId,
    channel,
    pendingAgents: [...agents],
    currentAgent: null,
    completedAgents: [],
    startedAt: new Date().toISOString(),
  };

  logger.info(
    "Dispatcher",
    `Starting standup session ${sessionId} in #${channel}`
  );

  if (broadcast) {
    broadcast("standup_session_start", {
      sessionId,
      channel,
      agents,
      timestamp: activeStandupQueue.startedAt,
    });
  }

  // Trigger the first agent
  triggerNextStandupAgent();

  return sessionId;
}

/**
 * Trigger the next agent in the standup queue
 */
function triggerNextStandupAgent(): void {
  if (!activeStandupQueue) {
    return;
  }

  if (activeStandupQueue.pendingAgents.length === 0) {
    // Standup complete
    const session = activeStandupQueue;
    logger.info("Dispatcher", `Standup session ${session.sessionId} complete`);

    if (broadcast) {
      broadcast("standup_session_complete", {
        sessionId: session.sessionId,
        channel: session.channel,
        completedAgents: session.completedAgents,
        timestamp: new Date().toISOString(),
      });
    }

    activeStandupQueue = null;
    return;
  }

  const nextAgent = activeStandupQueue.pendingAgents.shift()!;
  activeStandupQueue.currentAgent = nextAgent;

  logger.info(
    "Dispatcher",
    `Triggering ${nextAgent} for standup in #${activeStandupQueue.channel}`
  );

  triggerAgentForStandup(
    nextAgent,
    activeStandupQueue.channel,
    activeStandupQueue.sessionId
  );
}

/**
 * Trigger a specific agent for standup using their resumed session
 */
function triggerAgentForStandup(
  agent: string,
  channel: string,
  standupSessionId: string
): void {
  // Get agent session (shared across all contexts)
  const sessionId = getSessionId(agent);
  const state = ensureAgentState(agent);

  state.lastTriggerTime = Date.now();
  state.lastActiveStart = Date.now();
  state.lastOutputTime = Date.now();
  state.triggerCount++;

  if (broadcast) {
    broadcast("agent_triggered", {
      agent,
      sessionId,
      channel,
      reason: "standup",
      standupSessionId,
      timestamp: new Date().toISOString(),
      triggerCount: state.triggerCount,
    });
  }

  try {
    const header = buildDispatchContext({
      timestamp: new Date().toISOString(),
      agent_id: agent,
      trigger: "standup",
      source: `channel:${channel}`,
      sender: null,
      channel,
    });

    const prompt =
      header +
      `A standup has been requested in #${channel} for ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}. Please provide your daily update using the /respond-standup skill. Read the channel first to see any previous updates from teammates.`;

    spawnClaudeSession(agent, sessionId, prompt, (exitCode) => {
      if (state.activeProcess === null) {
        return; // Watchdog already cleaned up
      }
      state.activeProcess = null;
      state.lastExitCode = exitCode;
      state.lastActiveStart = null;
      state.lastOutputTime = null;

      logger.info("Dispatcher", `${agent} standup session ended`, {
        exitCode,
      });

      if (broadcast) {
        broadcast("agent_session_ended", {
          agent,
          sessionId,
          channel,
          reason: "standup",
          exitCode,
          timestamp: new Date().toISOString(),
        });
      }
    });
  } catch (error) {
    logger.error("Dispatcher", `Failed to trigger ${agent} for standup`, {
      error: error instanceof Error ? error.message : String(error),
    });
    state.activeProcess = null;
    state.lastActiveStart = null;

    if (broadcast) {
      broadcast("agent_trigger_failed", {
        agent,
        channel,
        reason: "standup",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }

    // Try next agent on failure
    if (activeStandupQueue) {
      activeStandupQueue.currentAgent = null;
      triggerNextStandupAgent();
    }
  }
}

/**
 * Called when a channel message is written - advances standup queue if applicable
 */
export function onStandupChannelMessage(
  channel: string,
  from: string,
  content: string
): void {
  if (!activeStandupQueue) {
    return;
  }

  if (channel !== activeStandupQueue.channel) {
    return;
  }

  if (from !== activeStandupQueue.currentAgent) {
    return;
  }

  logger.info("Dispatcher", `${from} completed standup in #${channel}`);

  // Mark agent as completed
  activeStandupQueue.completedAgents.push(from);
  activeStandupQueue.currentAgent = null;

  // Save to standup database for history
  postStandup(from, content, activeStandupQueue.sessionId);

  if (broadcast) {
    broadcast("standup_agent_complete", {
      sessionId: activeStandupQueue.sessionId,
      agent: from,
      content,
      channel,
      timestamp: new Date().toISOString(),
    });
  }

  // Trigger next agent
  triggerNextStandupAgent();
}

/**
 * Get current standup queue status
 */
export function getStandupQueueStatus(): StandupQueue | null {
  return activeStandupQueue ? { ...activeStandupQueue } : null;
}

// Orchestrator concurrency guard
let activeOrchestratorProcess: {
  sessionId: string;
  command: string;
  startedAt: string;
} | null = null;

/**
 * Trigger an orchestrator session from the dashboard.
 * Spawns a fresh Claude CLI session with the appropriate skill prompt.
 */
export function triggerOrchestrator(
  command: "decompose" | "status",
  params: { task?: string; epic_id?: string; channel: string }
): { success: boolean; session_id?: string; error?: string } {
  if (activeOrchestratorProcess) {
    return {
      success: false,
      error: `Orchestrator is already running (${activeOrchestratorProcess.command}, session: ${activeOrchestratorProcess.sessionId})`,
    };
  }

  const sessionId = crypto.randomUUID();

  let prompt: string;
  if (command === "decompose") {
    const header = buildDispatchContext({
      timestamp: new Date().toISOString(),
      agent_id: "orchestrator",
      trigger: "orchestrate",
      source: "dashboard:orchestrate:decompose",
      sender: "user",
      channel: params.channel,
    });

    prompt =
      header +
      `The user has requested task decomposition from the dashboard. The task is:\n\n${params.task}\n\n` +
      "Run the /orchestrate:decompose skill with this task. " +
      "IMPORTANT: The user has already approved this from the dashboard, so skip the approval gate (do NOT use AskUserQuestion). " +
      "Proceed directly with creating the epic and issues. " +
      `Post all output and progress updates to the #${params.channel} channel using channel_write. ` +
      "To dispatch work to agents, you MUST use the message_send tool to DM each agent directly. " +
      "Do NOT rely on @mentions in channel messages — they do not trigger agents. " +
      "Post a summary to the channel, but send individual DMs to assign work.";
  } else {
    const header = buildDispatchContext({
      timestamp: new Date().toISOString(),
      agent_id: "orchestrator",
      trigger: "orchestrate",
      source: "dashboard:orchestrate:status",
      sender: "user",
      channel: params.channel,
    });

    prompt =
      header +
      `The user has requested an epic status check from the dashboard. The epic ID is: ${params.epic_id}\n\n` +
      "Run the /orchestrate:status skill for this epic. " +
      `Post all output and progress updates to the #${params.channel} channel using channel_write. ` +
      "If you need to notify agents of unblocked work, use message_send to DM them directly. " +
      "Do NOT rely on @mentions in channel messages — they do not trigger agents.";
  }

  activeOrchestratorProcess = {
    sessionId,
    command,
    startedAt: new Date().toISOString(),
  };

  // Initialize watchdog state for orchestrator
  const orchState = ensureAgentState("orchestrator");
  orchState.lastActiveStart = Date.now();
  orchState.lastOutputTime = Date.now();

  if (broadcast) {
    broadcast("orchestrator_started", {
      sessionId,
      command,
      channel: params.channel,
      task: params.task,
      epic_id: params.epic_id,
      timestamp: activeOrchestratorProcess.startedAt,
    });
  }

  try {
    spawnClaudeSession(
      "orchestrator",
      sessionId,
      prompt,
      (exitCode) => {
        // Guard: if watchdog already cleaned up, skip duplicate cleanup
        const orchState = ensureAgentState("orchestrator");
        if (orchState.activeProcess === null) {
          return;
        }

        const ended = activeOrchestratorProcess;
        activeOrchestratorProcess = null;

        // Clean up agent-level state so dashboard sees Idle
        orchState.activeProcess = null;
        orchState.lastExitCode = exitCode;
        orchState.lastActiveStart = null;
        orchState.lastOutputTime = null;

        logger.info("Dispatcher", `Orchestrator ${command} session ended`, {
          sessionId,
          exitCode,
        });

        if (broadcast) {
          if (exitCode === 0) {
            broadcast("orchestrator_ended", {
              sessionId,
              command,
              channel: params.channel,
              exitCode,
              timestamp: new Date().toISOString(),
              startedAt: ended?.startedAt,
            });
          } else {
            broadcast("orchestrator_failed", {
              sessionId,
              command,
              channel: params.channel,
              exitCode,
              timestamp: new Date().toISOString(),
              startedAt: ended?.startedAt,
            });
          }
        }
      },
      "create"
    );

    logger.info("Dispatcher", `Orchestrator ${command} session started`, {
      sessionId,
      channel: params.channel,
    });

    return { success: true, session_id: sessionId };
  } catch (error) {
    activeOrchestratorProcess = null;

    // Clean up agent-level state so dashboard sees Idle
    const orchState = ensureAgentState("orchestrator");
    orchState.activeProcess = null;
    orchState.lastExitCode = -1;
    orchState.lastActiveStart = null;

    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("Dispatcher", `Failed to start orchestrator ${command}`, {
      error: errorMsg,
    });

    if (broadcast) {
      broadcast("orchestrator_failed", {
        sessionId,
        command,
        channel: params.channel,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      });
    }

    return { success: false, error: errorMsg };
  }
}
