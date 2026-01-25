# Team Server

A coordination server for multi-agent teams. Provides HTTP/WebSocket APIs and MCP protocol support for agent messaging, standups, and status tracking.

## Quick Start

### Local Development

```bash
bun install
bun run dev
```

Server runs at http://localhost:3030

### Docker

Build and run:

```bash
docker build -t team-server .
docker run -p 3030:3030 -v team-data:/.agents team-server
```

Test health endpoint:

```bash
curl http://localhost:3030/api/health
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WEB_PORT` | 3030 | HTTP/WebSocket server port |
| `DB_PATH` | `/.agents/team.db` | SQLite database path |
| `DISPATCHER_ENABLED` | true | Enable agent dispatcher |
| `DISPATCHER_POLL_INTERVAL` | 5000 | Dispatcher poll interval (ms) |
| `DISPATCHER_COOLDOWN` | 60000 | Cooldown between triggers (ms) |

## Docker Details

The Dockerfile uses a multi-stage build with `oven/bun:1-alpine`:

- **Stage 1 (deps)**: Installs production dependencies
- **Stage 2 (runtime)**: Copies deps + source, runs as non-root user

Security features:
- Runs as `appuser` (UID 1001), not root
- Health check on `/api/health`

### Volumes

Mount `/.agents` for database persistence:

```bash
docker run -v team-data:/.agents team-server
```

Without a volume, data is lost when the container stops.

### Docker Compose

```yaml
services:
  team-server:
    build: ./team-server
    ports:
      - "3030:3030"
    volumes:
      - team-data:/.agents
    environment:
      - DISPATCHER_ENABLED=false

volumes:
  team-data:
```

## API Endpoints

### Messages
- `GET /api/messages` - List all messages
- `GET /api/messages/:threadId` - Get thread messages
- `GET /api/messages/unread/:agentId` - Get unread messages for agent

### Standups
- `GET /api/standups` - Today's standups
- `GET /api/standups/:date` - Standups by date
- `POST /api/standup/start` - Start orchestrated standup
- `GET /api/standup/session/:sessionId` - Get standup session

### Status
- `GET /api/status` - Team status
- `GET /api/roster` - Team roster
- `GET /api/health` - Health check

### Dispatcher
- `GET /api/dispatcher/status` - Dispatcher status
- `POST /api/dispatcher/trigger/:agent` - Manually trigger agent

### WebSocket
- `ws://localhost:3030/ws` - Real-time updates

## MCP Mode

Run as MCP server (stdio transport):

```bash
bun run mcp
```

Configure in Claude Code settings:

```json
{
  "mcpServers": {
    "team": {
      "command": "bun",
      "args": ["run", "/path/to/team-server/src/index.ts", "--mcp"]
    }
  }
}
```
