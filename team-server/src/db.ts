import { Database } from "bun:sqlite";
import { nanoid } from "nanoid";

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");
const DB_PATH = process.env.DB_PATH || resolve(PROJECT_ROOT, ".agents/team.db");

const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode = WAL");

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    from_agent TEXT NOT NULL,
    to_agent TEXT NOT NULL,
    content TEXT NOT NULL,
    thread_id TEXT,
    timestamp TEXT NOT NULL,
    read_by TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS standups (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    date TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    session_id TEXT
  );

  CREATE TABLE IF NOT EXISTS status (
    agent_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'offline',
    working_on TEXT,
    beads_id TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_agent);
  CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
  CREATE INDEX IF NOT EXISTS idx_standups_date ON standups(date);
  CREATE INDEX IF NOT EXISTS idx_standups_session ON standups(session_id);
`);

// Prepared statements
const insertMessage = db.prepare(
  `INSERT INTO messages (id, from_agent, to_agent, content, thread_id, timestamp, read_by)
   VALUES ($id, $from, $to, $content, $threadId, $timestamp, '[]')`
);

const selectMessagesForAgent = db.prepare(
  `SELECT * FROM messages WHERE (to_agent = $agentId OR to_agent = 'team') ORDER BY timestamp DESC`
);

const selectUnreadMessagesForAgent = db.prepare(
  `SELECT * FROM messages WHERE (to_agent = $agentId OR to_agent = 'team')
   AND NOT (read_by LIKE '%"' || $agentId || '"%') ORDER BY timestamp DESC`
);

const countUnreadMessagesForAgent = db.prepare(
  `SELECT COUNT(*) as count FROM messages WHERE (to_agent = $agentId OR to_agent = 'team')
   AND NOT (read_by LIKE '%"' || $agentId || '"%')`
);

const selectMessagesByToAgent = db.prepare(
  `SELECT * FROM messages WHERE to_agent = $toAgent ORDER BY timestamp DESC LIMIT $limit`
);

const selectMessagesByFromAgent = db.prepare(
  `SELECT * FROM messages WHERE from_agent = $fromAgent ORDER BY timestamp DESC LIMIT $limit`
);

const selectMessagesByThread = db.prepare(
  `SELECT * FROM messages WHERE thread_id = $threadId ORDER BY timestamp ASC`
);

const selectMessageReadBy = db.prepare(
  `SELECT read_by FROM messages WHERE id = $id`
);

const updateMessageReadBy = db.prepare(
  `UPDATE messages SET read_by = $readBy WHERE id = $id`
);

const selectAllMessages = db.prepare(
  `SELECT * FROM messages ORDER BY timestamp DESC LIMIT $limit`
);

const insertStandup = db.prepare(
  `INSERT INTO standups (id, agent_id, date, content, timestamp, session_id)
   VALUES ($id, $agentId, $date, $content, $timestamp, $sessionId)`
);

const selectStandupsByDate = db.prepare(
  `SELECT * FROM standups WHERE date = $date ORDER BY timestamp ASC`
);

const selectStandupsBySession = db.prepare(
  `SELECT * FROM standups WHERE session_id = $sessionId ORDER BY timestamp ASC`
);

const upsertStatus = db.prepare(
  `INSERT INTO status (agent_id, status, working_on, beads_id, updated_at)
   VALUES ($agentId, $status, $workingOn, $beadsId, $updatedAt)
   ON CONFLICT(agent_id) DO UPDATE SET
     status = excluded.status,
     working_on = excluded.working_on,
     beads_id = excluded.beads_id,
     updated_at = excluded.updated_at`
);

const selectAllStatus = db.prepare(
  `SELECT * FROM status ORDER BY updated_at DESC`
);

const selectAgentStatus = db.prepare(
  `SELECT * FROM status WHERE agent_id = $agentId`
);

// Message functions
export function sendMessage(
  from: string,
  to: string,
  content: string,
  threadId?: string
): string {
  const id = nanoid();
  const timestamp = new Date().toISOString();
  const actualThreadId = threadId || id;

  insertMessage.run({
    $id: id,
    $from: from,
    $to: to,
    $content: content,
    $threadId: actualThreadId,
    $timestamp: timestamp,
  });

  return id;
}

export function listMessages(
  agentId: string,
  options: { unreadOnly?: boolean; threadId?: string } = {}
): Message[] {
  if (options.threadId) {
    return selectMessagesByThread.all({ $threadId: options.threadId }) as Message[];
  }

  if (options.unreadOnly) {
    return selectUnreadMessagesForAgent.all({ $agentId: agentId }) as Message[];
  }

  return selectMessagesForAgent.all({ $agentId: agentId }) as Message[];
}

export function markMessageRead(messageId: string, agentId: string): void {
  const msg = selectMessageReadBy.get({ $id: messageId }) as { read_by: string } | null;

  if (msg) {
    const readBy: string[] = JSON.parse(msg.read_by);
    if (!readBy.includes(agentId)) {
      readBy.push(agentId);
      updateMessageReadBy.run({ $readBy: JSON.stringify(readBy), $id: messageId });
    }
  }
}

export function getThread(threadId: string): Message[] {
  return selectMessagesByThread.all({ $threadId: threadId }) as Message[];
}

export function getAllMessages(limit = 100): Message[] {
  return selectAllMessages.all({ $limit: limit }) as Message[];
}

export function getMessagesByToAgent(toAgent: string, limit = 100): Message[] {
  return selectMessagesByToAgent.all({ $toAgent: toAgent, $limit: limit }) as Message[];
}

export function getMessagesByFromAgent(fromAgent: string, limit = 100): Message[] {
  return selectMessagesByFromAgent.all({ $fromAgent: fromAgent, $limit: limit }) as Message[];
}

export function getUnreadMessages(agentId: string): { count: number; messages: Message[] } {
  const countResult = countUnreadMessagesForAgent.get({ $agentId: agentId }) as { count: number };
  const messages = selectUnreadMessagesForAgent.all({ $agentId: agentId }) as Message[];
  return { count: countResult.count, messages };
}

// Standup functions
export function postStandup(
  agentId: string,
  content: string,
  sessionId?: string
): string {
  const id = nanoid();
  const date = new Date().toISOString().split("T")[0];
  const timestamp = new Date().toISOString();

  insertStandup.run({
    $id: id,
    $agentId: agentId,
    $date: date,
    $content: content,
    $timestamp: timestamp,
    $sessionId: sessionId || null,
  });

  return id;
}

export function getStandupsByDate(date: string): Standup[] {
  return selectStandupsByDate.all({ $date: date }) as Standup[];
}

export function getTodayStandups(): Standup[] {
  const today = new Date().toISOString().split("T")[0];
  return getStandupsByDate(today);
}

export function getStandupsBySession(sessionId: string): Standup[] {
  return selectStandupsBySession.all({ $sessionId: sessionId }) as Standup[];
}

// Status functions
export function updateStatus(
  agentId: string,
  status: "active" | "idle" | "offline",
  workingOn?: string,
  beadsId?: string
): void {
  const updatedAt = new Date().toISOString();

  upsertStatus.run({
    $agentId: agentId,
    $status: status,
    $workingOn: workingOn || null,
    $beadsId: beadsId || null,
    $updatedAt: updatedAt,
  });
}

export function getTeamStatus(): Status[] {
  return selectAllStatus.all() as Status[];
}

export function getAgentStatus(agentId: string): Status | undefined {
  return selectAgentStatus.get({ $agentId: agentId }) as Status | undefined;
}

// Team roster (static for now)
export function getTeamRoster(): TeamMember[] {
  return [
    {
      id: "alice",
      name: "Alice",
      role: "Philosopher",
      expertise: "Formal epistemology, argumentation theory",
    },
    {
      id: "bob",
      name: "Bob",
      role: "Computer Scientist",
      expertise: "AI/ML, uncertainty quantification",
    },
    {
      id: "charlie",
      name: "Charlie",
      role: "Psychologist",
      expertise: "Decision theory, HCI, user trust",
    },
  ];
}

// Types
export interface Message {
  id: string;
  from_agent: string;
  to_agent: string;
  content: string;
  thread_id: string | null;
  timestamp: string;
  read_by: string;
}

export interface Standup {
  id: string;
  agent_id: string;
  date: string;
  content: string;
  timestamp: string;
  session_id: string | null;
}

export interface Status {
  agent_id: string;
  status: string;
  working_on: string | null;
  beads_id: string | null;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  expertise: string;
}

export default db;
