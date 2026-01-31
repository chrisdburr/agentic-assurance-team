import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { serve } from "bun";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import {
  type CreateAgentInput,
  createAgent,
  deleteAgent,
  generateSystemPrompt,
  getAgentById,
  getDispatchableAgentIds,
  isDispatchableAgent,
  listAgents,
  updateAgent,
} from "./agents.js";
import {
  appendChannelMessage,
  type ChannelMessage,
  canAccessChannel,
  isValidChannel,
  listChannels,
  listChannelsForUser,
  onChannelMessage,
  readChannelMessages,
} from "./channels.js";
import {
  addChannelMember,
  createChannel,
  createUser,
  deleteChannel,
  deleteUser,
  getAllChannels,
  getAllMessages,
  getAllUsers,
  getChannelById,
  getChannelMemberRole,
  getChannelMembers,
  getMessagesByFromAgent,
  getMessagesByToAgent,
  getStandupsByDate,
  getStandupsBySession,
  getTeamRoster,
  getTeamStatus,
  getThread,
  getTodayStandups,
  getUnreadMessages,
  getUserById,
  isChannelMember,
  isUserAdmin,
  removeChannelMember,
  sendMessage,
  transferChannelOwnership,
  updatePassword,
  updateUser,
  validatePassword,
} from "./db.js";
import {
  getDispatcherStatus,
  getStandupQueueStatus,
  initDispatcher,
  manualTrigger,
  onStandupChannelMessage,
  refreshAgentSession,
  startStandupQueue,
  triggerAgentForChannel,
  triggerOrchestrator,
} from "./dispatcher.js";
import { logger } from "./logger.js";
import {
  getRecentEventsAcrossAgents,
  listAgentSessions,
  readAgentSession,
  searchAgentSessions,
} from "./session-logs.js";
import { handleToolCall, toolDefinitions } from "./tools.js";

// Parse @mentions from message content (for DMs - channels use channels.ts version)
// Supports @agentname and @team (expands to all dispatchable agents)
function parseDMMentions(content: string): string[] {
  const dispatchable = getDispatchableAgentIds();
  const pattern =
    dispatchable.length > 0
      ? `@(${dispatchable.join("|")}|team)\\b`
      : "@(team)\\b";
  const mentionRegex = new RegExp(pattern, "gi");
  const matches = content.match(mentionRegex) || [];

  const mentions = new Set<string>();
  for (const match of matches) {
    const mention = match.slice(1).toLowerCase(); // Remove @ and lowercase
    if (mention === "team") {
      for (const id of dispatchable) {
        mentions.add(id);
      }
    } else {
      mentions.add(mention);
    }
  }

  return Array.from(mentions);
}

// Trigger mentioned agents for a channel message
function triggerMentionedAgents(
  channel: string,
  message: ChannelMessage
): Promise<void> {
  for (const agentId of message.mentions) {
    // Only trigger dispatchable agents
    if (isDispatchableAgent(agentId)) {
      logger.info(
        "Channel",
        `Triggering ${agentId} for @mention in #${channel}`
      );
      triggerAgentForChannel(
        agentId,
        channel,
        message.from,
        message.content.slice(0, 200)
      );
    }
  }
}

const WEB_PORT = Number.parseInt(process.env.WEB_PORT || "3030");
const isMcpMode = process.argv.includes("--mcp");

// WebSocket clients for real-time updates
const wsClients = new Set<{ send: (data: string) => void }>();

function broadcast(event: string, data: unknown) {
  const message = JSON.stringify({
    type: event,
    data,
    timestamp: new Date().toISOString(),
  });
  for (const client of wsClients) {
    try {
      client.send(message);
    } catch {
      wsClients.delete(client);
    }
  }
}

// Wrap tool handler to broadcast updates
async function handleToolCallWithBroadcast(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const result = await handleToolCall(name, args);

  // Broadcast relevant events
  if (name === "message_send") {
    broadcast("message", result);
  } else if (name === "standup_post") {
    broadcast("standup", result);
  } else if (name === "status_update") {
    broadcast("status", result);
  }

  return result;
}

