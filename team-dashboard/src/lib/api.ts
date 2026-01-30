import type {
  Agent,
  AgentStatus,
  AggregatedEventsResult,
  ChannelMessage,
  CreateAgentInput,
  Message,
  MessageFilter,
  MonitoringData,
  RosterEntry,
  UpdateAgentInput,
} from "@/types";

// Proxied through /api/backend/* route handler which injects user identity
const API_BASE = "/api/backend";

// Fetch aggregated events across all agents
export async function fetchEvents(params?: {
  limit?: number;
  event_types?: string[];
  since?: string;
}): Promise<AggregatedEventsResult> {
  const searchParams = new URLSearchParams();
  if (params?.limit) {
    searchParams.set("limit", String(params.limit));
  }
  if (params?.event_types?.length) {
    searchParams.set("event_types", params.event_types.join(","));
  }
  if (params?.since) {
    searchParams.set("since", params.since);
  }

  const qs = searchParams.toString();
  const url = `${API_BASE}/events${qs ? `?${qs}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch events");
  }
  return res.json();
}

// Fetch messages with optional filters (for DMs)
export async function fetchMessages(
  filter?: MessageFilter
): Promise<Message[]> {
  const params = new URLSearchParams();
  if (filter?.to_agent) params.set("to_agent", filter.to_agent);
  if (filter?.from_agent) params.set("from_agent", filter.from_agent);
  if (filter?.limit) params.set("limit", String(filter.limit));
  if (filter?.offset) params.set("offset", String(filter.offset));

  const url = `${API_BASE}/messages${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch messages");
  const data = await res.json();
  // API returns { messages: [...] }
  return data.messages || [];
}

// Fetch messages for a channel (uses new JSONL-based channel API)
export async function fetchChannelMessages(
  channel: string
): Promise<ChannelMessage[]> {
  const res = await fetch(`${API_BASE}/channels/${channel}/messages`);
  if (!res.ok) throw new Error(`Failed to fetch channel messages: ${channel}`);
  const data = await res.json();
  return data.messages || [];
}

// Send a message to a channel
export async function sendChannelMessage(
  channel: string,
  content: string
): Promise<{ success: boolean; message: ChannelMessage }> {
  const res = await fetch(`${API_BASE}/channels/${channel}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to send message" }));
    throw new Error(error.error || "Failed to send channel message");
  }
  return res.json();
}

// Fetch DM messages (conversation between user and agent)
export async function fetchDMMessages(agent: string): Promise<Message[]> {
  // Get messages between user and agent in both directions
  const [toAgent, fromAgent] = await Promise.all([
    fetchMessages({ to_agent: agent }),
    fetchMessages({ from_agent: agent }),
  ]);

  // Filter to only messages in this specific conversation
  // - Messages FROM user TO agent
  // - Messages FROM agent TO user (or to the user's actual username)
  const userToAgent = toAgent.filter((m) => m.from_agent === "user");
  const agentToUser = fromAgent.filter((m) => m.to_agent !== agent);

  // Merge and sort by timestamp
  const all = [...userToAgent, ...agentToUser];
  const unique = Array.from(new Map(all.map((m) => [m.id, m])).values());
  return unique.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

// Fetch dispatcher status
export async function fetchDispatcherStatus(): Promise<{
  agents: AgentStatus[];
}> {
  const res = await fetch(`${API_BASE}/dispatcher/status`);
  if (!res.ok) throw new Error("Failed to fetch dispatcher status");
  return res.json();
}

// Fetch team roster
export async function fetchRoster(): Promise<RosterEntry[]> {
  const res = await fetch(`${API_BASE}/roster`);
  if (!res.ok) throw new Error("Failed to fetch roster");
  return res.json();
}

// Send a new message
export async function sendMessage(
  to: string,
  content: string,
  threadId?: string
): Promise<{ success: boolean; message_id: string; thread_id: string }> {
  const res = await fetch(`${API_BASE}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, content, thread_id: threadId }),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to send message" }));
    throw new Error(error.error || "Failed to send message");
  }
  return res.json();
}

// Fetch monitoring data from dispatcher
export async function fetchMonitoringData(): Promise<MonitoringData> {
  const res = await fetch(`${API_BASE}/dispatcher/status`);
  if (!res.ok) throw new Error("Failed to fetch monitoring data");
  return res.json();
}

// Manually trigger an agent
export async function triggerAgent(
  agent: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/dispatcher/trigger/${agent}`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to trigger agent");
  }
  return data;
}

// Refresh an agent's session (delete old, create new)
export async function refreshAgentSession(agent: string): Promise<{
  success: boolean;
  error?: string;
  oldSessionId?: string;
  newSessionId?: string;
}> {
  const res = await fetch(`${API_BASE}/dispatcher/refresh/${agent}`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to refresh agent session");
  }
  return data;
}

// Fetch team status
export async function fetchTeamStatus(): Promise<{
  team: Array<{
    agent_id: string;
    status: string;
    working_on: string | null;
    updated_at: string;
  }>;
}> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error("Failed to fetch team status");
  return res.json();
}

// Start a standup session
export async function startStandup(channel?: string): Promise<{
  success: boolean;
  session_id?: string;
  summary?: string;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/standup/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel }),
  });

  // Handle non-JSON responses gracefully
  const contentType = res.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    const text = await res.text();
    throw new Error(text || "Server returned non-JSON response");
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to start standup");
  }
  return data;
}

// Start a task decomposition via orchestrator
export async function startDecomposition(
  task: string,
  channel?: string
): Promise<{
  success: boolean;
  session_id?: string;
  channel?: string;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/orchestrate/decompose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, channel }),
  });

  const contentType = res.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    const text = await res.text();
    throw new Error(text || "Server returned non-JSON response");
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to start decomposition");
  }
  return data;
}

