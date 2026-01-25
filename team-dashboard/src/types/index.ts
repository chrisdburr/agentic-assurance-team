// Message from the team server
export interface Message {
  id: number;
  timestamp: string;
  from_agent: string;
  to_agent: string;
  message_type: string;
  content: string;
  payload?: Record<string, unknown>;
  tags?: string[];
}

// Agent status from dispatcher
export interface AgentStatus {
  name: string;
  isActive: boolean;
  sessionId?: string;
  lastActivity?: string;
}

// Roster entry
export interface RosterEntry {
  name: string;
  role: string;
  status: string;
}

// WebSocket events
export type WSEventType =
  | "message"
  | "status"
  | "agent_triggered"
  | "agent_session_ended"
  | "connected"
  | "error";

export interface WSEvent {
  type: WSEventType;
  data?: unknown;
}

// Message filters
export interface MessageFilter {
  to_agent?: string;
  from_agent?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}
