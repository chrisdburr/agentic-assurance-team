// Types matching the team-server schema
export interface Message {
  id: string;
  from_agent: string;
  to_agent: string;
  content: string;
  thread_id: string | null;
  timestamp: string;
  read_by: string[];
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

// API functions
export async function fetchMessages(): Promise<Message[]> {
  const res = await fetch("/api/messages");
  const data = await res.json();
  return data.messages || [];
}

export async function fetchStandups(date?: string): Promise<Standup[]> {
  const url = date ? `/api/standups/${date}` : "/api/standups";
  const res = await fetch(url);
  const data = await res.json();
  return data.standups || [];
}

export async function fetchStatus(): Promise<Status[]> {
  const res = await fetch("/api/status");
  const data = await res.json();
  return data.team || [];
}

export async function fetchRoster(): Promise<TeamMember[]> {
  const res = await fetch("/api/roster");
  const data = await res.json();
  return data.members || [];
}

// WebSocket connection
export function createWebSocket(
  onMessage: (event: string, data: unknown) => void,
  onOpen?: () => void,
  onClose?: () => void
): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

  ws.onmessage = (event) => {
    try {
      const { event: eventType, data } = JSON.parse(event.data);
      onMessage(eventType, data);
    } catch (e) {
      console.error("Failed to parse WebSocket message:", e);
    }
  };

  ws.onopen = () => {
    console.log("WebSocket connected");
    onOpen?.();
  };

  ws.onclose = () => {
    console.log("WebSocket disconnected");
    onClose?.();
    // Reconnect after 3 seconds
    setTimeout(() => createWebSocket(onMessage, onOpen, onClose), 3000);
  };

  return ws;
}
