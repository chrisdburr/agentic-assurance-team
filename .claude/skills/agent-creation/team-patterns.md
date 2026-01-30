# Team Patterns

Context for agents that participate in the team communication system: dispatch, messaging, channels, ontology, and standups.

## Dispatch Context

When an agent is triggered by the dispatcher, its prompt begins with a `<dispatch_context>` JSON block. Include this section verbatim in any team-participating agent:

````markdown
## Dispatch Context

When triggered, your prompt begins with a `<dispatch_context>` JSON block containing structured metadata about the dispatch event. Example:

```json
{
  "timestamp": "2026-01-29T18:10:00.000Z",
  "agent_id": "your_agent_id",
  "trigger": "dm | mention | standup | ask_agent",
  "source": "dm:{sender_username} | channel:{channel_name} | ask_agent:{asking_agent}",
  "sender": "sender_username_or_null",
  "channel": "channel_name_if_applicable",
  "message_preview": "First 200 chars of the triggering message..."
}
```

Use this to:
- **Know who is talking to you**: `sender` has the real username or agent name. Address them by name.
- **Know why you were triggered**: `trigger` tells you dm/mention/standup/ask_agent.
- **Know where to respond**: If `channel` is set, use `channel_write`. If `trigger` is "dm", use `message_send`. If "ask_agent", respond directly.
- **Quick context**: `message_preview` shows a snippet before you call tools.
````

### Dispatch Context Fields

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | ISO 8601 string | When the dispatch was triggered |
| `agent_id` | string | The agent being triggered (e.g., "alice") |
| `trigger` | enum | `"dm"`, `"mention"`, `"standup"`, `"ask_agent"` |
| `source` | string | Structured source identifier |
| `sender` | string or null | Username of the message sender |
| `senders` | string[] (optional) | Multiple senders (for batched messages) |
| `channel` | string (optional) | Channel name if triggered from a channel |
| `message_preview` | string (optional) | First 200 chars of the triggering message |

## Communication Patterns

### When to Use Each Tool

| Tool | Pattern | Use When |
|------|---------|----------|
| `ask_agent` | Synchronous | You need another agent's input to continue your current task |
| `message_send` | Async DM | Status updates, handoffs, or when you don't need an immediate response |
| `channel_write` | Async broadcast | Sharing with the team, responding to @mentions, posting updates |

### `ask_agent` Safeguards

- **Max depth**: 3 (prevents A asks B asks C asks D)
- **Max calls per session**: 10
- **Timeout**: 60 seconds
- Agents cannot ask themselves
- Circular chains are prevented (A asks B asks A)

### Response Routing

| Trigger | Respond With |
|---------|-------------|
| `trigger: "dm"` | `message_send(to: sender, content)` |
| `trigger: "mention"` | `channel_write(channel, content)` |
| `trigger: "standup"` | `standup_post(content)` |
| `trigger: "ask_agent"` | Return text directly (no tool needed) |

## Shared Ontology

The team uses `.agents/shared/ontology.yaml` to maintain consistent vocabulary. Key conventions:

- Each term has a single **owner** responsible for its definition
- Terms use `snake_case` naming
- Each term includes: `definition`, `owner`, `related`, `examples`, `notes`
- Cross-cutting concepts (used by all agents) are listed under `cross_cutting`

When creating a new agent that introduces domain terminology:
1. Define the terms the agent owns
2. Reference the agent definition's "Shared Ontology" section
3. Add corresponding entries to `ontology.yaml` (separate step, not part of agent creation)

## Standup Protocol

Team standups follow a structured sequence:

1. `standup_orchestrate` triggers agents in order: Alice, Bob, Charlie
2. Each agent posts via `standup_post` with Yesterday/Today/Blockers format
3. Updates are posted to the channel where the standup was invoked

### Standup Format

```
**Yesterday:** What was accomplished
**Today:** What's planned
**Blockers:** Any impediments (or "None")
```

Agents posting standups should use `standup_post`, not `channel_write`.

## Session Management

Agent sessions are tracked in the SQLite database (`sessions` table). Key concepts:

- Each agent has a persistent session that can be resumed
- Sessions are identified by a unique session ID
- The dispatcher spawns agent sessions via the Claude Agent SDK
- Sessions can be refreshed via the dashboard or API endpoint
- `AGENT_ID` is passed as an environment variable to identify the agent

### Agent States

| Status | Visual | Condition |
|--------|--------|-----------|
| Healthy | Green | Idle, last exit code 0 |
| Active | Yellow | In cooldown or active less than 2 minutes |
| Unhealthy | Red | Stuck (over 2 minutes) or last exit non-zero |

## Utility Agents (Non-Team)

Not all agents participate in team communication. Utility agents:

- Do **not** include team MCP tools in `allowedTools`
- Do **not** need Dispatch Context, Collaboration, or Shared Ontology sections
- Have minimal tool access (typically Read, Grep, Glob)
- Generate output consumed by the caller, not posted to channels
- Use `sonnet` or `haiku` models for cost efficiency
