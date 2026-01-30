# Tools Reference

Complete catalogue of tools available to Claude Code agents, organized by category.

## Core File System Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `Read` | Read file contents | Most agents need this |
| `Edit` | Replace text in existing files | For modifying code |
| `Write` | Create or overwrite files | For new file creation |
| `Grep` | Search file contents (ripgrep) | Regex-capable content search |
| `Glob` | Find files by name pattern | `**/*.ts`, `src/**/*.md` |

## Shell Access (Bash)

Bash access is scoped by command prefix patterns. Only grant the prefixes the agent needs.

| Pattern | Use Case |
|---------|----------|
| `Bash(git *)` | Git operations (status, add, commit, diff, log) |
| `Bash(bun *)` | Bun runtime (install, run, test, build) |
| `Bash(python *)` | Python execution |
| `Bash(pytest *)` | Python test runner |
| `Bash(npx *)` | Node package execution |
| `Bash(docker *)` | Container operations |
| `Bash(bd *)` | Beads issue tracker commands |
| `Bash(curl *)` | HTTP requests from CLI |

### Bash Scoping Rules

- Prefix patterns use glob matching: `Bash(git *)` allows `git status`, `git add .`, etc.
- Multiple patterns can be listed independently in `allowedTools`
- Unscoped `Bash` grants full shell access (avoid for most agents)
- Agents with no Bash entries cannot execute shell commands

## Web Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `WebFetch` | Fetch and process web page content | Converts HTML to markdown |
| `WebSearch` | Search the web | Returns search results with URLs |

## Team MCP Tools

All team MCP tools use the `mcp__team__` prefix. These are provided by the team-server MCP integration.

### Messaging (Direct Messages)

| Tool | Purpose |
|------|---------|
| `mcp__team__message_send` | Send a DM to another agent or user |
| `mcp__team__message_list` | List messages (optionally unread only) |
| `mcp__team__message_mark_read` | Mark a message as read |
| `mcp__team__message_thread` | Get all messages in a thread |

### Channels

| Tool | Purpose |
|------|---------|
| `mcp__team__channel_read` | Read recent messages from a channel |
| `mcp__team__channel_write` | Post a message to a channel |
| `mcp__team__channel_list` | List available channels |

### Status & Roster

| Tool | Purpose |
|------|---------|
| `mcp__team__status_update` | Update own status (active/idle/offline) |
| `mcp__team__status_team` | Get all team members' current status |
| `mcp__team__team_roster` | Get team roster with roles and expertise |

### Standup

| Tool | Purpose |
|------|---------|
| `mcp__team__standup_post` | Post a standup update |
| `mcp__team__standup_today` | Get all standup updates posted today |
| `mcp__team__standup_orchestrate` | Start a full standup session (triggers agents sequentially) |
| `mcp__team__standup_session_get` | Check standup session progress |

### Agent-to-Agent

| Tool | Purpose |
|------|---------|
| `mcp__team__ask_agent` | Synchronous: ask another agent and wait for response |

**`ask_agent` safeguards:** max depth 3, max 10 calls per session, 60s timeout. Use `message_send` for non-blocking communication.

## Tool Access Profiles

Pre-built tool sets for common agent types. Copy the appropriate set into the agent's `allowedTools`.

### Full Team Agent

All file, web, and team tools. Used by Alice, Bob, Charlie.

```yaml
allowedTools:
  - Read
  - Edit
  - Write
  - Bash(git *)
  - Bash(bun *)
  - Grep
  - Glob
  - WebFetch
  - WebSearch
  - mcp__team__message_send
  - mcp__team__message_list
  - mcp__team__message_mark_read
  - mcp__team__message_thread
  - mcp__team__standup_post
  - mcp__team__standup_today
  - mcp__team__standup_orchestrate
  - mcp__team__standup_session_get
  - mcp__team__status_update
  - mcp__team__status_team
  - mcp__team__team_roster
  - mcp__team__ask_agent
  - mcp__team__channel_read
  - mcp__team__channel_write
  - mcp__team__channel_list
```

### Specialized Developer

File tools + relevant Bash patterns + web. No team communication.

```yaml
allowedTools:
  - Read
  - Edit
  - Write
  - Bash(git *)
  - Bash(bun *)
  - Bash(python *)
  - Bash(pytest *)
  - Grep
  - Glob
  - WebFetch
  - WebSearch
```

### Read-Only / Review Agent

Can read and search but not modify files. No shell access.

```yaml
allowedTools:
  - Read
  - Grep
  - Glob
  - WebFetch
  - WebSearch
```

### Utility Agent

Minimal read access. Generates text output consumed by the caller.

```yaml
allowedTools:
  - Read
  - Grep
  - Glob
```
