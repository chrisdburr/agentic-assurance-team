import type { Message, AgentStatus, RosterEntry, MessageFilter } from "@/types";

const API_BASE = "/api/backend";

// Fetch messages with optional filters
export async function fetchMessages(filter?: MessageFilter): Promise<Message[]> {
  const params = new URLSearchParams();
  if (filter?.to_agent) params.set("to_agent", filter.to_agent);
  if (filter?.from_agent) params.set("from_agent", filter.from_agent);
  if (filter?.limit) params.set("limit", String(filter.limit));
  if (filter?.offset) params.set("offset", String(filter.offset));

  const url = `${API_BASE}/messages${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

// Fetch messages for a channel (to_agent = channel name)
export async function fetchChannelMessages(channel: string): Promise<Message[]> {
  return fetchMessages({ to_agent: channel });
}

// Fetch DM messages (conversation between user and agent)
export async function fetchDMMessages(agent: string): Promise<Message[]> {
  // Get messages to and from the agent
  const [toAgent, fromAgent] = await Promise.all([
    fetchMessages({ to_agent: agent }),
    fetchMessages({ from_agent: agent }),
  ]);

  // Merge and sort by timestamp
  const all = [...toAgent, ...fromAgent];
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
