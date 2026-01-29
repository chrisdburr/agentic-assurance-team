---
name: agent-sdk-v2
description: Claude Agent SDK V2 TypeScript reference for team-of-agents. Use when writing code that uses the SDK, creating agent sessions, handling streaming, or implementing subagent patterns.
---

# Claude Agent SDK V2 TypeScript Guide

Reference for consistent SDK V2 usage in this codebase.

---

## 🚀 Quick Reference

### Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
```

### Core Functions

```typescript
import {
  unstable_v2_prompt,         // One-shot queries
  unstable_v2_createSession,  // New persistent session
  unstable_v2_resumeSession,  // Continue existing session
  type SDKMessage,
  type SDKSession,
} from "@anthropic-ai/claude-agent-sdk";
```

### Minimal Example

```typescript
import { unstable_v2_resumeSession } from "@anthropic-ai/claude-agent-sdk";

const session = unstable_v2_resumeSession("my-session-id", {
  model: "claude-sonnet-4-5-20250929",
  allowedTools: [],
  permissionMode: "bypassPermissions",
});

try {
  await session.send("Hello, Claude!");
  for await (const msg of session.stream()) {
    if (msg.type === "assistant") {
      console.log(msg.message?.content);
    }
  }
} finally {
  session.close();
}
```

---

## 📦 Sessions

### Create vs Resume

| Function | When to Use |
|----------|-------------|
| `unstable_v2_createSession()` | Fresh conversation, no history |
| `unstable_v2_resumeSession()` | Continue existing session with full context |
| `unstable_v2_prompt()` | Simple one-shot query, no session management |

**This codebase uses `unstable_v2_resumeSession()` for all agent sessions** to maintain conversation history and context across invocations.

### Session Options

```typescript
const session = unstable_v2_resumeSession(sessionId, {
  // Model to use (required)
  model: "claude-sonnet-4-5-20250929",

  // Tools the agent can use (empty = no tools)
  allowedTools: [],

  // Environment variables passed to agent process
  env: {
    ...process.env,
    AGENT_ID: "alice",
    CUSTOM_VAR: "value",
  },

  // Permission handling: "bypassPermissions" for automated agents
  permissionMode: "bypassPermissions",
});
```

### Session Scoping

Sessions can be scoped by context for isolation:

```typescript
// From team-server/src/dispatcher.ts:103-126

// Channel sessions: shared per (channel, agent)
// All users in a channel share context with the agent
const channelSession = getSessionId(agent, {
  type: "channel",
  channelId: "team",
});

// DM sessions: per (user, agent)
// Each user has isolated context with each agent
const dmSession = getSessionId(agent, {
  type: "dm",
  userId: "user-123",
});
```

### Cleanup

**Always close sessions** to release resources:

```typescript
// Option 1: Manual close in finally block (recommended for async iteration)
try {
  await session.send(prompt);
  for await (const msg of session.stream()) { /* ... */ }
} finally {
  session.close();
}

