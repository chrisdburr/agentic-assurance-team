# File Checkpointing

Track file modifications and restore to previous states.

## What It Does

- Tracks changes via Write, Edit, NotebookEdit tools
- Creates backups before modifications
- Allows rewinding to any checkpoint

**Note:** Changes via Bash commands (like `echo > file.txt`) are NOT tracked.

## Enable Checkpointing

```typescript
const opts = {
  enableFileCheckpointing: true,
  permissionMode: "acceptEdits",
  extraArgs: { "replay-user-messages": null },  // Required for checkpoint UUIDs
  env: { CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING: "1" }
};
```

Or set environment variable:

```bash
export CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=1
```

## Capture Checkpoint

```typescript
let checkpointId: string | undefined;
let sessionId: string | undefined;

for await (const message of query({
  prompt: "Refactor the authentication module",
  options: opts
})) {
  // Capture checkpoint UUID from first user message
  if (message.type === "user" && message.uuid && !checkpointId) {
    checkpointId = message.uuid;
  }
  // Capture session ID for later resumption
  if ("session_id" in message && !sessionId) {
    sessionId = message.session_id;
  }
}
```

## Rewind Files

```typescript
// Resume session with empty prompt, then rewind
if (checkpointId && sessionId) {
  const rewindQuery = query({
    prompt: "",  // Empty prompt opens connection
    options: { ...opts, resume: sessionId }
  });

  for await (const msg of rewindQuery) {
    await rewindQuery.rewindFiles(checkpointId);
    break;
  }
  console.log(`Rewound to checkpoint: ${checkpointId}`);
}
```

Or via CLI:

```bash
claude --resume <session-id> --rewind-files <checkpoint-uuid>
```

## Patterns

### Checkpoint Before Risky Operations

```typescript
let safeCheckpoint: string | undefined;

for await (const message of query({ prompt, options })) {
  // Update checkpoint on each user message
  if (message.type === "user" && message.uuid) {
    safeCheckpoint = message.uuid;
  }

  // Revert if something goes wrong
  if (yourRevertCondition && safeCheckpoint) {
    await response.rewindFiles(safeCheckpoint);
    break;
  }
}
```

### Multiple Restore Points

```typescript
interface Checkpoint {
  id: string;
  description: string;
  timestamp: Date;
}

const checkpoints: Checkpoint[] = [];

for await (const message of query({ prompt, options })) {
  if (message.type === "user" && message.uuid) {
    checkpoints.push({
      id: message.uuid,
      description: `After turn ${checkpoints.length + 1}`,
      timestamp: new Date()
    });
  }
}

// Later: rewind to any checkpoint
const target = checkpoints[0];  // Or let user choose
// Resume and rewind to target.id
```

## Limitations

| Limitation | Description |
|------------|-------------|
| Write/Edit/NotebookEdit only | Bash changes not tracked |
| Same session | Checkpoints tied to creating session |
| File content only | Directory operations not undone |
| Local files | Remote/network files not tracked |

## Troubleshooting

### User messages don't have UUIDs

Add `extraArgs: { "replay-user-messages": null }` to options.

### "No file checkpoint found" error

Ensure `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=1` is set.

### "ProcessTransport is not ready" error

Resume the session with an empty prompt before calling rewindFiles:

```typescript
const rewindQuery = query({
  prompt: "",  // Required
  options: { ...opts, resume: sessionId }
});

for await (const msg of rewindQuery) {
  await rewindQuery.rewindFiles(checkpointId);
  break;
}
```