// Check orchestration status for an epic
export async function checkOrchestrationStatus(
  epicId: string,
  channel?: string
): Promise<{
  success: boolean;
  session_id?: string;
  channel?: string;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/orchestrate/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ epic_id: epicId, channel }),
  });

  const contentType = res.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    const text = await res.text();
    throw new Error(text || "Server returned non-JSON response");
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to check orchestration status");
  }
  return data;
}

// Change user password
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, currentPassword, newPassword }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to change password");
  }
  return data;
}

// Channel member types
export interface ChannelMember {
  id: number;
  channel_id: string;
  member_type: "user" | "agent";
  member_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

// Fetch channel members
export async function fetchChannelMembers(
  channelId: string
): Promise<ChannelMember[]> {
  const res = await fetch(`${API_BASE}/channels/${channelId}/members`);
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to fetch members" }));
    throw new Error(error.error || "Failed to fetch channel members");
  }
  const data = await res.json();
  return data.members || [];
}

// Add a member to a channel
export async function addChannelMember(
  channelId: string,
  memberType: "user" | "agent",
  memberId: string,
  role: "member" | "admin" = "member"
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/channels/${channelId}/members`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "add",
      member_type: memberType,
      member_id: memberId,
      role,
    }),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to add member" }));
    throw new Error(error.error || "Failed to add channel member");
  }
  return res.json();
}

// Remove a member from a channel
export async function removeChannelMember(
  channelId: string,
  memberType: "user" | "agent",
  memberId: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/channels/${channelId}/members`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "remove",
      member_type: memberType,
      member_id: memberId,
    }),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to remove member" }));
    throw new Error(error.error || "Failed to remove channel member");
  }
  return res.json();
}

// Transfer channel ownership
export async function transferChannelOwnership(
  channelId: string,
  newOwnerId: string
): Promise<{ success: boolean; new_owner_id: string }> {
  const res = await fetch(
    `${API_BASE}/channels/${channelId}/transfer-ownership`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_owner_id: newOwnerId }),
    }
  );
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to transfer ownership" }));
    throw new Error(error.error || "Failed to transfer channel ownership");
  }
  return res.json();
}

// Delete a channel
export async function deleteChannel(
  channelId: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/channels/${channelId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to delete channel" }));
    throw new Error(error.error || "Failed to delete channel");
  }
  return res.json();
}

// Fetch all agents from the library
export async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch(`${API_BASE}/agents`);
  if (!res.ok) {
    throw new Error("Failed to fetch agents");
  }
  const data = await res.json();
  return data.agents || [];
}

// Fetch a single agent by ID
export async function fetchAgent(id: string): Promise<Agent> {
  const res = await fetch(`${API_BASE}/agents/${id}`);
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to fetch agent" }));
    throw new Error(error.error || "Failed to fetch agent");
  }
  const data = await res.json();
  return data.agent;
}

// Generate a system prompt for a new agent using AI
export async function generateSystemPrompt(input: {
  name?: string;
  description: string;
  model?: string;
}): Promise<{ system_prompt: string }> {
  const res = await fetch(`${API_BASE}/agents/generate-prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to generate system prompt" }));
    throw new Error(error.error || "Failed to generate system prompt");
  }
  return res.json();
}

// Upload an avatar image for an agent
export async function uploadAvatar(
  name: string,
  file: File
): Promise<{ success: boolean; url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);

  const res = await fetch("/api/avatars/upload", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to upload avatar" }));
    throw new Error(error.error || "Failed to upload avatar");
  }
  return res.json();
}

// Create a new agent
export async function createAgentApi(
  input: CreateAgentInput
): Promise<{ success: boolean; agent: Agent }> {
  const res = await fetch(`${API_BASE}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to create agent" }));
    throw new Error(error.error || "Failed to create agent");
  }
  return res.json();
}

// Update an agent (e.g. allowed tools)
export async function updateAgentApi(
  id: string,
  input: UpdateAgentInput
): Promise<{ success: boolean; agent: Agent }> {
  const res = await fetch(`${API_BASE}/agents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to update agent" }));
    throw new Error(error.error || "Failed to update agent");
  }
  return res.json();
}

// Delete an agent
export async function deleteAgentApi(
  id: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/agents/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to delete agent" }));
    throw new Error(error.error || "Failed to delete agent");
  }
  return res.json();
}

// User management API functions (admin only)

// User type for API responses
export interface ApiUser {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

// Fetch all users (admin only)
export async function fetchUsers(): Promise<ApiUser[]> {
  const res = await fetch(`${API_BASE}/users`);
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to fetch users" }));
    throw new Error(error.error || "Failed to fetch users");
  }
  const data = await res.json();
  return data.users || [];
}

// Create a new user (admin only)
export async function createUserApi(input: {
  username: string;
  email: string;
  password: string;
  is_admin?: boolean;
}): Promise<{ success: boolean; user: ApiUser }> {
  const res = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to create user" }));
    throw new Error(error.error || "Failed to create user");
  }
  return res.json();
}

// Update a user (admin only)
export async function updateUserApi(
  userId: string,
  input: { email?: string; is_admin?: boolean }
): Promise<{ success: boolean; user: ApiUser }> {
  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to update user" }));
    throw new Error(error.error || "Failed to update user");
  }
  return res.json();
}

// Delete a user (admin only)
export async function deleteUserApi(
  userId: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to delete user" }));
    throw new Error(error.error || "Failed to delete user");
  }
  return res.json();
}
