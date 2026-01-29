# Streaming vs Single Mode

## Overview

The Claude Agent SDK supports two input modes:

| Mode | Use Case |
|------|----------|
| **Streaming Input (Recommended)** | Interactive sessions, image uploads, hooks, interrupts |
| **Single Message Input** | One-shot queries, stateless environments (lambdas) |

## Streaming Input Mode (Default)

Streaming provides full access to agent capabilities:

- Image uploads in messages
- Queued messages that process sequentially
- Full tool and hook integration
- Real-time feedback
- Context persistence across turns

### Implementation

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync } from "fs";

async function* generateMessages() {
  // First message
  yield {
    type: "user" as const,
    message: {
      role: "user" as const,
      content: "Analyze this codebase for security issues"
    }
  };

  // Wait, then follow up with image
  await new Promise(resolve => setTimeout(resolve, 2000));

  yield {
    type: "user" as const,
    message: {
      role: "user" as const,
      content: [
        { type: "text", text: "Review this architecture diagram" },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: readFileSync("diagram.png", "base64")
          }
        }
      ]
    }
  };
}

for await (const message of query({
  prompt: generateMessages(),
  options: { maxTurns: 10, allowedTools: ["Read", "Grep"] }
})) {
  if (message.type === "result") {
    console.log(message.result);
  }
}
```

## Single Message Input

Use for simple one-shot queries:

```typescript
// Simple one-shot query
for await (const message of query({
  prompt: "Explain the authentication flow",
  options: { maxTurns: 1, allowedTools: ["Read", "Grep"] }
})) {
  if (message.type === "result") {
    console.log(message.result);
  }
}

// Continue with session management
for await (const message of query({
  prompt: "Now explain authorization",
  options: { continue: true, maxTurns: 1 }
})) {
  if (message.type === "result") {
    console.log(message.result);
  }
}
```

### Limitations of Single Mode

Single message input does **not** support:
- Direct image attachments
- Dynamic message queueing
- Real-time interruption
- Hook integration
- Natural multi-turn conversations

## Message Types

| Type | Subtype | Description |
|------|---------|-------------|
| `system` | `init` | Session started, includes session_id, mcp_servers |
| `system` | `compact_boundary` | Compaction occurred |
| `assistant` | - | Model response with text/tool_use blocks |
| `user` | - | Echoed user messages (with replay-user-messages) |
| `result` | `success` | Successful completion |
| `result` | `error_*` | Various error states |

### Handling Messages

```typescript
for await (const message of query({ prompt, options })) {
  switch (message.type) {
    case "system":
      if (message.subtype === "init") {
        console.log("Session:", message.session_id);
        console.log("MCP servers:", message.mcp_servers);
      }
      break;

    case "assistant":
      for (const block of message.message.content) {
        if (block.type === "text") {
          console.log("Text:", block.text);
        } else if (block.type === "tool_use") {
          console.log("Tool call:", block.name, block.input);
        }
      }
      break;

    case "result":
      if (message.subtype === "success") {
        console.log("Success:", message.result);
      } else {
        console.error("Error:", message.subtype);
      }
      break;
  }
}
```

## Text Extraction Utility

From the codebase (`team-server/src/dispatcher.ts:192-202`):

```typescript
function extractTextContent(msg: SDKMessage): string | null {
  if (msg.type === "assistant" && msg.message?.content) {
    const textBlocks = msg.message.content.filter(
      (block): block is { type: "text"; text: string } => block.type === "text"
    );
    if (textBlocks.length > 0) {
      return textBlocks.map((b) => b.text).join("");
    }
  }
  return null;
}
```

## Streaming to WebSocket

Pattern from `team-server/src/dispatcher.ts`:

```typescript
for await (const msg of session.stream()) {
  const textContent = extractTextContent(msg);
  if (textContent && broadcast) {
    broadcast("agent_stream", {
      agent,
      sessionId,
      content: textContent,
      timestamp: new Date().toISOString(),
    });
  }

  if (msg.type === "result") {
    const exitCode = msg.subtype === "success" ? 0 : 1;
    broadcast("agent_session_ended", { agent, exitCode });
  }
}
```
