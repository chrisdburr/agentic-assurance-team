# Subagents

Subagents are separate agent instances that handle focused subtasks with isolated context.

## Benefits

- **Context isolation** - Prevent information overload in main conversation
- **Parallelization** - Run multiple analyses concurrently
- **Specialized instructions** - Tailored prompts and expertise
- **Tool restrictions** - Limit tools per subagent

## Programmatic Definition

```typescript
for await (const message of query({
  prompt: "Review the authentication module",
  options: {
    allowedTools: ["Read", "Grep", "Glob", "Task"],  // Task required
    agents: {
      "code-reviewer": {
        description: "Expert code review specialist for quality and security",
        prompt: `You are a code review specialist...`,
        tools: ["Read", "Grep", "Glob"],
        model: "sonnet"
      },
      "test-runner": {
        description: "Runs and analyzes test suites",
        prompt: `You are a test execution specialist...`,
        tools: ["Bash", "Read", "Grep"]
      }
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

## AgentDefinition Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | `string` | Yes | When to use this agent |
| `prompt` | `string` | Yes | System prompt defining role |
| `tools` | `string[]` | No | Allowed tools (inherits all if omitted) |
| `model` | `'sonnet'` / `'opus'` / `'haiku'` / `'inherit'` | No | Model override |

**Important:** Don't include `Task` in a subagent's tools. Subagents cannot spawn their own subagents.

## Filesystem-Based Agents

Define in `.claude/agents/*.md`:

```markdown
---
name: code-reviewer
description: Expert code review specialist
model: sonnet
permissionMode: dontAsk
allowedTools:
  - Read
  - Grep
  - Glob
---

# Code Reviewer

You are a code review specialist...
```

Programmatic definitions take precedence over filesystem-based agents with the same name.

## Automatic vs Explicit Invocation

**Automatic:** Claude matches tasks to agents based on `description`:

```
"Review the authentication module for security issues"
// → Claude may invoke code-reviewer based on description
```

**Explicit:** Name the agent in your prompt:

```
"Use the code-reviewer agent to check the authentication module"
```

## Detecting Subagent Invocation

```typescript
for await (const message of query({ prompt, options })) {
  // Check for subagent invocation
  if (message.type === "assistant") {
    for (const block of message.message?.content ?? []) {
      if (block.type === "tool_use" && block.name === "Task") {
        console.log(`Subagent invoked: ${block.input.subagent_type}`);
      }
    }
  }

  // Check if message is from within subagent
  if ("parent_tool_use_id" in message && message.parent_tool_use_id) {
    console.log("  (running inside subagent)");
  }
}
```

## Resuming Subagents

Subagents can be resumed to continue with full conversation history:

```typescript
let agentId: string | undefined;
let sessionId: string | undefined;

// First invocation
for await (const message of query({
  prompt: "Use the Explore agent to find API endpoints",
  options: { allowedTools: ["Read", "Grep", "Glob", "Task"] }
})) {
  if ("session_id" in message) sessionId = message.session_id;

  // Extract agentId from message content
  const extractedId = extractAgentId(message);
  if (extractedId) agentId = extractedId;
}

// Resume with follow-up
if (agentId && sessionId) {
  for await (const message of query({
    prompt: `Resume agent ${agentId} and list the 3 most complex endpoints`,
    options: {
      allowedTools: ["Read", "Grep", "Glob", "Task"],
      resume: sessionId
    }
  })) {
    if ("result" in message) console.log(message.result);
  }
}
```

## Tool Combinations

| Use Case | Tools | Description |
|----------|-------|-------------|
| Read-only analysis | `Read`, `Grep`, `Glob` | Examine but not modify |
| Test execution | `Bash`, `Read`, `Grep` | Run commands and analyze |
| Code modification | `Read`, `Edit`, `Write`, `Grep`, `Glob` | Full read/write |
| Full access | All tools | Omit `tools` field to inherit |

## Dynamic Configuration

```typescript
function createSecurityAgent(level: "basic" | "strict"): AgentDefinition {
  const isStrict = level === "strict";
  return {
    description: "Security code reviewer",
    prompt: `You are a ${isStrict ? "strict" : "balanced"} security reviewer...`,
    tools: ["Read", "Grep", "Glob"],
    model: isStrict ? "opus" : "sonnet"
  };
}

const options = {
  allowedTools: ["Read", "Grep", "Glob", "Task"],
  agents: {
    "security-reviewer": createSecurityAgent("strict")
  }
};
```

## ask_agent Safeguards (team-of-agents)

From `team-server/src/tools.ts`:

```typescript
const MAX_ASK_DEPTH = 3;           // Prevent infinite recursion
const MAX_ASK_CALLS_PER_SESSION = 10;
const ASK_TIMEOUT_MS = 60_000;     // 60 seconds
```

Implemented checks:
1. **Depth limit**: Tracks `ASK_DEPTH` in env
2. **Call count**: Tracks per session
3. **No self-calls**: Agent cannot call itself
4. **No circular chains**: `ASK_CALLER_CHAIN` prevents A→B→A

### Timeout Pattern

```typescript
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error("Timeout")), ASK_TIMEOUT_MS);
});

await Promise.race([
  (async () => {
    for await (const msg of session.stream()) {
      // Process...
    }
  })(),
  timeoutPromise,
]);
```

## Troubleshooting

- **Claude not delegating**: Ensure `Task` is in `allowedTools`
- **Filesystem agents not loading**: Restart session after creating new agent files
- **Windows long prompt failures**: Keep prompts concise or use filesystem agents
