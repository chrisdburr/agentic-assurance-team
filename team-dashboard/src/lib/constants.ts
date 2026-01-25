// Agent definitions with their colors
export const AGENTS = {
  alice: {
    id: "alice",
    name: "Alice",
    color: "purple",
    bgColor: "bg-purple-500",
    textColor: "text-purple-500",
    borderColor: "border-purple-500",
  },
  bob: {
    id: "bob",
    name: "Bob",
    color: "blue",
    bgColor: "bg-blue-500",
    textColor: "text-blue-500",
    borderColor: "border-blue-500",
  },
  charlie: {
    id: "charlie",
    name: "Charlie",
    color: "green",
    bgColor: "bg-green-500",
    textColor: "text-green-500",
    borderColor: "border-green-500",
  },
} as const;

export type AgentId = keyof typeof AGENTS;

// Channel definitions
export const CHANNELS = [
  {
    id: "team",
    name: "team",
    description: "Team broadcast channel",
  },
  {
    id: "research",
    name: "research",
    description: "Research discussion",
  },
] as const;

export type ChannelId = (typeof CHANNELS)[number]["id"];

// Get agent by ID with fallback
export function getAgent(id: string) {
  return AGENTS[id as AgentId] || {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    color: "gray",
    bgColor: "bg-gray-500",
    textColor: "text-gray-500",
    borderColor: "border-gray-500",
  };
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
