// Message from the team server (DMs)
export interface Message {
  id: string;
  from_agent: string;
  to_agent: string;
  content: string;
  thread_id: string;
  timestamp: string;
  read_by: string;
  mentions?: string; // JSON array of agent IDs mentioned in the message
}

// Channel message from JSONL storage
export interface ChannelMessage {
  id: string;
  timestamp: string;
  from: string;
  content: string;
  mentions: string[];
  thread_id: string | null;
}

// Normalized message type for display (works for both DMs and channels)
export interface DisplayMessage {
  id: string;
  from: string;
  content: string;
  timestamp: string;
  thread_id: string | null;
  mentions?: string[];
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
  | "channel_message"
  | "status"
  | "agent_triggered"
  | "agent_session_ended"
  | "agent_trigger_failed"
  | "dispatcher_status"
  | "session_refreshed"
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

// Health status for agents
export type HealthStatus = "green" | "yellow" | "red";

// Agent monitoring data
export interface AgentMonitoringData {
  lastTrigger: string | null;
  lastSeenMessage: string | null;
  active: boolean;
  triggerCount: number;
  health: HealthStatus;
  lastExitCode: number | null;
  activeForMs: number | null;
  cooldownRemainingMs: number | null;
}

// Full monitoring data from dispatcher
export interface MonitoringData {
  enabled: boolean;
  pollInterval: number;
  cooldown: number;
  agents: Record<string, AgentMonitoringData>;
}

// Agent from the agents library
export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  system_prompt: string;
  is_system: boolean;
  owner: string | null;
  allowed_tools?: string[];
}

// Input for creating a new agent
export interface CreateAgentInput {
  name: string;
  description: string;
  model: string;
  system_prompt: string;
  allowed_tools?: string[];
}

// User from the admin API
export interface User {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

// Input for creating a new user
export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  is_admin?: boolean;
}

// Input for updating a user
export interface UpdateUserInput {
  email?: string;
  is_admin?: boolean;
}

// Input for updating an agent
export interface UpdateAgentInput {
  allowed_tools?: string[];
}
