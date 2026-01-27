/**
 * Channel Storage Module
 *
 * Manages JSONL-based channel message storage.
 * Each channel is stored as an append-only JSONL file.
 * Read state is tracked per agent in SQLite.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
import db from "./db.js";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");
const CHANNELS_DIR = resolve(PROJECT_ROOT, ".agents/channels");

// Available channels
export const CHANNELS = ["team", "research"] as const;
export type ChannelId = (typeof CHANNELS)[number];

// Channel message structure
export interface ChannelMessage {
  id: string;
  timestamp: string;
  from: string;
  content: string;
  mentions: string[];
  thread_id: string | null;
}

// Initialize channel_read_state table
db.exec(`
  CREATE TABLE IF NOT EXISTS channel_read_state (
    agent_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    last_read_timestamp TEXT NOT NULL,
    PRIMARY KEY (agent_id, channel)
  );
`);

// Prepared statements for read state
const getReadState = db.prepare(
  "SELECT last_read_timestamp FROM channel_read_state WHERE agent_id = $agentId AND channel = $channel"
);

const upsertReadState = db.prepare(
  `INSERT INTO channel_read_state (agent_id, channel, last_read_timestamp)
   VALUES ($agentId, $channel, $timestamp)
   ON CONFLICT(agent_id, channel) DO UPDATE SET last_read_timestamp = excluded.last_read_timestamp`
);

/**
 * Ensure channels directory and files exist
 */
export function initChannels(): void {
  if (!existsSync(CHANNELS_DIR)) {
    mkdirSync(CHANNELS_DIR, { recursive: true });
  }

  for (const channel of CHANNELS) {
    const path = getChannelPath(channel);
    if (!existsSync(path)) {
      writeFileSync(path, "");
    }
  }
}

/**
 * Get the file path for a channel
 */
function getChannelPath(channel: string): string {
  return resolve(CHANNELS_DIR, `${channel}.jsonl`);
}

/**
 * Validate channel name
 */
export function isValidChannel(channel: string): channel is ChannelId {
  return CHANNELS.includes(channel as ChannelId);
}

/**
 * Parse @mentions from message content
 */
export function parseMentions(content: string): string[] {
  const mentionRegex = /@(alice|bob|charlie|team)\b/gi;
  const matches = content.match(mentionRegex) || [];

  const mentions = new Set<string>();
  for (const match of matches) {
    const mention = match.slice(1).toLowerCase();
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

/**
 * Append a message to a channel
 */
export function appendChannelMessage(
  channel: string,
  from: string,
  content: string,
  threadId?: string
): ChannelMessage {
  if (!isValidChannel(channel)) {
    throw new Error(`Invalid channel: ${channel}`);
  }

  const message: ChannelMessage = {
    id: `msg_${nanoid()}`,
    timestamp: new Date().toISOString(),
    from,
    content,
    mentions: parseMentions(content),
    thread_id: threadId || null,
  };

  const path = getChannelPath(channel);
  appendFileSync(path, `${JSON.stringify(message)}\n`);

  // Notify listeners of the new message
  notifyListeners(channel, message);

  return message;
}

/**
 * Read messages from a channel
 */
export function readChannelMessages(
  channel: string,
  limit = 50
): ChannelMessage[] {
  if (!isValidChannel(channel)) {
    throw new Error(`Invalid channel: ${channel}`);
  }

  const path = getChannelPath(channel);
  if (!existsSync(path)) {
    return [];
  }

  const content = readFileSync(path, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);

  const messages: ChannelMessage[] = [];
  for (const line of lines) {
    try {
      messages.push(JSON.parse(line));
    } catch {
      // Skip malformed lines
    }
  }

  // Return the most recent messages (last N lines)
  return messages.slice(-limit);
}

/**
 * Get unread messages for an agent in a channel
 */
export function getUnreadChannelMessages(
  channel: string,
  agentId: string
): ChannelMessage[] {
  const messages = readChannelMessages(channel, 100);

  // Get last read timestamp for this agent
  const readState = getReadState.get({
    $agentId: agentId,
    $channel: channel,
  }) as { last_read_timestamp: string } | undefined;

  if (!readState) {
    // Never read - return all messages
    return messages;
  }

  // Return messages newer than last read
  return messages.filter((m) => m.timestamp > readState.last_read_timestamp);
}

/**
 * Mark channel as read up to a certain timestamp
 */
export function markChannelRead(
  channel: string,
  agentId: string,
  timestamp?: string
): void {
  if (!isValidChannel(channel)) {
    throw new Error(`Invalid channel: ${channel}`);
  }

  // If no timestamp provided, use current time (mark all as read)
  const ts = timestamp || new Date().toISOString();

  upsertReadState.run({
    $agentId: agentId,
    $channel: channel,
    $timestamp: ts,
  });
}

/**
 * Get the last read timestamp for an agent in a channel
 */
export function getLastReadTimestamp(
  channel: string,
  agentId: string
): string | null {
  const readState = getReadState.get({
    $agentId: agentId,
    $channel: channel,
  }) as { last_read_timestamp: string } | undefined;

  return readState?.last_read_timestamp || null;
}

/**
 * List all available channels
 */
export function listChannels(): ChannelId[] {
  return [...CHANNELS];
}

/**
 * Get count of unread messages per channel for an agent
 */
export function getUnreadCountsForAgent(
  agentId: string
): Record<ChannelId, number> {
  const counts: Record<string, number> = {};

  for (const channel of CHANNELS) {
    const unread = getUnreadChannelMessages(channel, agentId);
    counts[channel] = unread.length;
  }

  return counts as Record<ChannelId, number>;
}

// Message listeners for real-time notifications
type ChannelMessageListener = (
  channel: string,
  message: ChannelMessage
) => void;
const messageListeners: ChannelMessageListener[] = [];

/**
 * Register a listener for new channel messages
 */
export function onChannelMessage(listener: ChannelMessageListener): () => void {
  messageListeners.push(listener);
  return () => {
    const index = messageListeners.indexOf(listener);
    if (index >= 0) {
      messageListeners.splice(index, 1);
    }
  };
}

/**
 * Notify all listeners of a new message
 */
function notifyListeners(channel: string, message: ChannelMessage): void {
  for (const listener of messageListeners) {
    try {
      listener(channel, message);
    } catch (error) {
      logger.error("Channels", "Listener error", { error: String(error) });
    }
  }
}

// Initialize channels on module load
initChannels();
