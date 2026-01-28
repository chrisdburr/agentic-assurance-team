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
  deleteChannel,
  getAllMessages,
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
  removeChannelMember,
  sendMessage,
  updatePassword,
  validatePassword,
} from "./db.js";
import {
  getDispatcherStatus,
  getStandupQueueStatus,
  initDispatcher,
  manualTrigger,
  onStandupChannelMessage,
  startStandupQueue,
  triggerAgentForChannel,
} from "./dispatcher.js";
import { logger } from "./logger.js";
import { handleToolCall, toolDefinitions } from "./tools.js";

// Parse @mentions from message content (for DMs - channels use channels.ts version)
// Supports @alice, @bob, @charlie, @team (expands to all three)
function parseDMMentions(content: string): string[] {
  const mentionRegex = /@(alice|bob|charlie|team)\b/gi;
  const matches = content.match(mentionRegex) || [];

  const mentions = new Set<string>();
  for (const match of matches) {
    const mention = match.slice(1).toLowerCase(); // Remove @ and lowercase
    if (mention === "team") {
      mentions.add("alice");
      mentions.add("bob");
      mentions.add("charlie");
    } else {
      mentions.add(mention);
    }
  }

  return Array.from(mentions);
}

// Trigger mentioned agents for a channel message
async function triggerMentionedAgents(
  channel: string,
  message: ChannelMessage
): Promise<void> {
  for (const agentId of message.mentions) {
    // Only trigger valid agents
    if (["alice", "bob", "charlie"].includes(agentId)) {
      logger.info(
        "Channel",
        `Triggering ${agentId} for @mention in #${channel}`
      );
      await triggerAgentForChannel(agentId, channel);
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
      if (["alice", "bob", "charlie"].includes(to)) {
        manualTrigger(to).catch((err) => {
          logger.error("API", `Failed to trigger ${to}: ${err}`);
        });
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

  app.post("/api/dispatcher/trigger/:agent", async (c) => {
    const agent = c.req.param("agent");
    const result = await manualTrigger(agent);
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

      const channel = "team"; // Could be parameterized in the future
      const sessionId = startStandupQueue(channel);

      return c.json({
        success: true,
        session_id: sessionId,
        channel,
        message:
          "Standup session started. Agents will respond sequentially in the channel.",
        agents: ["alice", "bob", "charlie"],
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
      for (const agent of ["alice", "bob", "charlie"]) {
        addChannelMember(id, "agent", agent, "member");
      }

      broadcast("channel_created", { channel });

      return c.json({ success: true, channel }, 201);
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
    return c.json({ channel_id: channelId, members });
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
