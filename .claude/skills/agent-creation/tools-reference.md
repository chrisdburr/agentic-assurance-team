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

Tool presets are defined in `presets.yaml` (this directory). Each preset maps an agent type to a default set of tool groups. Use presets as the starting point when creating new agents.

### Preset Summary

| Preset | Agent Type | File Access | Shell | Web | Team Comms | Session |
|--------|-----------|-------------|-------|-----|------------|---------|
| `research` | Domain researchers | Read + Write | git, bun | Yes | Full | Yes |
| `development` | Software engineers | Read + Write | git, bun, python | Yes | Full | Yes |
| `orchestration` | Project management | Read only | bd, git (read) | No | Partial | Yes |
| `review` | Quality assurance | Read only | None | Yes | No | No |
| `utility` | System helpers | Read only | None | No | No | No |

### Using Presets

1. Determine the agent type from the taxonomy
2. Look up the preset in `presets.yaml`
3. The preset's `includes` field lists tool groups; resolve them to a flat tool list
4. Add any agent-specific tools (e.g., Bob adds `Bash(python *)` to the research preset)
5. Copy the resolved list into the agent's `allowedTools` frontmatter

### Per-Agent Overrides

Presets define defaults. Individual agents may need additional tools beyond their type's preset:

| Agent | Type | Additional Tools | Reason |
|-------|------|-----------------|--------|
| Bob | research | `Bash(python *)`, `Bash(pytest *)` | ML experimentation |
| Demi | research | `Bash` (unscoped), `Bash(python *)`, `Bash(pytest *)` | Broad experimentation needs |
| Code-review | review | `Bash` (scoped TBD) | Runs linters and tests |

See `presets.yaml` for full group definitions and resolution rules.
