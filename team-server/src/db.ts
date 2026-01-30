import { Database } from "bun:sqlite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
import { getDispatchableAgentIds } from "./agents.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");
const DB_PATH = process.env.DB_PATH || resolve(PROJECT_ROOT, ".agents/team.db");

const SHORT_ROLE_SPLIT_REGEX = /[.,;]/;

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

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_agent);
  CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
  CREATE INDEX IF NOT EXISTS idx_standups_date ON standups(date);
  CREATE INDEX IF NOT EXISTS idx_standups_session ON standups(session_id);
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

  -- Session registry (channel sessions shared, DM sessions per-user)
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('channel', 'dm')),
    user_id TEXT,
    channel_id TEXT,
    project_path TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    session_id TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(type, user_id, channel_id, project_path, agent_id)
  );

  -- Dynamic channels (replaces hardcoded CHANNELS array)
  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    project_path TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Channel membership (users and agents)
  CREATE TABLE IF NOT EXISTS channel_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    member_type TEXT NOT NULL CHECK(member_type IN ('user', 'agent')),
    member_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member')),
    joined_at TEXT DEFAULT (datetime('now')),
    UNIQUE(channel_id, member_type, member_id),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_lookup ON sessions(type, user_id, channel_id, project_path, agent_id);
  CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel_id);
  CREATE INDEX IF NOT EXISTS idx_channel_members_member ON channel_members(member_type, member_id);
