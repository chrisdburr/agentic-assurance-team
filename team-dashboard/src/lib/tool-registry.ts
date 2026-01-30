export interface Tool {
  id: string;
  label: string;
}

export interface ToolCategory {
  name: string;
  tools: Tool[];
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    name: "Core Tools",
    tools: [
      { id: "Read", label: "Read" },
      { id: "Edit", label: "Edit" },
      { id: "Write", label: "Write" },
      { id: "Bash", label: "Bash" },
      { id: "Grep", label: "Grep" },
      { id: "Glob", label: "Glob" },
      { id: "WebFetch", label: "WebFetch" },
      { id: "WebSearch", label: "WebSearch" },
    ],
  },
  {
    name: "Bash Variants",
    tools: [
      { id: "Bash(git *)", label: "Bash(git)" },
      { id: "Bash(bun *)", label: "Bash(bun)" },
      { id: "Bash(python *)", label: "Bash(python)" },
      { id: "Bash(pytest *)", label: "Bash(pytest)" },
    ],
  },
  {
    name: "MCP Messaging",
    tools: [
      { id: "mcp__team__message_send", label: "message_send" },
      { id: "mcp__team__message_list", label: "message_list" },
      { id: "mcp__team__message_mark_read", label: "message_mark_read" },
      { id: "mcp__team__message_thread", label: "message_thread" },
    ],
  },
  {
    name: "MCP Standups",
    tools: [
      { id: "mcp__team__standup_post", label: "standup_post" },
      { id: "mcp__team__standup_today", label: "standup_today" },
      { id: "mcp__team__standup_orchestrate", label: "standup_orchestrate" },
      { id: "mcp__team__standup_session_get", label: "standup_session_get" },
    ],
  },
  {
    name: "MCP Status",
    tools: [
      { id: "mcp__team__status_update", label: "status_update" },
      { id: "mcp__team__status_team", label: "status_team" },
      { id: "mcp__team__team_roster", label: "team_roster" },
      { id: "mcp__team__ask_agent", label: "ask_agent" },
    ],
  },
  {
    name: "MCP Channels",
    tools: [
      { id: "mcp__team__channel_read", label: "channel_read" },
      { id: "mcp__team__channel_write", label: "channel_write" },
      { id: "mcp__team__channel_list", label: "channel_list" },
    ],
  },
];

export const ALL_TOOLS: Tool[] = TOOL_CATEGORIES.flatMap((c) => c.tools);

const CORE_IDS = new Set(
  TOOL_CATEGORIES.filter(
    (c) => c.name === "Core Tools" || c.name === "Bash Variants"
  ).flatMap((c) => c.tools.map((t) => t.id))
);

const MCP_IDS = new Set(
  TOOL_CATEGORIES.filter((c) => c.name.startsWith("MCP")).flatMap((c) =>
    c.tools.map((t) => t.id)
  )
);

export function selectAll(): string[] {
  return ALL_TOOLS.map((t) => t.id);
}

export function selectCore(): string[] {
  return ALL_TOOLS.filter((t) => CORE_IDS.has(t.id)).map((t) => t.id);
}

export function selectAllMcp(): string[] {
  return ALL_TOOLS.filter((t) => MCP_IDS.has(t.id)).map((t) => t.id);
}
