import type { Message, ChannelMessage, AgentStatus, RosterEntry, MessageFilter, MonitoringData } from "@/types";

// Next.js rewrites /backend/* to team-server
const API_BASE = "/backend";

// Fetch messages with optional filters (for DMs)
export async function fetchMessages(filter?: MessageFilter): Promise<Message[]> {
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
export async function fetchChannelMessages(channel: string): Promise<ChannelMessage[]> {
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
    const error = await res.json().catch(() => ({ error: "Failed to send message" }));
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
  // - Messages FROM agent TO user
  const userToAgent = toAgent.filter((m) => m.from_agent === "user");
  const agentToUser = fromAgent.filter((m) => m.to_agent === "user");

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
    const error = await res.json().catch(() => ({ error: "Failed to send message" }));
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
export async function triggerAgent(agent: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/dispatcher/trigger/${agent}`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to trigger agent");
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
export async function startStandup(): Promise<{
  success: boolean;
  session_id?: string;
  summary?: string;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/standup/start`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to start standup");
  }
  return data;
}