// MCP Server setup
async function runMcpServer() {
  const server = new Server(
    {
      name: "team-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await handleToolCallWithBroadcast(name, args || {});
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP", "Team MCP server running on stdio");
}

// HTTP Server setup with Hono
function runHttpServer() {
  const app = new Hono();

  // Serve static files from public directory
  app.use("/static/*", serveStatic({ root: "./public" }));
  app.get("/", serveStatic({ path: "./public/index.html" }));

  // API Routes
  app.get("/api/messages", (c) => {
    const limit = Number.parseInt(c.req.query("limit") || "100");
    const toAgent = c.req.query("to_agent");
    const fromAgent = c.req.query("from_agent");

    let messages;
    if (toAgent) {
      messages = getMessagesByToAgent(toAgent, limit);
    } else if (fromAgent) {
      messages = getMessagesByFromAgent(fromAgent, limit);
    } else {
      messages = getAllMessages(limit);
    }
    return c.json({ messages });
  });

  // POST /api/messages - Send a new message
  const MAX_CONTENT_LENGTH = 10_000;
  app.post("/api/messages", async (c) => {
    try {
      const body = await c.req.json();
      const { to, content, thread_id } = body;

      // Validation
      if (!to || typeof to !== "string") {
        return c.json(
          { success: false, error: "Missing or invalid 'to' field" },
          400
        );
      }
      if (!content || typeof content !== "string" || !content.trim()) {
        return c.json(
          { success: false, error: "Missing or invalid 'content' field" },
          400
        );
      }
      if (content.length > MAX_CONTENT_LENGTH) {
        return c.json(
          {
            success: false,
            error: `Content exceeds maximum length of ${MAX_CONTENT_LENGTH}`,
          },
          400
        );
      }

      // Parse @mentions from content (for DMs)
      const mentions = parseDMMentions(content);

      // Always use "user" for PWA messages - prevents impersonation
      const fromAgent = "user";
      const messageId = sendMessage(
        fromAgent,
        to,
        content,
        thread_id,
        mentions
      );

      const result = {
        success: true,
        message_id: messageId,
        from: fromAgent,
        to,
        thread_id: thread_id || messageId,
        timestamp: new Date().toISOString(),
        mentions,
      };

      // Broadcast to WebSocket clients
      broadcast("message", result);

      // Immediately trigger the recipient agent if it's an AI agent
      // This provides faster response than waiting for polling
      // Pass username so the agent knows who sent the message
      if (isDispatchableAgent(to)) {
        const username = c.req.header("x-username") || "user";
        const triggerResult = manualTrigger(
          to,
          username,
          content.slice(0, 200)
        );
        if (!triggerResult.success) {
          logger.error(
            "API",
            `Failed to trigger ${to}: ${triggerResult.error}`
          );
        }
      }

      return c.json(result, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ success: false, error: message }, 500);
    }
  });

  // Unread messages endpoint for stop hook (must come before :threadId route)
  app.get("/api/messages/unread/:agentId", (c) => {
    const agentId = c.req.param("agentId");
    const { count, messages } = getUnreadMessages(agentId);
    return c.json({ agent_id: agentId, count, messages });
  });

  app.get("/api/messages/:threadId", (c) => {
    const threadId = c.req.param("threadId");
    const messages = getThread(threadId);
    return c.json({ thread_id: threadId, messages });
  });

  app.get("/api/standups", (c) => {
    const date = c.req.query("date");
    const standups = date ? getStandupsByDate(date) : getTodayStandups();
    return c.json({
      date: date || new Date().toISOString().split("T")[0],
      standups,
    });
  });

  app.get("/api/standups/:date", (c) => {
    const date = c.req.param("date");
    const standups = getStandupsByDate(date);
    return c.json({ date, standups });
  });

  app.get("/api/status", (c) => {
    const statuses = getTeamStatus();
    return c.json({ team: statuses });
  });

  app.get("/api/roster", (c) => {
    const roster = getTeamRoster();
    return c.json({ members: roster });
  });

  // Health check
  app.get("/api/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth endpoints
  app.post("/api/auth/validate", async (c) => {
    try {
      const body = await c.req.json();
      const { username, password } = body;

      if (!(username && password)) {
        return c.json({ valid: false, error: "Missing credentials" }, 400);
      }

      const user = await validatePassword(username, password);
      if (!user) {
        return c.json({ valid: false });
      }

      return c.json({
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          is_admin: user.is_admin,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ valid: false, error: message }, 500);
    }
  });

  app.post("/api/auth/change-password", async (c) => {
    try {
      const body = await c.req.json();
      const { userId, currentPassword, newPassword } = body;

      if (!(userId && currentPassword && newPassword)) {
        return c.json(
          { success: false, error: "Missing required fields" },
          400
        );
      }

      if (newPassword.length < 8) {
        return c.json(
          {
            success: false,
            error: "New password must be at least 8 characters",
          },
          400
        );
      }

      // Get user and verify current password
      const user = getUserById(userId);
      if (!user) {
        return c.json({ success: false, error: "User not found" }, 404);
      }

      const isValid = await validatePassword(user.username, currentPassword);
      if (!isValid) {
        return c.json(
          { success: false, error: "Current password is incorrect" },
          401
        );
      }

      // Update password
      await updatePassword(userId, newPassword);

      return c.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ success: false, error: message }, 500);
    }
  });

  // User management endpoints (admin only)
  app.get("/api/users", (c) => {
    const userId = getUserIdFromRequest(c);
    if (!(userId && isUserAdmin(userId))) {
      return c.json({ error: "Admin access required" }, 403);
    }

    const users = getAllUsers();
    return c.json({ users });
  });

  app.post("/api/users", async (c) => {
    const userId = getUserIdFromRequest(c);
    if (!(userId && isUserAdmin(userId))) {
      return c.json({ error: "Admin access required" }, 403);
    }

    try {
      const body = await c.req.json();
      const { username, email, password, is_admin } = body;

      if (!username || typeof username !== "string" || !username.trim()) {
        return c.json({ error: "Username is required" }, 400);
      }
      if (!email || typeof email !== "string" || !email.trim()) {
        return c.json({ error: "Email is required" }, 400);
      }
      if (!password || typeof password !== "string" || password.length < 8) {
        return c.json({ error: "Password must be at least 8 characters" }, 400);
      }

      const user = await createUser(
        username.trim(),
        email.trim(),
        password,
        is_admin === true
      );

      // Return user without password_hash
      return c.json(
        {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            is_admin: user.is_admin,
            created_at: user.created_at,
            updated_at: user.updated_at,
          },
        },
        201
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("UNIQUE constraint")) {
        return c.json({ error: "Username or email already exists" }, 409);
      }
      return c.json({ error: message }, 500);
    }
  });

  app.patch("/api/users/:id", async (c) => {
    const adminUserId = getUserIdFromRequest(c);
    if (!(adminUserId && isUserAdmin(adminUserId))) {
      return c.json({ error: "Admin access required" }, 403);
    }

    const targetUserId = c.req.param("id");
    const existingUser = getUserById(targetUserId);
    if (!existingUser) {
      return c.json({ error: "User not found" }, 404);
    }

    try {
      const body = await c.req.json();
      const { email, is_admin } = body;

      const updates: { email?: string; is_admin?: boolean } = {};
      if (email !== undefined) {
        if (typeof email !== "string" || !email.trim()) {
          return c.json({ error: "Invalid email" }, 400);
        }
        updates.email = email.trim();
      }
      if (is_admin !== undefined) {
        updates.is_admin = is_admin === true;
      }

      const success = updateUser(targetUserId, updates);
      if (!success) {
        return c.json({ error: "Failed to update user" }, 500);
      }

      const updatedUser = getUserById(targetUserId);
      return c.json({
        success: true,
        user: {
          id: updatedUser?.id,
          username: updatedUser?.username,
          email: updatedUser?.email,
          is_admin: updatedUser?.is_admin,
          created_at: updatedUser?.created_at,
          updated_at: updatedUser?.updated_at,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("UNIQUE constraint")) {
        return c.json({ error: "Email already exists" }, 409);
      }
      return c.json({ error: message }, 500);
    }
  });

  app.delete("/api/users/:id", (c) => {
    const adminUserId = getUserIdFromRequest(c);
    if (!(adminUserId && isUserAdmin(adminUserId))) {
      return c.json({ error: "Admin access required" }, 403);
    }

    const targetUserId = c.req.param("id");

    // Prevent self-deletion
    if (targetUserId === adminUserId) {
      return c.json({ error: "Cannot delete your own account" }, 400);
    }

    const existingUser = getUserById(targetUserId);
    if (!existingUser) {
      return c.json({ error: "User not found" }, 404);
    }

    const success = deleteUser(targetUserId);
    if (!success) {
      return c.json({ error: "Failed to delete user" }, 500);
    }

    return c.json({ success: true });
  });

  // Broadcast endpoint for MCP processes to notify WebSocket clients
  app.post("/api/broadcast", async (c) => {
    try {
      const { type, data } = await c.req.json();
      broadcast(type, data);

      // Check for standup queue advancement when agent posts to channel
      if (type === "channel_message" && data?.channel && data?.message) {
        onStandupChannelMessage(
          data.channel,
          data.message.from,
          data.message.content
        );
      }

      return c.json({ success: true });
    } catch (error) {
      return c.json({ success: false }, 400);
    }
  });

  // Dispatcher endpoints
  app.get("/api/dispatcher/status", (c) => {
    return c.json(getDispatcherStatus());
  });

  app.post("/api/dispatcher/trigger/:agent", (c) => {
    const agent = c.req.param("agent");
    const username = c.req.header("x-username") || undefined;
    const result = manualTrigger(agent, username);
    if (!result.success) {
      return c.json(result, 400);
    }
    return c.json(result);
  });

  app.post("/api/dispatcher/refresh/:agent", async (c) => {
    const agent = c.req.param("agent");
    const body = await c.req.json().catch(() => ({}));
    const force = (body as { force?: boolean }).force === true;
    const result = refreshAgentSession(agent, force);
    if (!result.success) {
      return c.json(result, 400);
    }
    return c.json(result);
  });

  // Standup orchestration endpoints
  app.post("/api/standup/start", async (c) => {
    try {
      // Check if a standup is already in progress
      const existingQueue = getStandupQueueStatus();
      if (existingQueue) {
        return c.json(
          {
            success: false,
            error: "A standup session is already in progress",
            session_id: existingQueue.sessionId,
          },
          400
        );
      }

      const body = await c.req.json().catch(() => ({}));
      const channel = (body as { channel?: string }).channel || "team";
      const sessionId = startStandupQueue(channel);

      return c.json({
        success: true,
        session_id: sessionId,
        channel,
        message:
          "Standup session started. Agents will respond sequentially in the channel.",
        agents: getDispatchableAgentIds(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ success: false, error: message }, 500);
    }
  });

  app.get("/api/standup/session/:sessionId", (c) => {
    const sessionId = c.req.param("sessionId");
    const standups = getStandupsBySession(sessionId);

    if (standups.length === 0) {
      // Check if it's the active queue
      const queue = getStandupQueueStatus();
      if (queue && queue.sessionId === sessionId) {
        return c.json({
          session_id: sessionId,
          status: "in_progress",
          current_agent: queue.currentAgent,
          completed_agents: queue.completedAgents,
          pending_agents: queue.pendingAgents,
          updates: [],
        });
      }
      return c.json({ error: `Session ${sessionId} not found` }, 404);
    }

    return c.json({
      session_id: sessionId,
      status: "completed",
      updates: standups.map((s) => ({
        agent_id: s.agent_id,
        content: s.content,
        timestamp: s.timestamp,
      })),
    });
  });

  // Get current standup queue status
  app.get("/api/standup/status", (c) => {
    const queue = getStandupQueueStatus();
    if (!queue) {
      return c.json({ active: false });
    }
    return c.json({
      active: true,
      session_id: queue.sessionId,
      channel: queue.channel,
      current_agent: queue.currentAgent,
      completed_agents: queue.completedAgents,
      pending_agents: queue.pendingAgents,
      started_at: queue.startedAt,
    });
  });

  // Orchestrate endpoints
  app.post("/api/orchestrate/decompose", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { task, channel } = body as { task?: string; channel?: string };

      if (!task || typeof task !== "string" || !task.trim()) {
        return c.json(
          { success: false, error: "Missing or invalid 'task' field" },
          400
        );
      }

      const result = triggerOrchestrator("decompose", {
        task: task.trim(),
        channel: channel || "team",
      });

      if (!result.success) {
        return c.json(result, 400);
      }

      return c.json({
        ...result,
        channel: channel || "team",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ success: false, error: message }, 500);
    }
  });

  app.post("/api/orchestrate/status", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { epic_id, channel } = body as {
        epic_id?: string;
        channel?: string;
      };

      if (!epic_id || typeof epic_id !== "string" || !epic_id.trim()) {
        return c.json(
          { success: false, error: "Missing or invalid 'epic_id' field" },
          400
        );
      }

      const result = triggerOrchestrator("status", {
        epic_id: epic_id.trim(),
        channel: channel || "team",
      });

      if (!result.success) {
        return c.json(result, 400);
      }

      return c.json({
        ...result,
        channel: channel || "team",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ success: false, error: message }, 500);
    }
  });

  // Cross-agent events feed (for monitoring dashboard)
  app.get("/api/events", (c) => {
    const limit = Math.min(
      Number.parseInt(c.req.query("limit") || "50", 10),
      200
    );
    const eventTypesParam = c.req.query("event_types");
    const eventTypes = eventTypesParam ? eventTypesParam.split(",") : undefined;
    const since = c.req.query("since") || undefined;

    const result = getRecentEventsAcrossAgents(limit, eventTypes, since);
    return c.json(result);
  });

  // Session Logs API Routes (for dashboard access to agent conversation history)

  // List sessions for an agent
  app.get("/api/sessions/:agentId", (c) => {
    const agentId = c.req.param("agentId");
    const limit = Number.parseInt(c.req.query("limit") || "20", 10);
    const sessions = listAgentSessions(agentId, limit);
    return c.json({ agent: agentId, count: sessions.length, sessions });
  });

  // Search sessions for an agent (must come before :sessionId route)
  app.get("/api/sessions/:agentId/search", (c) => {
    const agentId = c.req.param("agentId");
    const query = c.req.query("q") || "";
    const limit = Number.parseInt(c.req.query("limit") || "20", 10);
    const eventTypesParam = c.req.query("event_types");
    const eventTypes = eventTypesParam ? eventTypesParam.split(",") : undefined;

    if (!query) {
      return c.json({ error: "Query parameter 'q' is required" }, 400);
    }

    const results = searchAgentSessions(agentId, query, limit, eventTypes);
    return c.json(results);
  });

  // Read a specific session transcript
  app.get("/api/sessions/:agentId/:sessionId", (c) => {
    const agentId = c.req.param("agentId");
    const sessionId = c.req.param("sessionId");
    const limit = Number.parseInt(c.req.query("limit") || "100", 10);
    const offset = Number.parseInt(c.req.query("offset") || "0", 10);

    const session = readAgentSession(agentId, sessionId, limit, offset);
    if (!session) {
      return c.json({ error: `Session ${sessionId} not found` }, 404);
    }
    return c.json(session);
  });

  // Channel API Routes

  // Helper to get user ID from request headers (injected by dashboard proxy)
  function getUserIdFromRequest(c: {
    req: { header: (name: string) => string | undefined };
  }): string | null {
    return c.req.header("x-user-id") || null;
  }

  // List available channels (filtered by user membership)
  app.get("/api/channels", (c) => {
    const userId = getUserIdFromRequest(c);

    // If no user ID (direct API access or agent), return all channels
    const channels = userId ? listChannelsForUser(userId) : listChannels();

    return c.json({
      channels: channels.map((ch) => ({
        id: ch.id,
        name: ch.name,
        description: ch.description,
        owner_id: ch.owner_id,
      })),
    });
  });

  // Create a new channel
  app.post("/api/channels", async (c) => {
    const userId = getUserIdFromRequest(c);

    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    try {
      const body = await c.req.json();
      const { id, name, description } = body;

      if (!id || typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) {
        return c.json(
          { error: "Channel ID must be lowercase alphanumeric with hyphens" },
          400
        );
      }

      if (!name || typeof name !== "string" || !name.trim()) {
        return c.json({ error: "Channel name is required" }, 400);
      }

      // Check if channel already exists
      if (getChannelById(id)) {
        return c.json({ error: "Channel already exists" }, 409);
      }

      // Get project path from environment or use default
      const projectPath = process.env.PROJECT_PATH || process.cwd();

      const channel = createChannel(
        id,
        name.trim(),
        projectPath,
        userId,
        description
      );

      // Add all agents to the new channel by default
      for (const agent of getDispatchableAgentIds()) {
        addChannelMember(id, "agent", agent, "member");
      }

      broadcast("channel_created", { channel });

      return c.json({ success: true, channel }, 201);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ error: msg }, 500);
    }
  });

  // Transfer channel ownership (owner only)
  app.post("/api/channels/:channel/transfer-ownership", async (c) => {
    const channelId = c.req.param("channel");
    const userId = getUserIdFromRequest(c);

    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const channel = getChannelById(channelId);
    if (!channel) {
      return c.json({ error: "Channel not found" }, 404);
    }

    // System channels cannot be transferred
    if (channel.owner_id === "system") {
      return c.json({ error: "System channels cannot be transferred" }, 403);
    }

    // Only owner can transfer ownership
    if (channel.owner_id !== userId) {
      return c.json(
        { error: "Only the channel owner can transfer ownership" },
        403
      );
    }

    try {
      const body = await c.req.json();
      const { new_owner_id } = body;

      if (!new_owner_id || typeof new_owner_id !== "string") {
        return c.json({ error: "new_owner_id is required" }, 400);
      }

      // Verify new owner exists as a user
      const newOwnerUser = getUserById(new_owner_id);
      if (!newOwnerUser) {
        return c.json({ error: "New owner user not found" }, 400);
      }

      // Verify new owner is a member of the channel
      if (!isChannelMember(channelId, "user", new_owner_id)) {
        return c.json(
          { error: "New owner must be a member of the channel" },
          400
        );
      }

      // Cannot transfer to self
      if (new_owner_id === userId) {
        return c.json({ error: "Cannot transfer ownership to yourself" }, 400);
      }

      const success = transferChannelOwnership(channelId, userId, new_owner_id);
      if (!success) {
        return c.json({ error: "Failed to transfer ownership" }, 500);
      }

      broadcast("channel_ownership_transferred", {
        channel_id: channelId,
        old_owner_id: userId,
        new_owner_id,
      });

      return c.json({ success: true, new_owner_id });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ error: msg }, 500);
    }
  });

  // Delete a channel (owner only)
  app.delete("/api/channels/:channel", (c) => {
    const channelId = c.req.param("channel");
    const userId = getUserIdFromRequest(c);

    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const channel = getChannelById(channelId);
    if (!channel) {
      return c.json({ error: "Channel not found" }, 404);
    }

    // Only owner can delete (system channels cannot be deleted)
    if (channel.owner_id !== userId) {
      return c.json(
        { error: "Only the channel owner can delete a channel" },
        403
      );
    }

    if (channel.owner_id === "system") {
      return c.json({ error: "System channels cannot be deleted" }, 403);
    }

    const deleted = deleteChannel(channelId);
    if (!deleted) {
      return c.json({ error: "Failed to delete channel" }, 500);
    }

    broadcast("channel_deleted", { channel_id: channelId });

    return c.json({ success: true });
  });

  // Get channel members
  app.get("/api/channels/:channel/members", (c) => {
    const channelId = c.req.param("channel");
    const userId = getUserIdFromRequest(c);

    const channel = getChannelById(channelId);
    if (!channel) {
      return c.json({ error: "Channel not found" }, 404);
    }

    // Check access (system channels are public)
    if (
      channel.owner_id !== "system" &&
      userId &&
      !canAccessChannel(channelId, "user", userId)
    ) {
      return c.json({ error: "Not a member of this channel" }, 403);
    }

    const members = getChannelMembers(channelId);
    // Enrich members with display names
    const enrichedMembers = members.map((m) => {
      let display_name = m.member_id;
      if (m.member_type === "user") {
        const user = getUserById(m.member_id);
        if (user) {
          display_name = user.username;
        }
      }
      return { ...m, display_name };
    });
    return c.json({ channel_id: channelId, members: enrichedMembers });
  });

  // Add/remove channel members (owner/admin only)
  app.patch("/api/channels/:channel/members", async (c) => {
    const channelId = c.req.param("channel");
    const userId = getUserIdFromRequest(c);

    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const channel = getChannelById(channelId);
    if (!channel) {
      return c.json({ error: "Channel not found" }, 404);
    }

    // Check if user is owner or admin
    const userRole = getChannelMemberRole(channelId, "user", userId);
    if (userRole !== "owner" && userRole !== "admin") {
      return c.json({ error: "Only owner or admin can modify members" }, 403);
    }

    try {
      const body = await c.req.json();
      const { action, member_type, member_id, role } = body;

      if (!["add", "remove"].includes(action)) {
        return c.json({ error: "Action must be 'add' or 'remove'" }, 400);
      }

      if (!["user", "agent"].includes(member_type)) {
        return c.json({ error: "Member type must be 'user' or 'agent'" }, 400);
      }

      if (!member_id || typeof member_id !== "string") {
        return c.json({ error: "Member ID is required" }, 400);
      }

      if (action === "add") {
        const memberRole = role || "member";
        if (!["member", "admin"].includes(memberRole)) {
          return c.json({ error: "Role must be 'member' or 'admin'" }, 400);
        }
        addChannelMember(channelId, member_type, member_id, memberRole);
        broadcast("channel_member_added", {
          channel_id: channelId,
          member_type,
          member_id,
          role: memberRole,
        });
      } else {
        // Cannot remove the owner
        if (member_type === "user" && member_id === channel.owner_id) {
          return c.json({ error: "Cannot remove the channel owner" }, 400);
        }
        removeChannelMember(channelId, member_type, member_id);
        broadcast("channel_member_removed", {
          channel_id: channelId,
          member_type,
          member_id,
        });
      }

      return c.json({ success: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ error: msg }, 500);
    }
  });

  // Get messages from a channel
  app.get("/api/channels/:channel/messages", (c) => {
    const channel = c.req.param("channel");
    const limit = Number.parseInt(c.req.query("limit") || "50", 10);
    const userId = getUserIdFromRequest(c);

    if (!isValidChannel(channel)) {
      return c.json({ error: `Invalid channel: ${channel}` }, 400);
    }

    // Check access for non-system channels
    const channelData = getChannelById(channel);
    if (
      channelData &&
      channelData.owner_id !== "system" &&
      userId &&
      !canAccessChannel(channel, "user", userId)
    ) {
      return c.json({ error: "Not a member of this channel" }, 403);
    }

    const messages = readChannelMessages(channel, limit);
    return c.json({ channel, messages });
  });

  // Post a message to a channel
  app.post("/api/channels/:channel/messages", async (c) => {
    const channel = c.req.param("channel");
    const userId = getUserIdFromRequest(c);
    const username = c.req.header("x-username") || "user";

    if (!isValidChannel(channel)) {
      return c.json({ error: `Invalid channel: ${channel}` }, 400);
    }

    // Check access for non-system channels
    const channelData = getChannelById(channel);
    if (
      channelData &&
      channelData.owner_id !== "system" &&
      userId &&
      !canAccessChannel(channel, "user", userId)
    ) {
      return c.json({ error: "Not a member of this channel" }, 403);
    }

    try {
      const body = await c.req.json();
      const { content } = body;

      if (!content || typeof content !== "string" || !content.trim()) {
        return c.json({ error: "Missing or invalid 'content' field" }, 400);
      }

      if (content.length > MAX_CONTENT_LENGTH) {
        return c.json(
          { error: `Content exceeds maximum length of ${MAX_CONTENT_LENGTH}` },
          400
        );
      }

      // Use username from header if available, otherwise "user"
      const message = appendChannelMessage(channel, username, content);

      // Broadcast to WebSocket clients
      broadcast("channel_message", { channel, message });

      // Trigger dispatcher for @mentioned agents
      if (message.mentions.length > 0) {
        triggerMentionedAgents(channel, message);
      }

      return c.json({ success: true, channel, message }, 201);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ error: msg }, 500);
    }
  });

  // Agent API Routes

  // List all agents
  app.get("/api/agents", (c) => {
    const agents = listAgents();
    return c.json({ agents });
  });

  // Get a single agent by ID
  app.get("/api/agents/:id", (c) => {
    const id = c.req.param("id");
    const agent = getAgentById(id);

    if (!agent) {
      return c.json({ error: `Agent not found: ${id}` }, 404);
    }

    return c.json({ agent });
  });

  // Generate a system prompt using Claude CLI + team-app-assistant agent
  app.post("/api/agents/generate-prompt", async (c) => {
    try {
      const body = await c.req.json();
      const { name, description, model } = body as {
        name?: string;
        description?: string;
        model?: string;
      };

      if (
        !description ||
        typeof description !== "string" ||
        !description.trim()
      ) {
        return c.json({ error: "Description is required" }, 400);
      }

      const systemPrompt = await generateSystemPrompt(
        name?.trim() || "",
        description.trim(),
        model?.trim() || "sonnet"
      );

      return c.json({ system_prompt: systemPrompt });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ error: msg }, 500);
    }
  });

  // Create a new agent
  app.post("/api/agents", async (c) => {
    try {
      const body = (await c.req.json()) as CreateAgentInput;
      const { name, description, model, system_prompt } = body;

      // Validation
      if (!name || typeof name !== "string" || !name.trim()) {
        return c.json({ error: "Name is required" }, 400);
      }
      if (!description || typeof description !== "string") {
        return c.json({ error: "Description is required" }, 400);
      }
      if (!model || typeof model !== "string") {
        return c.json({ error: "Model is required" }, 400);
      }
      if (!system_prompt || typeof system_prompt !== "string") {
        return c.json({ error: "System prompt is required" }, 400);
      }

      const owner = c.req.header("x-username") || null;
      const agent = createAgent({
        name: name.trim().toLowerCase(),
        description: description.trim(),
        model: model.trim(),
        system_prompt: system_prompt.trim(),
        owner: owner || undefined,
        allowed_tools: body.allowed_tools,
      });

      // Add the new agent to all existing channels
      if (agent.dispatchable) {
        for (const ch of getAllChannels()) {
          addChannelMember(ch.id, "agent", agent.id, "member");
        }
      }

      broadcast("agent_created", { agent });

      return c.json({ success: true, agent }, 201);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ error: msg }, 400);
    }
  });

  // Update an agent (owner only, no system agents)
  app.patch("/api/agents/:id", async (c) => {
    const id = c.req.param("id");
    const username = c.req.header("x-username");

    if (!username) {
      return c.json({ error: "Authentication required" }, 401);
    }

    try {
      const body = await c.req.json();
      const { allowed_tools } = body as { allowed_tools?: unknown };

      if (
        allowed_tools !== undefined &&
        !(
          Array.isArray(allowed_tools) &&
          allowed_tools.every((t: unknown) => typeof t === "string")
        )
      ) {
        return c.json(
          { error: "allowed_tools must be an array of strings" },
          400
        );
      }

      const updated = updateAgent(
        id,
        { allowed_tools: allowed_tools as string[] | undefined },
        username
      );

      broadcast("agent_updated", { agent: updated });

      return c.json({ success: true, agent: updated });
    } catch (err) {
      const status = (err as Error & { status?: number }).status || 500;
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, status);
    }
  });

  // Delete an agent (owner only, no system agents)
  app.delete("/api/agents/:id", (c) => {
    const id = c.req.param("id");
    const username = c.req.header("x-username");

    if (!username) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const result = deleteAgent(id, username);
    if (!result.success) {
      let status = 500;
      if (result.error.includes("not found")) {
        status = 404;
      } else if (
        result.error.includes("System") ||
        result.error.includes("owner")
      ) {
        status = 403;
      }
      return c.json({ error: result.error }, status);
    }

    // Remove the agent from all channels
    for (const ch of getAllChannels()) {
      removeChannelMember(ch.id, "agent", id);
    }

    broadcast("agent_deleted", { id });

    return c.json({ success: true });
  });

  // Start Bun server with WebSocket support
  const server = serve({
    port: WEB_PORT,
    fetch(req, server) {
      const url = new URL(req.url);

      // Handle WebSocket upgrade
      if (url.pathname === "/ws") {
        const upgraded = server.upgrade(req);
        if (upgraded) {
          return undefined; // Bun handles the response
        }
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      // Handle regular HTTP requests with Hono
      return app.fetch(req);
    },
    websocket: {
      open(ws) {
        wsClients.add(ws);
        logger.debug("WebSocket", `Client connected (${wsClients.size} total)`);
      },
      close(ws) {
        wsClients.delete(ws);
        logger.debug(
          "WebSocket",
          `Client disconnected (${wsClients.size} total)`
        );
      },
      message(_ws, message) {
        // Handle incoming WebSocket messages if needed
        logger.debug("WebSocket", `Message received: ${message}`);
      },
    },
  });

  logger.info(
    "HTTP",
    `Team HTTP server running on http://localhost:${WEB_PORT}`
  );
  logger.info("HTTP", `WebSocket available at ws://localhost:${WEB_PORT}/ws`);

  // Initialize agent dispatcher
  initDispatcher(broadcast);

  // Wire up channel message listener for standup detection
  onChannelMessage((channel, message) => {
    // Notify dispatcher for standup queue advancement
    onStandupChannelMessage(channel, message.from, message.content);
  });
}

// Main entry point
if (isMcpMode) {
  // Run as MCP server only (stdio)
  runMcpServer().catch(console.error);
} else {
  // Run both MCP and HTTP servers
  runMcpServer().catch(console.error);
  runHttpServer();
}
