import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDispatchableAgentIds, isDispatchableAgent } from "./agents.js";
import {
  appendChannelMessage,
  type ChannelMessage,
  getUnreadChannelMessages,
  isValidChannel,
  listChannels,
  markChannelRead,
  readChannelMessages,
} from "./channels.js";
import {
  getAgentSession,
  getStandupsBySession,
  getTeamRoster,
  getTeamStatus,
  getThread,
  getTodayStandups,
  listMessages,
  markMessageRead,
  postStandup,
  sendMessage,
  updateStatus,
} from "./db.js";
import {
  buildDispatchContext,
  getStandupQueueStatus,
  startStandupQueue,
} from "./dispatcher.js";
import { logger } from "./logger.js";
import {
  listAgentSessions,
  readAgentSession,
  searchAgentSessions,
} from "./session-logs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");

// Safeguard constants for ask_agent
const MAX_ASK_DEPTH = 3;
const MAX_ASK_CALLS_PER_SESSION = 10;
const ASK_TIMEOUT_MS = 60_000; // 60 seconds

// Track call count per session (resets when process restarts)
let askCallCount = 0;

// Get agent ID from environment
const getAgentId = (): string => {
  const agentId = process.env.AGENT_ID;
  if (!agentId) {
    throw new Error("AGENT_ID environment variable not set");
  }
  return agentId;
};

// Get current ask depth from environment
const getAskDepth = (): number => {
  return Number.parseInt(process.env.ASK_DEPTH || "0");
};

// Get caller chain to prevent callbacks
const getCallerChain = (): string[] => {
  const chain = process.env.ASK_CALLER_CHAIN || "";
  return chain ? chain.split(",") : [];
};

// Tool definitions for MCP
export const toolDefinitions = [
  {
    name: "message_send",
    description:
      "Send a message to another team member or broadcast to the team. The sender is automatically set from AGENT_ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        to: {
          type: "string",
          description: 'Recipient agent ID or "team" for broadcast',
        },
        content: {
          type: "string",
          description: "Message content",
        },
        thread_id: {
          type: "string",
          description:
            "Optional thread ID to reply to an existing conversation",
        },
      },
      required: ["to", "content"],
    },
  },
  {
    name: "message_list",
    description:
      "List messages for the current agent. Can filter by unread only or specific thread.",
    inputSchema: {
      type: "object" as const,
      properties: {
        unread_only: {
          type: "boolean",
          description: "Only show unread messages",
          default: false,
        },
        thread_id: {
          type: "string",
          description: "Filter to specific thread",
        },
      },
    },
  },
  {
    name: "message_mark_read",
    description: "Mark a message as read by the current agent.",
    inputSchema: {
      type: "object" as const,
      properties: {
        message_id: {
          type: "string",
          description: "ID of the message to mark as read",
        },
      },
      required: ["message_id"],
    },
  },
  {
    name: "message_thread",
    description: "Get all messages in a specific thread.",
    inputSchema: {
      type: "object" as const,
      properties: {
        thread_id: {
          type: "string",
          description: "Thread ID to retrieve",
        },
      },
      required: ["thread_id"],
    },
  },
  {
    name: "standup_post",
    description:
      "Post a standup update for the current agent. Content should follow Yesterday/Today/Blockers format.",
    inputSchema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "Standup update content",
        },
        session_id: {
          type: "string",
          description: "Optional session ID to group standup updates",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "standup_today",
    description: "Get all standup updates posted today.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "status_update",
    description:
      "Update the current agent's status and what they're working on.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["active", "idle", "offline"],
          description: "Current status",
        },
        working_on: {
          type: "string",
          description: "Description of current work",
        },
        beads_id: {
          type: "string",
          description: "Associated beads issue ID",
        },
      },
      required: ["status"],
    },
  },
  {
    name: "status_team",
    description: "Get the current status of all team members.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "team_roster",
    description:
      "Get the list of all team members with their roles and expertise.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "standup_orchestrate",
    description:
      "Start a full standup session, triggering each dispatchable agent sequentially via their resumed sessions. Each agent posts their update to the specified channel (defaults to #team). Returns immediately with session ID - use standup_session_get to check progress.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel: {
          type: "string",
          description:
            'Channel where agents post their standup updates (default: "team")',
        },
      },
    },
  },
  {
    name: "standup_session_get",
    description: "Get details of a standup session by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_id: {
          type: "string",
          description: "The session ID to retrieve",
        },
      },
      required: ["session_id"],
    },
  },
  {
    name: "ask_agent",
    description:
      "Ask another agent a question and wait for their response (synchronous). Use this when you need immediate input from a teammate to continue your work. The other agent's session will be invoked directly and their response returned to you. For notifications or handoffs that don't need an immediate response, use message_send instead.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agent: {
          type: "string",
          description: "The agent to ask (any dispatchable agent)",
        },
        question: {
          type: "string",
          description: "The question or request for the other agent",
        },
      },
      required: ["agent", "question"],
    },
  },
  {
    name: "channel_read",
    description:
      "Read recent messages from a team channel. Use this to see channel discussions and respond to @mentions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel: {
          type: "string",
          description: "The channel to read from (e.g., general)",
        },
        limit: {
          type: "number",
          description: "Maximum number of messages to return (default 20)",
          default: 20,
        },
        unread_only: {
          type: "boolean",
          description:
            "Only return messages since your last read (default false)",
          default: false,
        },
      },
      required: ["channel"],
    },
  },
  {
    name: "channel_write",
    description:
      "Post a message to a team channel. Use this to respond to channel discussions or @mentions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel: {
          type: "string",
          description: "The channel to post to (e.g., general)",
        },
        content: {
          type: "string",
          description: "Message content to post",
        },
      },
      required: ["channel", "content"],
    },
  },
  {
    name: "channel_list",
    description: "List available team channels the agent can access.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "session_list",
    description:
      "List your past conversation sessions. Returns session metadata including start/end times and event counts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of sessions to return (default 20)",
          default: 20,
        },
      },
    },
  },
  {
    name: "session_read",
    description:
      "Read the transcript of a specific conversation session. Returns all logged events (tool uses, prompts, errors) for that session.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_id: {
          type: "string",
          description: "The session ID to read",
        },
        limit: {
          type: "number",
          description: "Maximum number of events to return (default 100)",
          default: 100,
        },
        offset: {
          type: "number",
          description: "Number of events to skip (default 0)",
          default: 0,
        },
      },
      required: ["session_id"],
    },
  },
  {
    name: "session_search",
    description:
      "Search across your conversation sessions for specific text. Searches tool names, prompts, errors, and other event fields.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Text to search for (case-insensitive)",
        },
        event_types: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional filter by event types (e.g. PreToolUse, PostToolUseFailure)",
        },
        limit: {
          type: "number",
          description: "Maximum number of matches to return (default 20)",
          default: 20,
        },
      },
      required: ["query"],
    },
  },
];

