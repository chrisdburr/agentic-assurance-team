# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A multi-agent research team system where multiple Claude Code instances (Alice, Bob, Charlie) collaborate via MCP tools, with real-time web dashboard and issue tracking via beads.

## Commands

### Development

```bash
# Team server (HTTP + WebSocket + MCP on port 3030)
cd team-server && bun run dev

# Dashboard (Next.js on port 3010)
cd team-dashboard && bun run dev

# MCP-only mode (stdio, for Claude Code integration)
bun run team-server/src/index.ts --mcp
```

### Install Dependencies

```bash
cd team-server && bun install
cd team-dashboard && bun install
```

### Linting

```bash
# Uses ultracite wrapping Biome (see .claude/rules/linting.md)
bunx ultracite check
bunx ultracite fix       # Auto-fix
```

### Docker (Production)

```bash
# Dashboard + Traefik + Cloudflare Tunnel
# Note: team-server runs on host for Claude CLI access
docker-compose up -d
```

### Issue Tracking (beads)

```bash
bd ready           # Find available work
bd show <id>       # View issue details
bd update <id> --status in_progress
bd close <id>      # Mark complete
bd sync            # Sync with git
```

### Agent Sessions

```bash
# Start session as specific agent
export AGENT_ID=alice
claude
> /team:alice  # Run onboarding
```

### Worktrees

```bash
./scripts/worktree-create.sh alice beads-105  # Create agent worktree
./scripts/worktree-list.sh                    # List active worktrees
./scripts/worktree-cleanup.sh                 # Remove merged worktrees
```

## Architecture

### Components

```
team-server/src/     Bun + Hono server providing:
                     - MCP server (stdio) for Claude Code integration
                     - HTTP API for dashboard
                     - WebSocket for real-time updates
                     - Agent dispatcher for automated responses

team-dashboard/      Next.js 16 PWA providing:
                     - Chat interface with DMs and channels
                     - Agent status and standup views
                     - NextAuth authentication

.agents/             Runtime data:
                     identities/   Agent persona definitions (alice.md, bob.md, charlie.md)
                     channels/     JSONL channel message storage
                     shared/       ontology.yaml for consistent terminology
                     team.db       SQLite: messages, standups, status, users, channels

.claude/             Claude Code configuration:
                     agents/       Agent definitions for Task tool
                     skills/       Slash commands (/team:alice, /team:standup, etc.)
```

### Team Server Data Flow

1. **MCP Mode** (`--mcp`): Runs on stdio for Claude Code, provides tools for messaging/standups/status
2. **HTTP Mode** (default): Runs both MCP + HTTP server with WebSocket
3. **Dispatcher**: Polls for unread messages, spawns Claude Agent SDK sessions to respond

### Key Files

- `team-server/src/index.ts` - Entry point, routes, WebSocket handling
- `team-server/src/tools.ts` - MCP tool definitions and handlers
- `team-server/src/db.ts` - SQLite schema and queries (messages, standups, users, channels)
- `team-server/src/dispatcher.ts` - Agent session spawning via Claude Agent SDK V2
- `team-server/src/channels.ts` - JSONL-based channel message storage
- `team-dashboard/src/app/(chat)/` - Main chat UI routes
- `team-dashboard/src/lib/api.ts` - Server-side API client with auth

### MCP Tools Available

Messaging: `message_send`, `message_list`, `message_mark_read`, `message_thread`
Standups: `standup_post`, `standup_today`, `standup_orchestrate`
Status: `status_update`, `status_team`, `team_roster`
Channels: `channel_read`, `channel_write`, `channel_list`
Agent-to-agent: `ask_agent` (synchronous SDK V2 invocation)

### Authentication

Dashboard uses NextAuth with credentials provider, validating against team-server's `/api/auth/validate`. User IDs passed via `x-user-id` header for channel access control.

## Conventions

- **TypeScript** throughout, ES modules
- **Ultracite/Biome** for linting/formatting — see `.claude/rules/linting.md`
- **shadcn/ui** for dashboard components — see `.claude/rules/shadcn-components.md`
- **Next.js 16 / Tailwind v4** in dashboard — see `.claude/rules/nextjs-dashboard.md`
- **Data storage** (SQLite vs JSONL) — see `.claude/rules/data-storage.md`
- Agent IDs: `alice`, `bob`, `charlie` (lowercase)

## Environment Variables

See `.env.example`:
- `DISPATCHER_POLL_INTERVAL`, `DISPATCHER_COOLDOWN`, `DISPATCHER_ENABLED` - Dispatcher config
- `CLOUDFLARE_TUNNEL_TOKEN` - For production deployment

Agent sessions are managed in the SQLite DB (`sessions` table), not via environment variables. Use the dashboard's Refresh button or `POST /api/dispatcher/refresh/:agent` to reset an agent's session.

## Session Completion Protocol

When ending a work session, always:
1. Create issues for remaining work (`bd create`)
2. Close finished issues (`bd close`)
3. Sync and push: `git pull --rebase && bd sync && git push`

**Important:** Never manually `git add` or commit `.beads/` files. The `bd sync` command and git hooks handle beads data automatically.
