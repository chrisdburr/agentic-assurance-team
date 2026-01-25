import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Hono } from "hono";
import { serve } from "bun";
import { serveStatic } from "hono/bun";
import { toolDefinitions, handleToolCall } from "./tools.js";
import {
  getAllMessages,
  getThread,
  getStandupsByDate,
  getTodayStandups,
  getTeamStatus,
  getTeamRoster,
  getUnreadMessages,
  sendMessage,
} from "./db.js";
import {
  setBroadcast,
  runFullStandup,
  getSession,
  generateSummary,
} from "./orchestrator.js";
import {
  initDispatcher,
  getDispatcherStatus,
  manualTrigger,
} from "./dispatcher.js";

const WEB_PORT = parseInt(process.env.WEB_PORT || "3030");
const isMcpMode = process.argv.includes("--mcp");

// WebSocket clients for real-time updates
const wsClients = new Set<{ send: (data: string) => void }>();

function broadcast(event: string, data: unknown) {
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  for (const client of wsClients) {
    try {
      client.send(message);
    } catch {
      wsClients.delete(client);
    }
  }
}

// Configure orchestrator to use our broadcast function
setBroadcast(broadcast);

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
  console.error("Team MCP server running on stdio");
}

// HTTP Server setup with Hono
function runHttpServer() {
  const app = new Hono();

  // Serve static files from public directory
  app.use("/static/*", serveStatic({ root: "./public" }));
  app.get("/", serveStatic({ path: "./public/index.html" }));

  // API Routes
  app.get("/api/messages", (c) => {
    const limit = parseInt(c.req.query("limit") || "100");
    const messages = getAllMessages(limit);
    return c.json({ messages });
  });

  // POST /api/messages - Send a new message
  app.post("/api/messages", async (c) => {
    try {
      const body = await c.req.json();
      const { to, content, from, thread_id } = body;

      // Validation
      if (!to || typeof to !== "string") {
        return c.json({ success: false, error: "Missing or invalid 'to' field" }, 400);
      }
      if (!content || typeof content !== "string" || !content.trim()) {
        return c.json({ success: false, error: "Missing or invalid 'content' field" }, 400);
      }

      const fromAgent = from || "user";
      const messageId = sendMessage(fromAgent, to, content, thread_id);

      const result = {
        success: true,
        message_id: messageId,
        from: fromAgent,
        to,
        thread_id: thread_id || messageId,
        timestamp: new Date().toISOString(),
      };

      // Broadcast to WebSocket clients
      broadcast("message", result);

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
    return c.json({ date: date || new Date().toISOString().split("T")[0], standups });
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
      const session = await runFullStandup();
      return c.json({
        success: true,
        session_id: session.id,
        date: session.date,
        status: session.status,
        updates: session.updates,
        summary: generateSummary(session),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ success: false, error: message }, 500);
    }
  });

  app.get("/api/standup/session/:sessionId", (c) => {
    const sessionId = c.req.param("sessionId");
    const session = getSession(sessionId);
    if (!session) {
      return c.json({ error: `Session ${sessionId} not found` }, 404);
    }
    return c.json({
      session_id: session.id,
      date: session.date,
      status: session.status,
      updates: session.updates,
      summary: generateSummary(session),
    });
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
        console.log(`WebSocket client connected (${wsClients.size} total)`);
      },
      close(ws) {
        wsClients.delete(ws);
        console.log(`WebSocket client disconnected (${wsClients.size} total)`);
      },
      message(ws, message) {
        // Handle incoming WebSocket messages if needed
        console.log("WebSocket message received:", message);
      },
    },
  });

  console.log(`Team HTTP server running on http://localhost:${WEB_PORT}`);
  console.log(`WebSocket available at ws://localhost:${WEB_PORT}/ws`);

  // Initialize agent dispatcher
  initDispatcher(broadcast);
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
