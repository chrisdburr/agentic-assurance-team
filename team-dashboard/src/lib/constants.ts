// Agent definitions with their colors (using theme CSS variables)
export const AGENTS = {
  alice: {
    id: "alice",
    name: "Alice",
    avatar: "/avatars/alice.jpeg",
    color: "chart-2",
    bgColor: "bg-[var(--chart-2)]",
    textColor: "text-[var(--chart-2)]",
    borderColor: "border-[var(--chart-2)]",
  },
  bob: {
    id: "bob",
    name: "Bob",
    avatar: "/avatars/bob.jpeg",
    color: "chart-3",
    bgColor: "bg-[var(--chart-3)]",
    textColor: "text-[var(--chart-3)]",
    borderColor: "border-[var(--chart-3)]",
  },
  charlie: {
    id: "charlie",
    name: "Charlie",
    avatar: "/avatars/charlie.jpeg",
    color: "chart-1",
    bgColor: "bg-[var(--chart-1)]",
    textColor: "text-[var(--chart-1)]",
    borderColor: "border-[var(--chart-1)]",
  },
} as const;

export type AgentId = keyof typeof AGENTS;

// Channel type for API responses
// Note: Channels are now fetched dynamically from the API
// See NavChannels component and /api/backend/channels endpoint
export interface Channel {
  id: string;
  name: string;
  description?: string;
  owner_id?: string;
}

// Get agent by ID with fallback
export function getAgent(id: string) {
  return (
    AGENTS[id as AgentId] || {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      avatar: undefined as string | undefined,
      color: "muted",
      bgColor: "bg-muted-foreground",
      textColor: "text-muted-foreground",
      borderColor: "border-muted-foreground",
    }
  );
}

// Health status colors
export const HEALTH_STATUS = {
  green: {
    bgColor: "bg-green-500",
    textColor: "text-green-500",
    borderColor: "border-green-500",
    label: "Healthy",
  },
  yellow: {
    bgColor: "bg-yellow-500",
    textColor: "text-yellow-500",
    borderColor: "border-yellow-500",
    label: "Busy",
  },
  red: {
    bgColor: "bg-red-500",
    textColor: "text-red-500",
    borderColor: "border-red-500",
    label: "Issue",
  },
} as const;
