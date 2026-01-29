---
name: agent-sdk-v2
description: Claude Agent SDK V2 TypeScript/Python reference. Use when writing SDK code, creating sessions, handling streaming, implementing subagents, or configuring MCP servers.
---

# Claude Agent SDK V2 Guide

Quick reference for the Agent SDK. For deeper topics, see the supporting files linked in each section.

## Quick Start

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Analyze this codebase",
  options: {
    model: "claude-sonnet-4-5",
    allowedTools: ["Read", "Grep", "Glob"],
    permissionMode: "acceptEdits"
  }
})) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
```

```python
from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage

async for message in query(
    prompt="Analyze this codebase",
    options=ClaudeAgentOptions(
        model="claude-sonnet-4-5",
        allowed_tools=["Read", "Grep", "Glob"],
        permission_mode="acceptEdits"
    )
):
    if isinstance(message, ResultMessage) and message.subtype == "success":
        print(message.result)
```

---

## Sessions

**For complete session management details, see [sessions.md](sessions.md)**

| Pattern | Use Case |
|---------|----------|
| `query(prompt, options)` | Standard one-shot or multi-turn queries |
| `options.resume = sessionId` | Continue existing session with full context |
| `options.forkSession = true` | Branch from a session without modifying original |

### Capture Session ID

```typescript
for await (const message of query({ prompt, options })) {
  if (message.type === "system" && message.subtype === "init") {
    const sessionId = message.session_id;  // Save for resumption
  }
}
```

---

## Streaming vs Single Mode

**For streaming patterns and input modes, see [streaming.md](streaming.md)**

| Mode | When to Use |
|------|-------------|
| **Streaming (default)** | Interactive sessions, image uploads, hooks, real-time feedback |
| **Single message** | One-shot queries, stateless environments (lambdas) |

### Message Types

| Type | Content |
|------|---------|
| `system` | Session init, compaction events |
| `assistant` | Model text, tool calls |
| `user` | Echoed user messages (with `replay-user-messages`) |
| `result` | Final status: `success`, `error_*` |

---

## Permissions

**For permission modes, hooks, and canUseTool, see [permissions.md](permissions.md)**

| Mode | Behavior |
|------|----------|
| `default` | Prompts for unmatched tools |
| `acceptEdits` | Auto-approves file edits |
| `bypassPermissions` | Approves everything (use with caution) |
| `plan` | No tool execution, planning only |

### Quick Pattern: canUseTool Callback

```typescript
options: {
  canUseTool: async (toolName, input) => {
    if (toolName === "Bash" && input.command.includes("rm")) {
      return { behavior: "deny", message: "Deletes not allowed" };
    }
    return { behavior: "allow", updatedInput: input };
  }
}
```

---

## User Input & Approvals

**For handling AskUserQuestion and tool approvals, see [user-input.md](user-input.md)**

```typescript
canUseTool: async (toolName, input) => {
  if (toolName === "AskUserQuestion") {
    // Present input.questions to user, collect answers
    return {
      behavior: "allow",
      updatedInput: { questions: input.questions, answers: userAnswers }
    };
  }
  // Handle other tool approvals...
}
```

---

## Hooks

**For lifecycle hooks and custom logic, see [hooks.md](hooks.md)**

| Hook | When It Fires |
|------|---------------|
| `PreToolUse` | Before tool execution (can block/modify) |
| `PostToolUse` | After tool execution |
| `UserPromptSubmit` | On user prompt |
| `Stop` | Agent execution stop |
| `SubagentStop` | Subagent completion |

```typescript
options: {
  hooks: {
    PreToolUse: [{
      matcher: "Bash",
      hooks: [async (input, toolUseId, { signal }) => {
        if (input.tool_input.command.includes("rm -rf")) {
          return {
            hookSpecificOutput: {
              hookEventName: input.hook_event_name,
              permissionDecision: "deny",
              permissionDecisionReason: "Blocked dangerous command"
            }
          };
        }
        return {};
      }]
    }]
  }
}
```

---

## Subagents

**For subagent patterns and configuration, see [subagents.md](subagents.md)**

```typescript
options: {
  allowedTools: ["Read", "Grep", "Task"],  // Task required for subagents
  agents: {
    "code-reviewer": {
      description: "Reviews code for quality and security",
      prompt: "You are a code review specialist...",
      tools: ["Read", "Grep", "Glob"],
      model: "sonnet"
    }
  }
}
```

### Key Rules
- Include `Task` in allowedTools to enable subagent invocation
- Don't include `Task` in subagent's tools (no nested spawning)
- Subagents cannot spawn their own subagents

---

## MCP Servers

**For MCP configuration and authentication, see [mcp.md](mcp.md)**

```typescript
options: {
  mcpServers: {
    "github": {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN }
    }
  },
  allowedTools: ["mcp__github__*"]
}
```

### Tool Naming
MCP tools follow pattern: `mcp__<server-name>__<tool-name>`

---

## Structured Outputs

**For JSON Schema outputs and type safety, see [structured-outputs.md](structured-outputs.md)**

```typescript
const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    issues: { type: "array", items: { type: "string" } }
  },
  required: ["summary"]
};

