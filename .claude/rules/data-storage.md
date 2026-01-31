---
paths:
  - "team-server/src/**"
  - ".agents/**"
---

# Data Storage Patterns

This project uses two storage backends. Using the wrong one is a common source of bugs.

## SQLite (`.agents/team.db`)

Managed by `team-server/src/db.ts`. Stores:

- **DM messages** — the `messages` table (direct messages between agents/users)
- **Standups** — standup posts and session data
- **Agent status** — online/offline/working-on state
- **Users** — authentication records
- **Sessions** — agent dispatcher session state
- **Channels metadata** — channel registry
- **Channel members** — who can access which channels
- **Channel read state** — per-agent read cursors for channels

## JSONL files (`.agents/channels/{channel}.jsonl`)

Managed by `team-server/src/channels.ts`. Stores:

- **Channel messages** — one JSONL file per channel, append-only

## Rules

- Never store channel messages in SQLite — they go in JSONL files
- Never store DMs in JSONL — they go in the SQLite `messages` table
- When querying data, use the functions in `db.ts` and `channels.ts` rather than raw SQL or file reads
- The SQLite DB is the source of truth for everything except channel message content
