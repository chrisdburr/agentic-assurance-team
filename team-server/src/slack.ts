/**
 * Slack Bot Module
 *
 * Bridges Slack ↔ team.db for real-time user-agent messaging.
 *
 * Inbound: Slack messages → team.db via sendMessage()
 * Outbound: Polls for new messages → posts to Slack channels
 */

import { sendMessage, getAllMessages, markMessageRead, type Message } from "./db.js";

// Configuration from environment
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN; // For Socket Mode
const TEAM_SERVER_URL = process.env.TEAM_SERVER_URL || "http://localhost:3030";

// Channel-to-agent mapping
const CHANNEL_AGENT_MAP: Record<string, string> = {
  "alice": "alice",
  "bob": "bob",
  "charlie": "charlie",
  "team": "team",
};

// Track last processed message timestamp to avoid duplicates
let lastProcessedTimestamp = new Date().toISOString();
let slackEnabled = false;

interface SlackMessage {
  type: string;
  channel: string;
  user: string;
  text: string;
  ts: string;
  channel_type?: string;
}

interface SlackChannel {
  id: string;
  name: string;
}

// Slack API helper
async function slackApi(method: string, body?: Record<string, unknown>): Promise<unknown> {
  if (!SLACK_BOT_TOKEN) {
    throw new Error("SLACK_BOT_TOKEN not configured");
  }

  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const result = await response.json() as { ok: boolean; error?: string };
  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error}`);
  }

  return result;
}

// Post message to Slack channel
export async function postToSlack(channel: string, text: string): Promise<void> {
  if (!slackEnabled) {
    console.log(`[Slack disabled] Would post to #${channel}: ${text}`);
    return;
  }

  try {
    await slackApi("chat.postMessage", {
      channel: `#${channel}`,
      text,
      unfurl_links: false,
      unfurl_media: false,
    });
    console.log(`[Slack] Posted to #${channel}`);
  } catch (error) {
    console.error(`[Slack] Failed to post to #${channel}:`, error);
  }
}

// Get channel name from channel ID
async function getChannelName(channelId: string): Promise<string | null> {
  try {
    const result = await slackApi("conversations.info", { channel: channelId }) as {
      channel: SlackChannel;
    };
    return result.channel.name;
  } catch {
    return null;
  }
}

// Handle incoming Slack message
export async function handleSlackMessage(message: SlackMessage): Promise<void> {
  // Ignore bot messages
  if (message.type !== "message" || !message.text) {
    return;
  }

  // Get channel name
  const channelName = await getChannelName(message.channel);
  if (!channelName) {
    console.error(`[Slack] Could not resolve channel ${message.channel}`);
    return;
  }

  // Map channel to agent
  const toAgent = CHANNEL_AGENT_MAP[channelName];
  if (!toAgent) {
    console.log(`[Slack] Ignoring message from unmapped channel #${channelName}`);
    return;
  }

  // Store in team.db
  const messageId = sendMessage("slack", toAgent, message.text);
  console.log(`[Slack] Stored message ${messageId} from #${channelName} to ${toAgent}`);
}

// Poll for outbound messages (from agents to Slack)
export async function pollOutboundMessages(): Promise<void> {
  if (!slackEnabled) return;

  try {
    // Get recent messages sent to "slack" recipient
    const allMessages = getAllMessages(50) as Message[];
    const outboundMessages = allMessages.filter(
      (m) => m.to_agent === "slack" && m.timestamp > lastProcessedTimestamp
    );

    for (const msg of outboundMessages.reverse()) {
      // Determine target channel from sender
      const channel = msg.from_agent === "team" ? "team" : msg.from_agent;

      await postToSlack(channel, msg.content);
      markMessageRead(msg.id, "slack");
      lastProcessedTimestamp = msg.timestamp;
    }
  } catch (error) {
    console.error("[Slack] Error polling outbound messages:", error);
  }
}

// Verify Slack request signature
export function verifySlackRequest(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  if (!SLACK_SIGNING_SECRET) {
    console.warn("[Slack] No signing secret configured, skipping verification");
    return true;
  }

  const crypto = require("crypto");
  const sigBasestring = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", SLACK_SIGNING_SECRET);
  hmac.update(sigBasestring);
  const mySignature = `v0=${hmac.digest("hex")}`;

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature)
  );
}

// Initialize Slack bot
export function initSlackBot(broadcast: (event: string, data: unknown) => void): boolean {
  if (!SLACK_BOT_TOKEN) {
    console.log("[Slack] Bot token not configured, Slack integration disabled");
    console.log("[Slack] Set SLACK_BOT_TOKEN to enable Slack integration");
    return false;
  }

  slackEnabled = true;
  console.log("[Slack] Bot initialized with token");

  // Start outbound message polling (every 5 seconds)
  setInterval(pollOutboundMessages, 5000);

  // Broadcast Slack status
  broadcast("slack_status", { enabled: true });

  return true;
}

// Create Slack event handler for Hono
export function createSlackEventHandler() {
  return async (c: { req: { text: () => Promise<string>; header: (name: string) => string | undefined }; json: (data: unknown, status?: number) => Response }) => {
    const body = await c.req.text();
    const timestamp = c.req.header("x-slack-request-timestamp");
    const signature = c.req.header("x-slack-signature");

    // Verify request
    if (timestamp && signature && !verifySlackRequest(signature, timestamp, body)) {
      return c.json({ error: "Invalid signature" }, 401);
    }

    const payload = JSON.parse(body);

    // Handle URL verification challenge
    if (payload.type === "url_verification") {
      return c.json({ challenge: payload.challenge });
    }

    // Handle event callbacks
    if (payload.type === "event_callback") {
      const event = payload.event as SlackMessage;

      // Process message events
      if (event.type === "message" && !event.hasOwnProperty("subtype")) {
        await handleSlackMessage(event);
      }
    }

    return c.json({ ok: true });
  };
}

// Notify Slack about beads events (issue creation, assignment, closure)
export async function notifyBeadsEvent(
  eventType: "created" | "assigned" | "closed",
  issueId: string,
  title: string,
  assignee?: string
): Promise<void> {
  if (!slackEnabled) return;

  let message: string;
  let channel = "team";

  switch (eventType) {
    case "created":
      message = `New issue created: *${issueId}* - ${title}`;
      break;
    case "assigned":
      message = `Issue *${issueId}* assigned to ${assignee}: ${title}`;
      if (assignee && CHANNEL_AGENT_MAP[assignee]) {
        channel = assignee;
      }
      break;
    case "closed":
      message = `Issue *${issueId}* closed: ${title}`;
      break;
    default:
      return;
  }

  await postToSlack(channel, message);
}

// Export types
export interface SlackConfig {
  enabled: boolean;
  channels: string[];
}

export function getSlackStatus(): SlackConfig {
  return {
    enabled: slackEnabled,
    channels: Object.keys(CHANNEL_AGENT_MAP),
  };
}