`);

// Migration: Add is_admin column if it doesn't exist
try {
  db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0");
} catch {
  // Column already exists, ignore error
}

// Migration: Add metadata column to messages table
try {
  db.exec("ALTER TABLE messages ADD COLUMN metadata TEXT DEFAULT NULL");
} catch {
  // Column already exists, ignore error
}

// Prepared statements
const insertMessage = db.prepare(
  `INSERT INTO messages (id, from_agent, to_agent, content, thread_id, timestamp, read_by, metadata)
   VALUES ($id, $from, $to, $content, $threadId, $timestamp, '[]', $metadata)`
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
  "SELECT * FROM messages WHERE to_agent = $toAgent ORDER BY timestamp DESC LIMIT $limit"
);

const selectMessagesByFromAgent = db.prepare(
  "SELECT * FROM messages WHERE from_agent = $fromAgent ORDER BY timestamp DESC LIMIT $limit"
);

const selectMessagesByThread = db.prepare(
  "SELECT * FROM messages WHERE thread_id = $threadId ORDER BY timestamp ASC"
);

const selectMessageReadBy = db.prepare(
  "SELECT read_by FROM messages WHERE id = $id"
);

const updateMessageReadBy = db.prepare(
  "UPDATE messages SET read_by = $readBy WHERE id = $id"
);

const selectAllMessages = db.prepare(
  "SELECT * FROM messages ORDER BY timestamp DESC LIMIT $limit"
);

const insertStandup = db.prepare(
  `INSERT INTO standups (id, agent_id, date, content, timestamp, session_id)
   VALUES ($id, $agentId, $date, $content, $timestamp, $sessionId)`
);

const selectStandupsByDate = db.prepare(
  "SELECT * FROM standups WHERE date = $date ORDER BY timestamp ASC"
);

const selectStandupsBySession = db.prepare(
  "SELECT * FROM standups WHERE session_id = $sessionId ORDER BY timestamp ASC"
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
  "SELECT * FROM status ORDER BY updated_at DESC"
);

const selectAgentStatus = db.prepare(
  "SELECT * FROM status WHERE agent_id = $agentId"
);

// User prepared statements
const insertUser = db.prepare(
  `INSERT INTO users (id, username, email, password_hash, is_admin, created_at, updated_at)
   VALUES ($id, $username, $email, $passwordHash, $isAdmin, $createdAt, $updatedAt)`
);

const selectUserByUsername = db.prepare(
  "SELECT * FROM users WHERE username = $username"
);

const selectUserById = db.prepare("SELECT * FROM users WHERE id = $id");

const selectAllUsers = db.prepare(
  "SELECT id, username, email, is_admin, created_at, updated_at FROM users ORDER BY created_at DESC"
);

const updateUserPassword = db.prepare(
  "UPDATE users SET password_hash = $passwordHash, updated_at = $updatedAt WHERE id = $id"
);

const updateUserDetails = db.prepare(
  "UPDATE users SET email = $email, is_admin = $isAdmin, updated_at = $updatedAt WHERE id = $id"
);

const deleteUserById = db.prepare("DELETE FROM users WHERE id = $id");

const countUsers = db.prepare("SELECT COUNT(*) as count FROM users");

// Session prepared statements
const selectSession = db.prepare(
  `SELECT session_id FROM sessions
   WHERE type = $type
   AND (user_id = $userId OR (user_id IS NULL AND $userId IS NULL))
   AND (channel_id = $channelId OR (channel_id IS NULL AND $channelId IS NULL))
   AND project_path = $projectPath
   AND agent_id = $agentId`
);

const insertSession = db.prepare(
  `INSERT INTO sessions (type, user_id, channel_id, project_path, agent_id, session_id)
   VALUES ($type, $userId, $channelId, $projectPath, $agentId, $sessionId)`
);

const deleteSessionById = db.prepare(
  "DELETE FROM sessions WHERE session_id = $sessionId"
);

const deleteSessionsByAgent = db.prepare(
  "DELETE FROM sessions WHERE project_path = $projectPath AND agent_id = $agentId"
);

// Simple agent session lookup (one session per agent, regardless of context)
const selectAgentSession = db.prepare(
  `SELECT session_id FROM sessions
   WHERE project_path = $projectPath AND agent_id = $agentId
   LIMIT 1`
);

const insertAgentSession = db.prepare(
  `INSERT INTO sessions (type, project_path, agent_id, session_id)
   VALUES ('dm', $projectPath, $agentId, $sessionId)`
);

// Channel prepared statements
const insertChannel = db.prepare(
  `INSERT INTO channels (id, name, description, project_path, owner_id)
   VALUES ($id, $name, $description, $projectPath, $ownerId)`
);

const selectChannelById = db.prepare("SELECT * FROM channels WHERE id = $id");

const selectAllChannels = db.prepare(
  "SELECT * FROM channels ORDER BY created_at"
);

const selectChannelsByProject = db.prepare(
  "SELECT * FROM channels WHERE project_path = $projectPath ORDER BY created_at"
);

const deleteChannelById = db.prepare("DELETE FROM channels WHERE id = $id");

// Channel member prepared statements
const insertChannelMember = db.prepare(
  `INSERT OR REPLACE INTO channel_members (channel_id, member_type, member_id, role)
   VALUES ($channelId, $memberType, $memberId, $role)`
);

const selectChannelMember = db.prepare(
  `SELECT * FROM channel_members
   WHERE channel_id = $channelId AND member_type = $memberType AND member_id = $memberId`
);

const selectChannelMembers = db.prepare(
  "SELECT * FROM channel_members WHERE channel_id = $channelId ORDER BY joined_at"
);

const deleteChannelMember = db.prepare(
  `DELETE FROM channel_members
   WHERE channel_id = $channelId AND member_type = $memberType AND member_id = $memberId`
);

const selectChannelsForUser = db.prepare(
  `SELECT DISTINCT c.* FROM channels c
   LEFT JOIN channel_members cm ON c.id = cm.channel_id
   WHERE c.owner_id = $userId
   OR c.owner_id = 'system'
   OR (cm.member_type = 'user' AND cm.member_id = $userId)
   ORDER BY c.created_at`
);

const selectChannelsForAgent = db.prepare(
  `SELECT DISTINCT c.* FROM channels c
   LEFT JOIN channel_members cm ON c.id = cm.channel_id
   WHERE cm.member_type = 'agent' AND cm.member_id = $agentId
   ORDER BY c.created_at`
);

const countChannels = db.prepare("SELECT COUNT(*) as count FROM channels");

// Message functions
export function sendMessage(
  from: string,
  to: string,
  content: string,
  threadId?: string,
  metadata?: Record<string, unknown>
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
    $metadata: metadata ? JSON.stringify(metadata) : null,
  });

  return id;
}

export function listMessages(
  agentId: string,
  options: { unreadOnly?: boolean; threadId?: string } = {}
): Message[] {
  if (options.threadId) {
    return selectMessagesByThread.all({
      $threadId: options.threadId,
    }) as Message[];
  }

  if (options.unreadOnly) {
    return selectUnreadMessagesForAgent.all({ $agentId: agentId }) as Message[];
  }

  return selectMessagesForAgent.all({ $agentId: agentId }) as Message[];
}

export function markMessageRead(messageId: string, agentId: string): void {
  const msg = selectMessageReadBy.get({ $id: messageId }) as {
    read_by: string;
  } | null;

  if (msg) {
    const readBy: string[] = JSON.parse(msg.read_by);
    if (!readBy.includes(agentId)) {
      readBy.push(agentId);
      updateMessageReadBy.run({
        $readBy: JSON.stringify(readBy),
        $id: messageId,
      });
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
  return selectMessagesByToAgent.all({
    $toAgent: toAgent,
    $limit: limit,
  }) as Message[];
}

export function getMessagesByFromAgent(
  fromAgent: string,
  limit = 100
): Message[] {
  return selectMessagesByFromAgent.all({
    $fromAgent: fromAgent,
    $limit: limit,
  }) as Message[];
}

export function getUnreadMessages(agentId: string): {
  count: number;
  messages: Message[];
} {
  const countResult = countUnreadMessagesForAgent.get({
    $agentId: agentId,
  }) as { count: number };
  const messages = selectUnreadMessagesForAgent.all({
    $agentId: agentId,
  }) as Message[];
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

// Team roster — dynamically built from dispatchable agents
export function getTeamRoster(): TeamMember[] {
  // Lazy import to avoid potential circular init issues at module load time.
  const { listAgents } = require("./agents.js") as typeof import("./agents.js");
  return listAgents()
    .filter((a) => a.dispatchable)
    .map((a) => ({
      id: a.id,
      name: a.name.charAt(0).toUpperCase() + a.name.slice(1),
      role: a.description.split(SHORT_ROLE_SPLIT_REGEX)[0].trim(),
      expertise: a.description,
    }));
}

// User functions
export async function createUser(
  username: string,
  email: string,
  password: string,
  isAdmin = false
): Promise<User> {
  const id = nanoid();
  const now = new Date().toISOString();
  const passwordHash = await Bun.password.hash(password);

  insertUser.run({
    $id: id,
    $username: username,
    $email: email,
    $passwordHash: passwordHash,
    $isAdmin: isAdmin ? 1 : 0,
    $createdAt: now,
    $updatedAt: now,
  });

  return {
    id,
    username,
    email,
    password_hash: passwordHash,
    is_admin: isAdmin,
    created_at: now,
    updated_at: now,
  };
}

export function getAllUsers(): Omit<User, "password_hash">[] {
  const rows = selectAllUsers.all() as Array<{
    id: string;
    username: string;
    email: string;
    is_admin: number;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    email: row.email,
    is_admin: row.is_admin === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export function deleteUser(userId: string): boolean {
  const result = deleteUserById.run({ $id: userId });
  return result.changes > 0;
}

export function updateUser(
  userId: string,
  updates: { email?: string; is_admin?: boolean }
): boolean {
  const user = getUserById(userId);
  if (!user) {
    return false;
  }

  const now = new Date().toISOString();
  const isAdmin =
    updates.is_admin !== undefined ? updates.is_admin : user.is_admin;
  const result = updateUserDetails.run({
    $id: userId,
    $email: updates.email ?? user.email,
    $isAdmin: isAdmin ? 1 : 0,
    $updatedAt: now,
  });
  return result.changes > 0;
}

export function isUserAdmin(userId: string): boolean {
  const user = getUserById(userId);
  return user?.is_admin === true;
}

interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  is_admin: number;
  created_at: string;
  updated_at: string;
}

function mapUserRow(row: UserRow | undefined): User | undefined {
  if (!row) {
    return undefined;
  }
  return {
    ...row,
    is_admin: row.is_admin === 1,
  };
}

export function getUserByUsername(username: string): User | undefined {
  const row = selectUserByUsername.get({ $username: username }) as
    | UserRow
    | undefined;
  return mapUserRow(row);
}

export function getUserById(id: string): User | undefined {
  const row = selectUserById.get({ $id: id }) as UserRow | undefined;
  return mapUserRow(row);
}

export async function updatePassword(
  userId: string,
  newPassword: string
): Promise<void> {
  const now = new Date().toISOString();
  const passwordHash = await Bun.password.hash(newPassword);

  updateUserPassword.run({
    $id: userId,
    $passwordHash: passwordHash,
    $updatedAt: now,
  });
}

export async function validatePassword(
  username: string,
  password: string
): Promise<User | null> {
  const user = getUserByUsername(username);
  if (!user) {
    return null;
  }

  const isValid = await Bun.password.verify(password, user.password_hash);
  return isValid ? user : null;
}

// Session functions
export function getOrCreateSession(
  type: "channel" | "dm",
  projectPath: string,
  agentId: string,
  userId?: string,
  channelId?: string
): string {
  // Look for existing session
  const existing = selectSession.get({
    $type: type,
    $userId: userId || null,
    $channelId: channelId || null,
    $projectPath: projectPath,
    $agentId: agentId,
  }) as { session_id: string } | undefined;

  if (existing) {
    return existing.session_id;
  }

  // Create new session with UUID (required by Claude CLI --resume)
  const sessionId = crypto.randomUUID();

  insertSession.run({
    $type: type,
    $userId: userId || null,
    $channelId: channelId || null,
    $projectPath: projectPath,
    $agentId: agentId,
    $sessionId: sessionId,
  });

  return sessionId;
}

export function deleteSession(sessionId: string): void {
  deleteSessionById.run({ $sessionId: sessionId });
}

export function deleteAgentSessions(
  projectPath: string,
  agentId: string
): number {
  const result = deleteSessionsByAgent.run({
    $projectPath: projectPath,
    $agentId: agentId,
  });
  return result.changes;
}

/**
 * Get or create a single session for an agent (shared across all contexts).
 * Each agent has ONE session that persists across DMs, channels, etc.
 */
export function getAgentSession(projectPath: string, agentId: string): string {
  // Look for existing agent session (any context)
  const existing = selectAgentSession.get({
    $projectPath: projectPath,
    $agentId: agentId,
  }) as { session_id: string } | undefined;

  if (existing) {
    return existing.session_id;
  }

  // Create new session with UUID (required by Claude CLI --resume)
  const sessionId = crypto.randomUUID();

  insertAgentSession.run({
    $projectPath: projectPath,
    $agentId: agentId,
    $sessionId: sessionId,
  });

  return sessionId;
}

// Channel functions
export function createChannel(
  id: string,
  name: string,
  projectPath: string,
  ownerId: string,
  description?: string
): Channel {
  const now = new Date().toISOString();

  insertChannel.run({
    $id: id,
    $name: name,
    $description: description || null,
    $projectPath: projectPath,
    $ownerId: ownerId,
  });

  // Add owner as a member with owner role
  insertChannelMember.run({
    $channelId: id,
    $memberType: "user",
    $memberId: ownerId,
    $role: "owner",
  });

  return {
    id,
    name,
    description: description || null,
    project_path: projectPath,
    owner_id: ownerId,
    created_at: now,
  };
}

export function getChannelById(id: string): Channel | undefined {
  return selectChannelById.get({ $id: id }) as Channel | undefined;
}

export function getAllChannels(): Channel[] {
  return selectAllChannels.all() as Channel[];
}

export function getChannelsByProject(projectPath: string): Channel[] {
  return selectChannelsByProject.all({
    $projectPath: projectPath,
  }) as Channel[];
}

export function deleteChannel(id: string): boolean {
  const result = deleteChannelById.run({ $id: id });
  return result.changes > 0;
}

// Channel member functions
export function addChannelMember(
  channelId: string,
  memberType: "user" | "agent",
  memberId: string,
  role: "owner" | "admin" | "member" = "member"
): void {
  insertChannelMember.run({
    $channelId: channelId,
    $memberType: memberType,
    $memberId: memberId,
    $role: role,
  });
}

export function removeChannelMember(
  channelId: string,
  memberType: "user" | "agent",
  memberId: string
): boolean {
  const result = deleteChannelMember.run({
    $channelId: channelId,
    $memberType: memberType,
    $memberId: memberId,
  });
  return result.changes > 0;
}

export function isChannelMember(
  channelId: string,
  memberType: "user" | "agent",
  memberId: string
): boolean {
  const member = selectChannelMember.get({
    $channelId: channelId,
    $memberType: memberType,
    $memberId: memberId,
  });
  return !!member;
}

export function getChannelMembers(channelId: string): ChannelMember[] {
  return selectChannelMembers.all({ $channelId: channelId }) as ChannelMember[];
}

export function getChannelsForUser(userId: string): Channel[] {
  return selectChannelsForUser.all({ $userId: userId }) as Channel[];
}

export function getChannelsForAgent(agentId: string): Channel[] {
  return selectChannelsForAgent.all({ $agentId: agentId }) as Channel[];
}

export function getChannelMemberRole(
  channelId: string,
  memberType: "user" | "agent",
  memberId: string
): "owner" | "admin" | "member" | null {
  const member = selectChannelMember.get({
    $channelId: channelId,
    $memberType: memberType,
    $memberId: memberId,
  }) as ChannelMember | undefined;
  return member?.role || null;
}

export function transferChannelOwnership(
  channelId: string,
  currentOwnerId: string,
  newOwnerId: string
): boolean {
  const updateChannelOwner = db.prepare(
    "UPDATE channels SET owner_id = ? WHERE id = ?"
  );
  const updateMemberRole = db.prepare(
    "UPDATE channel_members SET role = ? WHERE channel_id = ? AND member_type = 'user' AND member_id = ?"
  );

  const transaction = db.transaction(() => {
    // Update the channel's owner_id
    updateChannelOwner.run(newOwnerId, channelId);
    // Demote old owner to admin
    updateMemberRole.run("admin", channelId, currentOwnerId);
    // Promote new owner to owner
    updateMemberRole.run("owner", channelId, newOwnerId);
  });

  try {
    transaction();
    return true;
  } catch (err) {
    console.error("[DB] Error transferring channel ownership:", err);
    return false;
  }
}

// Seed default channels on startup
function seedDefaultChannels(): void {
  const result = countChannels.get() as { count: number };
  if (result.count > 0) {
    return; // Channels already exist
  }

  console.log("[DB] Seeding default channel: general");

  const projectPath = PROJECT_ROOT;

  try {
    createChannel(
      "general",
      "General",
      projectPath,
      "system",
      "General discussion"
    );

    // Add all agents to the default channel
    for (const agent of getDispatchableAgentIds()) {
      addChannelMember("general", "agent", agent, "member");
    }
  } catch (err) {
    console.error("[DB] Error seeding default channels:", err);
  }
}

// Seed default user from env vars on startup (backward compatibility)
async function seedDefaultUser(): Promise<void> {
  const result = countUsers.get() as { count: number };
  if (result.count > 0) {
    return; // Users already exist
  }

  const username = process.env.AUTH_USERNAME;
  const password = process.env.AUTH_PASSWORD;

  if (!(username && password)) {
    console.log(
      "[DB] No AUTH_USERNAME/AUTH_PASSWORD set and no users exist. Skipping seed."
    );
    return;
  }

  console.log(`[DB] Seeding default user: ${username} (admin)`);
  await createUser(username, `${username}@team.local`, password, true);
}

// Run seeds on module load
seedDefaultChannels();
seedDefaultUser().catch((err) => {
  console.error("[DB] Failed to seed default user:", err);
});

// Types
export interface Message {
  id: string;
  from_agent: string;
  to_agent: string;
  content: string;
  thread_id: string | null;
  timestamp: string;
  read_by: string;
  metadata: string | null;
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

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  project_path: string;
  owner_id: string;
  created_at: string;
}

export interface ChannelMember {
  id: number;
  channel_id: string;
  member_type: "user" | "agent";
  member_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

export interface Session {
  id: number;
  type: "channel" | "dm";
  user_id: string | null;
  channel_id: string | null;
  project_path: string;
  agent_id: string;
  session_id: string;
  created_at: string;
}

export default db;
