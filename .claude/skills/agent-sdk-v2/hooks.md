# Hooks

Hooks intercept agent execution at key points for validation, logging, security, or custom logic.

## Available Hooks

| Hook | Python | TypeScript | Trigger |
|------|--------|------------|---------|
| `PreToolUse` | Yes | Yes | Before tool execution (can block/modify) |
| `PostToolUse` | Yes | Yes | After tool execution |
| `PostToolUseFailure` | No | Yes | Tool execution failure |
| `UserPromptSubmit` | Yes | Yes | User prompt submission |
| `Stop` | Yes | Yes | Agent execution stop |
| `SubagentStart` | No | Yes | Subagent initialization |
| `SubagentStop` | Yes | Yes | Subagent completion |
| `PreCompact` | Yes | Yes | Conversation compaction request |
| `PermissionRequest` | No | Yes | Permission dialog would display |
| `SessionStart` | No | Yes | Session initialization |
| `SessionEnd` | No | Yes | Session termination |
| `Notification` | No | Yes | Agent status messages |

## Basic Hook Configuration

```typescript
for await (const message of query({
  prompt: "Update configuration",
  options: {
    hooks: {
      PreToolUse: [{
        matcher: "Write|Edit",  // Regex for tool names
        hooks: [protectEnvFiles]
      }]
    }
  }
})) {
  console.log(message);
}
```

## Callback Function

```typescript
const protectEnvFiles: HookCallback = async (input, toolUseID, { signal }) => {
  const filePath = (input as PreToolUseHookInput).tool_input?.file_path as string;
  const fileName = filePath?.split('/').pop();

  if (fileName === '.env') {
    return {
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        permissionDecision: 'deny',
        permissionDecisionReason: 'Cannot modify .env files'
      }
    };
  }

  return {};  // Allow operation
};
```

### Callback Arguments

1. **Input data** - Event details (hook_event_name, session_id, tool_name, tool_input, etc.)
2. **Tool use ID** - Correlates PreToolUse and PostToolUse events
3. **Context** - Contains `signal` (AbortSignal) for cancellation

## Matchers

Filter which tools trigger your callbacks:

```typescript
hooks: {
  PreToolUse: [
    { matcher: 'Write|Edit', hooks: [fileSecurityHook] },  // File tools only
    { matcher: '^mcp__', hooks: [mcpAuditHook] },          // All MCP tools
    { hooks: [globalLogger] }                              // Everything (no matcher)
  ]
}
```

**Note:** Matchers only match tool names, not file paths. Check `tool_input.file_path` inside your callback for path filtering.

## Hook Outputs

### Top-level Fields

| Field | Description |
|-------|-------------|
| `continue` | Whether agent should continue (default: true) |
| `stopReason` | Message when continue is false |
| `suppressOutput` | Hide stdout from transcript |
| `systemMessage` | Inject context into conversation |

### hookSpecificOutput Fields

| Field | Hooks | Description |
|-------|-------|-------------|
| `hookEventName` | All | Required, use `input.hook_event_name` |
| `permissionDecision` | PreToolUse | `'allow'` / `'deny'` / `'ask'` |
| `permissionDecisionReason` | PreToolUse | Explanation for decision |
| `updatedInput` | PreToolUse | Modified tool input |
| `additionalContext` | Various | Context added to conversation |

## Common Patterns

### Block Dangerous Commands

```typescript
const blockDangerous: HookCallback = async (input) => {
  if (input.hook_event_name !== 'PreToolUse') return {};

  const command = (input as PreToolUseHookInput).tool_input.command as string;

  if (command?.includes('rm -rf /')) {
    return {
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        permissionDecision: 'deny',
        permissionDecisionReason: 'Dangerous command blocked'
      }
    };
  }
  return {};
};
```

### Modify Tool Input (Sandbox)

```typescript
const redirectToSandbox: HookCallback = async (input) => {
  if (input.hook_event_name !== 'PreToolUse') return {};

  const preInput = input as PreToolUseHookInput;
  if (preInput.tool_name === 'Write') {
    const originalPath = preInput.tool_input.file_path as string;
    return {
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        permissionDecision: 'allow',
        updatedInput: {
          ...preInput.tool_input,
          file_path: `/sandbox${originalPath}`
        }
      }
    };
  }
  return {};
};
```

### Auto-Approve Read-Only Tools

```typescript
const autoApproveReadOnly: HookCallback = async (input) => {
  if (input.hook_event_name !== 'PreToolUse') return {};

  const readOnlyTools = ['Read', 'Glob', 'Grep', 'LS'];
  if (readOnlyTools.includes((input as PreToolUseHookInput).tool_name)) {
    return {
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        permissionDecision: 'allow',
        permissionDecisionReason: 'Read-only tool auto-approved'
      }
    };
  }
  return {};
};
```

### Async Webhook Notification

```typescript
const webhookNotifier: HookCallback = async (input, toolUseID, { signal }) => {
  if (input.hook_event_name !== 'PostToolUse') return {};

  try {
    await fetch('https://api.example.com/webhook', {
      method: 'POST',
      body: JSON.stringify({
        tool: (input as PostToolUseHookInput).tool_name,
        timestamp: new Date().toISOString()
      }),
      signal  // Pass for proper cancellation
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Webhook request cancelled');
    }
  }

  return {};
};
```

## Permission Decision Flow

When multiple hooks/rules apply:

1. **Deny** rules checked first (any match = immediate denial)
2. **Ask** rules checked second
3. **Allow** rules checked third
4. **Default to Ask** if nothing matches

If any hook returns `deny`, operation is blocked. Other hooks returning `allow` won't override.

## Troubleshooting

- **Hook not firing**: Check event name case sensitivity (`PreToolUse`, not `preToolUse`)
- **Matcher not filtering**: Matchers match tool names only, not file paths
- **Timeout**: Increase `timeout` in HookMatcher config
- **Modified input not applied**: Must include `permissionDecision: 'allow'` with `updatedInput`
