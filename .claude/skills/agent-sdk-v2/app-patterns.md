# App-Specific Patterns (team-of-agents)

Patterns specific to this codebase.

## Default Session Configuration

From `team-server/src/dispatcher.ts`:

```typescript
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

const session = unstable_v2_resumeSession(sessionId, {
  model: DEFAULT_MODEL,
  allowedTools: [],  // MCP tools provided via server
  env: {
    ...process.env,
    AGENT_ID: agent,
  },
  permissionMode: "bypassPermissions",
});
```

## Session Scoping

```typescript
interface SessionContext {
  type: "channel" | "dm";
  channelId?: string;
  userId?: string;
}

// Channel sessions: shared per (channel, agent)
const channelSession = getSessionId(agent, {
  type: "channel",
  channelId: "team",
});

// DM sessions: per (user, agent) - isolated
const dmSession = getSessionId(agent, {
  type: "dm",
  userId: "user-123",
});
```

## Agent State Management

```typescript
interface AgentState {
  lastTriggerTime: number;
  lastSeenMessageTime: string;     // ISO timestamp
  activeSession: SDKSession | null;
  triggerCount: number;
  lastExitCode: number | null;
  lastActiveStart: number | null;
}
```

## Health Monitoring

| Status | Condition |
|--------|-----------|
| 🟢 green | Idle, no issues, last exit 0 |
| 🟡 yellow | In cooldown, or active < 2 min |
| 🔴 red | Active > 2 min (stuck), or last exit non-zero |

```typescript
function getAgentHealth(agent: AgentId): HealthStatus {
  const state = agentState[agent];
  const now = Date.now();
  const TWO_MINUTES = 2 * 60 * 1000;

  if (state.activeSession !== null && state.lastActiveStart !== null) {
    const activeTime = now - state.lastActiveStart;
    if (activeTime > TWO_MINUTES) return "red";
    return "yellow";
  }

  if (now - state.lastTriggerTime < COOLDOWN) return "yellow";
  if (state.lastExitCode !== null && state.lastExitCode !== 0) return "red";

  return "green";
}
```

## Cooldown & Rate Limiting

```typescript
const POLL_INTERVAL = 5000;  // Check every 5s
const COOLDOWN = 60000;      // 60s between triggers

function canTrigger(agent: AgentId): boolean {
  const state = agentState[agent];
  const now = Date.now();

  if (now - state.lastTriggerTime < COOLDOWN) return false;
  if (state.activeSession !== null) return false;

  return true;
}
```

## ask_agent Safeguards

From `team-server/src/tools.ts`:

```typescript
const MAX_ASK_DEPTH = 3;
const MAX_ASK_CALLS_PER_SESSION = 10;
const ASK_TIMEOUT_MS = 60_000;
```

### Checks Implemented

1. **Depth limit**: Tracks `ASK_DEPTH` in env, rejects if >= MAX_ASK_DEPTH
2. **Call count**: Tracks per session, rejects if > MAX_ASK_CALLS
3. **No self-calls**: Agent cannot call itself
4. **No circular chains**: `ASK_CALLER_CHAIN` prevents A→B→A

```typescript
// Safeguard 1: Depth
if (currentDepth >= MAX_ASK_DEPTH) {
  return { success: false, error: `Maximum ask depth reached` };
}

// Safeguard 2: Call count
askCallCount++;
if (askCallCount > MAX_ASK_CALLS_PER_SESSION) {
  return { success: false, error: `Maximum calls reached` };
}

// Safeguard 3: No self-calls
if (agent === callerAgent) {
  return { success: false, error: "Cannot ask yourself" };
}

// Safeguard 4: No circular chains
if (callerChain.includes(agent)) {
  return { success: false, error: `Cannot call ${agent} - in caller chain` };
}
```

### Timeout Pattern

```typescript
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error("Timeout")), ASK_TIMEOUT_MS);
});

await Promise.race([
  (async () => {
    for await (const msg of session.stream()) {
      const text = extractTextContent(msg);
      if (text) response += text;
    }
  })(),
  timeoutPromise,
]);
```

## Text Extraction Utility

```typescript
function extractTextContent(msg: SDKMessage): string | null {
  if (msg.type === "assistant" && msg.message?.content) {
    const textBlocks = msg.message.content.filter(
      (block): block is { type: "text"; text: string } => block.type === "text"
    );
    if (textBlocks.length > 0) {
      return textBlocks.map((b) => b.text).join("");
    }
  }
  return null;
}
```

## MCP Tool Definitions

```typescript
export const toolDefinitions = [
  {
    name: "message_send",
    description: "Send a message to another team member",
    inputSchema: {
      type: "object" as const,
      properties: {
        to: { type: "string", description: "Recipient agent ID" },
        content: { type: "string", description: "Message content" },
        thread_id: { type: "string", description: "Optional thread ID" },
      },
      required: ["to", "content"],
    },
  },
  // ... more tools
];

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const agentId = getAgentId();
  switch (name) {
    case "message_send":
      const { to, content, thread_id } = args;
      const messageId = sendMessage(agentId, to, content, thread_id);
      return { success: true, message_id: messageId };
    // ...
  }
}
```

## Key File References

| File | Lines | Purpose |
|------|-------|---------|
| `team-server/src/dispatcher.ts` | 12-16 | SDK imports |
| `team-server/src/dispatcher.ts` | 57-64 | AgentState interface |
| `team-server/src/dispatcher.ts` | 148-182 | Health monitoring |
| `team-server/src/dispatcher.ts` | 192-202 | extractTextContent |
| `team-server/src/dispatcher.ts` | 208-272 | runAgentSession |
| `team-server/src/tools.ts` | 29-33 | Safeguard constants |
| `team-server/src/tools.ts` | 504-665 | ask_agent implementation |
| `.claude/agents/*.md` | - | Agent definitions |