// Option 2: Using declaration (auto-close on scope exit)
await using session = unstable_v2_resumeSession(sessionId, options);
// session.close() called automatically when scope exits
```

---

## 🌊 Streaming

### Message Types

The SDK streams three message types:

| Type | Description | Content |
|------|-------------|---------|
| `system` | System information | Metadata, status |
| `assistant` | Model response | Text content, tool calls |
| `result` | Session completion | Exit status, errors |

### Text Extraction Utility

From `team-server/src/dispatcher.ts:192-202`:

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

### Streaming to WebSocket/SSE

Pattern from `team-server/src/dispatcher.ts:228-255`:

```typescript
for await (const msg of session.stream()) {
  // Extract and broadcast text content
  const textContent = extractTextContent(msg);
  if (textContent && broadcast) {
    broadcast("agent_stream", {
      agent,
      sessionId,
      content: textContent,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle result for exit status
  if (msg.type === "result") {
    const exitCode = msg.subtype === "success" ? 0 : 1;
    // Log errors if present
    if (msg.is_error && "errors" in msg) {
      console.error("Session errors:", msg.errors);
    }
  }
}
```

### Error Handling

```typescript
try {
  await session.send(prompt);
  for await (const msg of session.stream()) {
    if (msg.type === "result") {
      if (msg.subtype !== "success") {
        console.error("Session failed:", msg.is_error, msg.errors);
      }
    }
  }
} catch (error) {
  console.error("Session error:", error);
  // Handle network errors, timeouts, etc.
} finally {
  session.close();
}
```

---

## 🤖 Subagents

### Programmatic Definition

Use the `agents` parameter in session options:

```typescript
const session = unstable_v2_createSession({
  model: "claude-sonnet-4-5-20250929",
  agents: [
    {
      name: "researcher",
      description: "Searches documentation and code",
      model: "claude-haiku-4-5-20250929", // Can use different model
      allowedTools: ["Grep", "Glob", "Read"],
    },
  ],
});
```

### Filesystem-Based Agents

Agents can be defined in `.claude/agents/*.md`:

```markdown
---
name: alice
description: Philosopher for epistemology and argumentation
model: opus
permissionMode: dontAsk
allowedTools:
  - Read
  - Edit
  - Write
  - Bash(git *)
  - Grep
  - Glob
  - mcp__team__message_send
  - mcp__team__ask_agent
---

# Alice - Philosopher Agent

You are Alice, a philosopher specializing in...
```

### Safeguards for ask_agent

From `team-server/src/tools.ts:29-33`:

```typescript
// Safeguard constants
const MAX_ASK_DEPTH = 3;           // Prevent infinite recursion
const MAX_ASK_CALLS_PER_SESSION = 10;  // Limit total calls
const ASK_TIMEOUT_MS = 60_000;     // 60 second timeout
```

Implemented checks (from `team-server/src/tools.ts:510-545`):

1. **Depth limit**: Tracks `ASK_DEPTH` in env, rejects if >= MAX_ASK_DEPTH
2. **Call count**: Tracks calls per session, rejects if > MAX_ASK_CALLS
3. **No self-calls**: Agent cannot call itself
4. **No circular chains**: `ASK_CALLER_CHAIN` prevents A→B→A callbacks

### Timeout Pattern

From `team-server/src/tools.ts:601-617`:

```typescript
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error("Timeout")), ASK_TIMEOUT_MS);
});

await Promise.race([
  (async () => {
    for await (const msg of session.stream()) {
      // Process messages...
    }
  })(),
  timeoutPromise,
]);
```

---

## ⚡ Slash Commands

### Built-in Commands

- `/compact` - Compress conversation history
- `/clear` - Clear conversation
- `/help` - Show available commands

### Custom Commands

Create `.claude/commands/<name>.md`:

```markdown
---
description: Short description shown in command list
argument-hint: <required-arg> [optional-arg]
allowed-tools: Bash(git *), Read, Write
---

# Command Title

Your command instructions here.

Arguments are available as `$ARGUMENTS`.
```

### Frontmatter Options

| Option | Description |
|--------|-------------|
| `description` | Shown in `/help` and command palette |
| `argument-hint` | Usage hint for arguments |
| `allowed-tools` | Tools this command can use (comma-separated) |

---

## 🏗️ App-Specific Patterns

### MCP Server Integration

Tools are defined in `team-server/src/tools.ts:76-315` and handled via MCP protocol:

```typescript
// Tool definition
export const toolDefinitions = [
  {
    name: "message_send",
    description: "Send a message to another team member",
    inputSchema: {
      type: "object" as const,
      properties: {
        to: { type: "string", description: "Recipient agent ID" },
        content: { type: "string", description: "Message content" },
      },
      required: ["to", "content"],
    },
  },
  // ... more tools
];

// Handler
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const agentId = getAgentId();
  switch (name) {
    case "message_send":
      // Implementation
    // ...
  }
}
```

### Agent State Management

From `team-server/src/dispatcher.ts:57-64`:

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

### Health Monitoring

From `team-server/src/dispatcher.ts:148-182`:

| Status | Condition |
|--------|-----------|
| 🟢 green | Idle, no issues, last exit 0 |
| 🟡 yellow | In cooldown, or active < 2 min |
| 🔴 red | Active > 2 min (stuck), or last exit non-zero |

### Cooldown & Rate Limiting

```typescript
// Configuration from team-server/src/dispatcher.ts:32-39
const POLL_INTERVAL = 5000;  // Check for messages every 5s
const COOLDOWN = 60000;      // 60s between triggers per agent

function canTrigger(agent: AgentId): boolean {
  const state = agentState[agent];
  const now = Date.now();

  // Respect cooldown
  if (now - state.lastTriggerTime < COOLDOWN) return false;

  // Don't trigger if already active
  if (state.activeSession !== null) return false;

  return true;
}
```

---

## ⚠️ Rules & Best Practices

### MUST DO

- ✅ **Always close sessions** (manually in finally block or via `await using`)
- ✅ **Use `unstable_v2_resumeSession`** for persistent agents that need context
- ✅ **Check `result.subtype`** for success/failure status
- ✅ **Implement timeouts** for subagent calls (60s default in this codebase)
- ✅ **Pass `AGENT_ID` via env** for tool authentication
- ✅ **Track call depth and chains** to prevent infinite recursion

### MUST NOT

- ❌ **Don't include Task tool** in subagent's allowedTools (prevents nested spawning)
- ❌ **Don't allow self-calls** in ask_agent
- ❌ **Don't allow circular call chains** (A→B→A)
- ❌ **Don't forget cleanup** - leaked sessions consume resources

### App-Specific Defaults

```typescript
// From team-server/src/dispatcher.ts:187
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

// Standard session setup for team agents
const session = unstable_v2_resumeSession(sessionId, {
  model: DEFAULT_MODEL,
  allowedTools: [],  // MCP tools provided separately
  env: { ...process.env, AGENT_ID: agent },
  permissionMode: "bypassPermissions",
});
```

---

## 📚 Key File References

| File | Lines | Purpose |
|------|-------|---------|
| `team-server/src/dispatcher.ts` | 12-16 | SDK imports |
| `team-server/src/dispatcher.ts` | 192-202 | extractTextContent utility |
| `team-server/src/dispatcher.ts` | 208-272 | runAgentSession pattern |
| `team-server/src/tools.ts` | 29-33 | Safeguard constants |
| `team-server/src/tools.ts` | 504-665 | ask_agent implementation |
| `.claude/agents/alice.md` | - | Agent definition format |