// Tool handlers
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const agentId = getAgentId();

  switch (name) {
    case "message_send": {
      const { to, content, thread_id } = args as {
        to: string;
        content: string;
        thread_id?: string;
      };
      const messageId = sendMessage(agentId, to, content, thread_id);
      const result = {
        success: true,
        message_id: messageId,
        from: agentId,
        to,
        thread_id: thread_id || messageId,
        timestamp: new Date().toISOString(),
      };

      // Notify HTTP server to broadcast (fire and forget)
      const webPort = process.env.WEB_PORT || "3030";
      fetch(`http://localhost:${webPort}/api/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "message", data: result }),
      }).catch(() => {}); // Ignore errors - server may not be running

      return result;
    }

    case "message_list": {
      const { unread_only, thread_id } = args as {
        unread_only?: boolean;
        thread_id?: string;
      };
      const messages = listMessages(agentId, {
        unreadOnly: unread_only,
        threadId: thread_id,
      });
      return {
        agent: agentId,
        count: messages.length,
        messages: messages.map((m) => ({
          ...m,
          read_by: JSON.parse(m.read_by),
        })),
      };
    }

    case "message_mark_read": {
      const { message_id } = args as { message_id: string };
      markMessageRead(message_id, agentId);
      return { success: true, message_id, marked_by: agentId };
    }

    case "message_thread": {
      const { thread_id } = args as { thread_id: string };
      const messages = getThread(thread_id);
      return {
        thread_id,
        count: messages.length,
        messages: messages.map((m) => ({
          ...m,
          read_by: JSON.parse(m.read_by),
        })),
      };
    }

    case "standup_post": {
      const { content, session_id } = args as {
        content: string;
        session_id?: string;
      };
      const standupId = postStandup(agentId, content, session_id);
      return {
        success: true,
        standup_id: standupId,
        agent: agentId,
        date: new Date().toISOString().split("T")[0],
      };
    }

    case "standup_today": {
      const standups = getTodayStandups();
      return {
        date: new Date().toISOString().split("T")[0],
        count: standups.length,
        standups,
      };
    }

    case "status_update": {
      const { status, working_on, beads_id } = args as {
        status: "active" | "idle" | "offline";
        working_on?: string;
        beads_id?: string;
      };
      updateStatus(agentId, status, working_on, beads_id);
      return {
        success: true,
        agent: agentId,
        status,
        working_on,
        beads_id,
      };
    }

    case "status_team": {
      const statuses = getTeamStatus();
      return {
        count: statuses.length,
        team: statuses,
      };
    }

    case "team_roster": {
      const roster = getTeamRoster();
      return {
        count: roster.length,
        members: roster,
      };
    }

    case "standup_orchestrate": {
      // Check if a standup is already in progress
      const existingQueue = getStandupQueueStatus();
      if (existingQueue) {
        return {
          success: false,
          error: "A standup session is already in progress",
          session_id: existingQueue.sessionId,
          current_agent: existingQueue.currentAgent,
        };
      }

      const channel = (args as { channel?: string }).channel || "team";
      const sessionId = startStandupQueue(channel);

      return {
        success: true,
        session_id: sessionId,
        channel,
        message:
          "Standup session started. Agents will respond sequentially in the channel.",
        agents: getDispatchableAgentIds(),
      };
    }

    case "standup_session_get": {
      const { session_id } = args as { session_id: string };

      // Check if it's the active queue
      const queue = getStandupQueueStatus();
      if (queue && queue.sessionId === session_id) {
        return {
          session_id,
          status: "in_progress",
          channel: queue.channel,
          current_agent: queue.currentAgent,
          completed_agents: queue.completedAgents,
          pending_agents: queue.pendingAgents,
          updates: [],
        };
      }

      // Look up in database
      const standups = getStandupsBySession(session_id);
      if (standups.length === 0) {
        return { error: `Session ${session_id} not found` };
      }

      return {
        session_id,
        status: "completed",
        updates: standups.map((s) => ({
          agent_id: s.agent_id,
          content: s.content,
          timestamp: s.timestamp,
        })),
      };
    }

    case "ask_agent": {
      const { agent, question } = args as { agent: string; question: string };

      // Validate agent is a dispatchable team agent
      if (!isDispatchableAgent(agent)) {
        const validAgents = getDispatchableAgentIds();
        return {
          success: false,
          error: `Unknown agent "${agent}". Valid agents: ${validAgents.join(", ")}`,
        };
      }

      const callerAgent = getAgentId();
      const currentDepth = getAskDepth();
      const callerChain = getCallerChain();

      // Safeguard 1: Depth limit
      if (currentDepth >= MAX_ASK_DEPTH) {
        return {
          success: false,
          error: `Maximum ask depth (${MAX_ASK_DEPTH}) reached. Cannot invoke ${agent}.`,
          suggestion: "Use message_send for async communication instead.",
        };
      }

      // Safeguard 2: Call count limit
      askCallCount++;
      if (askCallCount > MAX_ASK_CALLS_PER_SESSION) {
        return {
          success: false,
          error: `Maximum ask calls (${MAX_ASK_CALLS_PER_SESSION}) per session reached.`,
          suggestion: "Use message_send for async communication instead.",
        };
      }

      // Safeguard 3: No self-calls
      if (agent === callerAgent) {
        return {
          success: false,
          error: "Cannot ask yourself a question.",
        };
      }

      // Safeguard 4: No callback in chain
      if (callerChain.includes(agent)) {
        return {
          success: false,
          error: `Cannot call ${agent} - they are already in the caller chain: ${callerChain.join(" → ")} → ${callerAgent}`,
          suggestion:
            "Use message_send for async communication to avoid circular calls.",
        };
      }

      // Get target agent's session ID from DB
      const sessionId = getAgentSession(PROJECT_ROOT, agent);

      // Build new caller chain
      const newCallerChain = [...callerChain, callerAgent].join(",");

      // Log the invocation
      logger.info("Tools", `${callerAgent} asking ${agent}`, {
        depth: currentDepth + 1,
        maxDepth: MAX_ASK_DEPTH,
      });

      // Broadcast to dashboard that agent conversation is starting
      const webPort = process.env.WEB_PORT || "3030";
      fetch(`http://localhost:${webPort}/api/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "agent_conversation",
          data: {
            from: callerAgent,
            to: agent,
            question,
            status: "started",
            depth: currentDepth + 1,
            timestamp: new Date().toISOString(),
          },
        }),
      }).catch(() => {});

      try {
        const header = buildDispatchContext({
          timestamp: new Date().toISOString(),
          agent_id: agent,
          trigger: "ask_agent",
          source: `ask_agent:${callerAgent}`,
          sender: callerAgent,
          message_preview: question.slice(0, 200),
        });

        const prompt =
          header +
          `You are being asked a question by ${callerAgent}. Please respond directly and concisely.\n\nQuestion: ${question}`;

        const proc = Bun.spawn(["claude", "-r", sessionId, prompt, "-p"], {
          cwd: PROJECT_ROOT,
          stdout: "pipe",
          stderr: "pipe",
          env: {
            ...process.env,
            AGENT_ID: agent,
            ASK_DEPTH: String(currentDepth + 1),
            ASK_CALLER_CHAIN: newCallerChain,
          },
        });

        // Wait for completion with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Timeout")), ASK_TIMEOUT_MS);
        });

        const exitCode = await Promise.race([proc.exited, timeoutPromise]);

        if (exitCode !== 0) {
          return {
            success: false,
            error: `Agent ${agent} session exited with code ${exitCode}`,
          };
        }

        // Capture response
        const response = await new Response(proc.stdout).text();

        // Broadcast completion to dashboard
        fetch(`http://localhost:${webPort}/api/broadcast`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "agent_conversation",
            data: {
              from: callerAgent,
              to: agent,
              question,
              response:
                response.trim().slice(0, 200) +
                (response.length > 200 ? "..." : ""),
              status: "completed",
              depth: currentDepth + 1,
              timestamp: new Date().toISOString(),
            },
          }),
        }).catch(() => {});

        return {
          success: true,
          agent,
          response: response.trim(),
          depth: currentDepth + 1,
          call_count: askCallCount,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "Timeout") {
          return {
            success: false,
            error: `Agent ${agent} did not respond within ${ASK_TIMEOUT_MS / 1000} seconds.`,
            suggestion:
              "The agent may be busy. Try message_send for async communication.",
          };
        }
        return {
          success: false,
          error: `Failed to invoke ${agent}: ${message}`,
        };
      }
    }

    case "channel_read": {
      const {
        channel,
        limit = 20,
        unread_only = false,
      } = args as {
        channel: string;
        limit?: number;
        unread_only?: boolean;
      };

      if (!isValidChannel(channel)) {
        return {
          error: `Channel not found: ${channel}`,
        };
      }

      let messages: ChannelMessage[];
      if (unread_only) {
        messages = getUnreadChannelMessages(channel, agentId);
        // Mark channel as read when fetching unread
        if (messages.length > 0) {
          const latestTimestamp = messages[messages.length - 1].timestamp;
          markChannelRead(channel, agentId, latestTimestamp);
        }
      } else {
        messages = readChannelMessages(channel, limit);
      }

      return {
        channel,
        count: messages.length,
        messages,
        unread_only,
      };
    }

    case "channel_write": {
      const { channel, content } = args as {
        channel: string;
        content: string;
      };

      if (!isValidChannel(channel)) {
        return {
          error: `Channel not found: ${channel}`,
        };
      }

      if (!(content && content.trim())) {
        return { error: "Message content cannot be empty" };
      }

      const message = appendChannelMessage(channel, agentId, content);

      // Notify HTTP server to broadcast (fire and forget)
      const webPort = process.env.WEB_PORT || "3030";
      fetch(`http://localhost:${webPort}/api/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "channel_message",
          data: { channel, message },
        }),
      }).catch(() => {});

      return {
        success: true,
        channel,
        message,
      };
    }

    case "channel_list": {
      const channels = listChannels();
      return {
        channels: channels.map((c) => ({
          id: c,
          name: c === "team" ? "#team" : `#${c}`,
          description:
            c === "team"
              ? "General team discussions and announcements"
              : "Research discussions and collaboration",
        })),
      };
    }

    case "session_list": {
      const { limit = 20 } = args as { limit?: number };
      const sessions = listAgentSessions(agentId, limit);
      return {
        agent: agentId,
        count: sessions.length,
        sessions,
      };
    }

    case "session_read": {
      const {
        session_id,
        limit = 100,
        offset = 0,
      } = args as {
        session_id: string;
        limit?: number;
        offset?: number;
      };
      const session = readAgentSession(agentId, session_id, limit, offset);
      if (!session) {
        return { error: `Session ${session_id} not found` };
      }
      return session;
    }

    case "session_search": {
      const {
        query,
        event_types,
        limit = 20,
      } = args as {
        query: string;
        event_types?: string[];
        limit?: number;
      };
      return searchAgentSessions(agentId, query, limit, event_types);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