for await (const msg of query({
  prompt: "Analyze this code",
  options: { outputFormat: { type: "json_schema", schema } }
})) {
  if (msg.type === "result" && msg.structured_output) {
    console.log(msg.structured_output);  // Typed JSON
  }
}
```

---

## File Checkpointing

**For file rewind and checkpoint patterns, see [checkpointing.md](checkpointing.md)**

```typescript
options: {
  enableFileCheckpointing: true,
  permissionMode: "acceptEdits",
  extraArgs: { "replay-user-messages": null },
  env: { CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING: "1" }
}

// Capture checkpoint from first user message
if (message.type === "user" && message.uuid) {
  checkpointId = message.uuid;
}

// Later: rewind files
await query.rewindFiles(checkpointId);
```

---

## App-Specific Patterns (team-of-agents)

**For team-of-agents specific implementations, see [app-patterns.md](app-patterns.md)**

### Default Configuration

```typescript
// From team-server/src/dispatcher.ts
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

const session = unstable_v2_resumeSession(sessionId, {
  model: DEFAULT_MODEL,
  allowedTools: [],
  env: { ...process.env, AGENT_ID: agent },
  permissionMode: "bypassPermissions",
});
```

### ask_agent Safeguards

```typescript
const MAX_ASK_DEPTH = 3;           // Prevent recursion
const MAX_ASK_CALLS_PER_SESSION = 10;
const ASK_TIMEOUT_MS = 60_000;
```

### Agent Health States

| Status | Condition |
|--------|-----------|
| 🟢 green | Idle, last exit 0 |
| 🟡 yellow | In cooldown or active < 2 min |
| 🔴 red | Stuck (> 2 min) or last exit non-zero |

---

## Best Practices

### MUST DO
- ✅ Always close sessions (finally block or `await using`)
- ✅ Use `resume` for persistent agents needing context
- ✅ Check `result.subtype` for success/failure
- ✅ Implement timeouts for subagent calls
- ✅ Pass agent identity via `env.AGENT_ID`

### MUST NOT
- ❌ Include Task tool in subagent's allowedTools
- ❌ Allow self-calls in ask_agent patterns
- ❌ Allow circular call chains (A→B→A)
- ❌ Forget cleanup (leaked sessions consume resources)

---

## Key File References

| File | Purpose |
|------|---------|
| `team-server/src/dispatcher.ts` | Session management, streaming |
| `team-server/src/tools.ts` | MCP tools, ask_agent |
| `.claude/agents/*.md` | Agent definitions |

## Additional Resources

For deeper documentation on each topic:
- [sessions.md](sessions.md) - Session lifecycle, resumption, forking
- [streaming.md](streaming.md) - Streaming input, message types
- [permissions.md](permissions.md) - Permission modes, hooks, canUseTool
- [user-input.md](user-input.md) - AskUserQuestion, tool approvals
- [hooks.md](hooks.md) - Lifecycle hooks, matchers, outputs
- [subagents.md](subagents.md) - Subagent definition, invocation
- [mcp.md](mcp.md) - MCP server configuration
- [structured-outputs.md](structured-outputs.md) - JSON Schema, Zod/Pydantic
- [checkpointing.md](checkpointing.md) - File rewind patterns
- [app-patterns.md](app-patterns.md) - team-of-agents specifics
