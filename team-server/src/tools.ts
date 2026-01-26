import {
  sendMessage,
  listMessages,
  markMessageRead,
  getThread,
  postStandup,
  getTodayStandups,
  updateStatus,
  getTeamStatus,
  getTeamRoster,
} from "./db.js";
import {
  runFullStandup,
  getSession,
  generateSummary,
} from "./orchestrator.js";

// Get agent ID from environment
const getAgentId = (): string => {
  const agentId = process.env.AGENT_ID;
  if (!agentId) {
    throw new Error("AGENT_ID environment variable not set");
  }
  return agentId;
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
          description:
            'Recipient agent ID (alice, bob, charlie) or "team" for broadcast',
        },
        content: {
          type: "string",
          description: "Message content",
        },
        thread_id: {
          type: "string",
          description: "Optional thread ID to reply to an existing conversation",
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
    description: "Update the current agent's status and what they're working on.",
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
    description: "Get the list of all team members with their roles and expertise.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "standup_orchestrate",
    description:
      "Start a full standup session, spawning each agent (Alice → Bob → Charlie) sequentially. Each agent sees previous updates. Returns the complete session with all updates.",
    inputSchema: {
      type: "object" as const,
      properties: {},
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
      const session = await runFullStandup();
      return {
        success: true,
        session_id: session.id,
        date: session.date,
        status: session.status,
        updates: session.updates,
        summary: generateSummary(session),
      };
    }

    case "standup_session_get": {
      const { session_id } = args as { session_id: string };
      const session = getSession(session_id);
      if (!session) {
        return { error: `Session ${session_id} not found` };
      }
      return {
        session_id: session.id,
        date: session.date,
        status: session.status,
        updates: session.updates,
        summary: generateSummary(session),
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
