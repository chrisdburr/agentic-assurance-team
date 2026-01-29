# MCP Servers

The Model Context Protocol (MCP) connects agents to external tools and data sources.

## Quick Start

```typescript
for await (const message of query({
  prompt: "Use the docs MCP server to explain hooks",
  options: {
    mcpServers: {
      "claude-code-docs": {
        type: "http",
        url: "https://code.claude.com/docs/mcp"
      }
    },
    allowedTools: ["mcp__claude-code-docs__*"]
  }
})) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
```

## Transport Types

### stdio Servers (Local)

```typescript
options: {
  mcpServers: {
    "github": {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_TOKEN: process.env.GITHUB_TOKEN
      }
    }
  },
  allowedTools: ["mcp__github__list_issues"]
}
```

### HTTP/SSE Servers (Remote)

```typescript
options: {
  mcpServers: {
    "remote-api": {
      type: "sse",  // or "http"
      url: "https://api.example.com/mcp/sse",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`
      }
    }
  },
  allowedTools: ["mcp__remote-api__*"]
}
```

## Config File (.mcp.json)

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

The SDK loads `.mcp.json` automatically from project root.

## Tool Naming

MCP tools follow pattern: `mcp__<server-name>__<tool-name>`

Examples:
- `mcp__github__list_issues`
- `mcp__postgres__query`
- `mcp__slack__send_message`

## Allowing MCP Tools

MCP tools require explicit permission:

```typescript
allowedTools: [
  "mcp__github__*",           // All tools from github server
  "mcp__db__query",           // Only query tool
  "mcp__slack__send_message"  // Specific tool
]
```

Alternatively, change permission mode:

```typescript
options: {
  mcpServers: { /* ... */ },
  permissionMode: "acceptEdits"  // No allowedTools needed
}
```

## MCP Tool Search

For large tool sets (>10% of context), tool search activates automatically:

| `ENABLE_TOOL_SEARCH` | Behavior |
|---------------------|----------|
| `auto` (default) | Activates at 10% of context |
| `auto:5` | Activates at 5% threshold |
| `true` | Always enabled |
| `false` | Disabled, all tools preloaded |

```typescript
options: {
  mcpServers: { /* ... */ },
  env: { ENABLE_TOOL_SEARCH: "auto:5" }
}
```

## Authentication

### Environment Variables

```typescript
mcpServers: {
  "github": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN }
  }
}
```

### HTTP Headers

```typescript
mcpServers: {
  "secure-api": {
    type: "http",
    url: "https://api.example.com/mcp",
    headers: {
      Authorization: `Bearer ${process.env.API_TOKEN}`
    }
  }
}
```

### OAuth2

Complete OAuth flow in your app, then pass access token:

```typescript
const accessToken = await getAccessTokenFromOAuthFlow();

mcpServers: {
  "oauth-api": {
    type: "http",
    url: "https://api.example.com/mcp",
    headers: { Authorization: `Bearer ${accessToken}` }
  }
}
```

## Discovering Available Tools

Check the system init message:

```typescript
for await (const message of query({ prompt, options })) {
  if (message.type === "system" && message.subtype === "init") {
    console.log("MCP tools:", message.mcp_servers);
  }
}
```

## Error Handling

Check connection status in init message:

```typescript
if (message.type === "system" && message.subtype === "init") {
  const failedServers = message.mcp_servers.filter(
    s => s.status !== "connected"
  );
  if (failedServers.length > 0) {
    console.warn("Failed to connect:", failedServers);
  }
}
```

### Common Issues

- **Missing env vars**: Check server's expected environment variables
- **Server not installed**: For `npx` commands, verify package exists
- **Network issues**: For remote servers, verify URL and firewall
- **Tools not being called**: Ensure `allowedTools` includes the MCP tools

## Examples

### GitHub Issues

```typescript
for await (const message of query({
  prompt: "List the 3 most recent issues in anthropics/claude-code",
  options: {
    mcpServers: {
      "github": {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN }
      }
    },
    allowedTools: ["mcp__github__list_issues"]
  }
})) {
  // Verify MCP connected
  if (message.type === "system" && message.subtype === "init") {
    console.log("MCP servers:", message.mcp_servers);
  }
  // Log tool calls
  if (message.type === "assistant") {
    for (const block of message.content) {
      if (block.type === "tool_use" && block.name.startsWith("mcp__")) {
        console.log("MCP tool:", block.name);
      }
    }
  }
}
```

### Database Query

```typescript
for await (const message of query({
  prompt: "How many users signed up last week?",
  options: {
    mcpServers: {
      "postgres": {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-postgres", connectionString]
      }
    },
    allowedTools: ["mcp__postgres__query"]  // Read-only
  }
})) {
  if (message.type === "result") {
    console.log(message.result);
  }
}
```
