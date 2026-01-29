# Session Management

## How Sessions Work

When you start a new query, the SDK automatically creates a session and returns a session ID in the initial system message. You can capture this ID to resume the session later.

## Getting the Session ID

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

let sessionId: string | undefined;

for await (const message of query({
  prompt: "Help me build a web application",
  options: { model: "claude-sonnet-4-5" }
})) {
  // The first message is a system init message with the session ID
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
    console.log(`Session started with ID: ${sessionId}`);
  }
}
```

```python
from claude_agent_sdk import query, ClaudeAgentOptions

session_id = None

async for message in query(
    prompt="Help me build a web application",
    options=ClaudeAgentOptions(model="claude-sonnet-4-5")
):
    if hasattr(message, 'subtype') and message.subtype == 'init':
        session_id = message.data.get('session_id')
        print(f"Session started with ID: {session_id}")
```

## Resuming Sessions

Use the `resume` option with a session ID to continue a previous conversation:

```typescript
// Resume a previous session using its ID
for await (const message of query({
  prompt: "Continue where we left off",
  options: {
    resume: "session-xyz",  // Session ID from previous conversation
    model: "claude-sonnet-4-5",
    allowedTools: ["Read", "Edit", "Write", "Glob", "Grep", "Bash"]
  }
})) {
  console.log(message);
}
```

```python
async for message in query(
    prompt="Continue where we left off",
    options=ClaudeAgentOptions(
        resume="session-xyz",
        model="claude-sonnet-4-5",
        allowed_tools=["Read", "Edit", "Write", "Glob", "Grep", "Bash"]
    )
):
    print(message)
```

## Forking Sessions

When resuming, you can fork into a new branch instead of modifying the original:

| Behavior | `forkSession: false` (default) | `forkSession: true` |
|----------|-------------------------------|---------------------|
| **Session ID** | Same as original | New session ID generated |
| **History** | Appends to original session | Creates new branch |
| **Original Session** | Modified | Preserved unchanged |
| **Use Case** | Continue linear conversation | Explore alternatives |

```typescript
// Fork to try a different approach
for await (const message of query({
  prompt: "Let's try a GraphQL approach instead",
  options: {
    resume: sessionId,
    forkSession: true,  // Creates a new session ID
    model: "claude-sonnet-4-5"
  }
})) {
  if (message.type === "system" && message.subtype === "init") {
    console.log(`Forked session: ${message.session_id}`);
  }
}
```

## Session Scoping (team-of-agents)

In this codebase, sessions are scoped by context:

```typescript
// From team-server/src/dispatcher.ts:103-126

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

// DM sessions: per (user, agent) - isolated context
const dmSession = getSessionId(agent, {
  type: "dm",
  userId: "user-123",
});
```

## Session Cleanup

Always close sessions to release resources. The SDK doesn't auto-cleanup.

```typescript
// For streaming: use try/finally
const response = query({ prompt, options });
try {
  for await (const msg of response) { /* ... */ }
} finally {
  // Sessions auto-close when iteration completes
}
```
