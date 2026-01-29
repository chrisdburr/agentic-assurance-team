# Permissions

## Permission Evaluation Flow

When Claude requests a tool, the SDK checks permissions in order:

1. **Hooks** - Run first, can allow, deny, or continue
2. **Permission rules** - Check `deny` → `allow` → `ask` rules from settings.json
3. **Permission mode** - Apply the active mode
4. **canUseTool callback** - If not resolved, call your callback

## Permission Modes

| Mode | Description | Behavior |
|------|-------------|----------|
| `default` | Standard behavior | Prompts for unmatched tools |
| `acceptEdits` | Auto-accept file edits | File edits and fs operations approved |
| `bypassPermissions` | Bypass all checks | All tools run without prompts |
| `plan` | Planning mode | No tool execution |

### Setting Permission Mode

**At query time:**

```typescript
for await (const message of query({
  prompt: "Help me refactor this code",
  options: {
    permissionMode: "acceptEdits"
  }
})) {
  // ...
}
```

**During streaming (dynamic change):**

```typescript
const q = query({
  prompt: "Help me refactor",
  options: { permissionMode: "default" }
});

// Change mode mid-session
await q.setPermissionMode("acceptEdits");

for await (const message of q) {
  // Now using acceptEdits mode
}
```

## Accept Edits Mode

Auto-approves file operations:
- File edits (Edit, Write tools)
- Filesystem commands: `mkdir`, `touch`, `rm`, `mv`, `cp`

Other tools (Bash commands that aren't fs operations) still require normal permissions.

## Bypass Permissions Mode

**Warning:** Use with extreme caution. Claude has full system access.

- All tools run without prompts
- Hooks still execute and can block
- Subagents inherit this mode (cannot be overridden)

## Plan Mode

Prevents tool execution entirely. Claude can analyze and plan but cannot make changes. Useful for:
- Code review
- Proposal generation
- Approving changes before execution

Claude may use `AskUserQuestion` to clarify requirements before finalizing the plan.

## canUseTool Callback

Handle tool approval requests programmatically:

```typescript
for await (const message of query({
  prompt: "Create a test file in /tmp and delete it",
  options: {
    canUseTool: async (toolName, input) => {
      console.log(`Tool: ${toolName}`);

      if (toolName === "Bash") {
        console.log(`Command: ${input.command}`);

        // Block dangerous commands
        if (input.command.includes("rm -rf /")) {
          return {
            behavior: "deny",
            message: "Dangerous command blocked"
          };
        }
      }

      // Get user approval
      const approved = await askUser("Allow this action?");

      if (approved) {
        return { behavior: "allow", updatedInput: input };
      } else {
        return { behavior: "deny", message: "User denied" };
      }
    }
  }
})) {
  // ...
}
```

### Response Types

| Response | Effect |
|----------|--------|
| `{ behavior: "allow", updatedInput }` | Tool executes (can modify input) |
| `{ behavior: "deny", message }` | Tool blocked, Claude sees message |

### Common Patterns

**Approve with changes (sandbox paths):**

```typescript
if (toolName === "Bash") {
  const sandboxedInput = {
    ...input,
    command: input.command.replace("/tmp", "/tmp/sandbox")
  };
  return { behavior: "allow", updatedInput: sandboxedInput };
}
```

**Suggest alternative:**

```typescript
if (toolName === "Bash" && input.command.includes("rm")) {
  return {
    behavior: "deny",
    message: "User prefers archiving over deletion. Use tar instead."
  };
}
```

## Timeout

The `canUseTool` callback must return within **60 seconds** or Claude assumes denial and tries a different approach.

## MCP Tool Permissions

MCP tools require explicit permission via `allowedTools`:

```typescript
options: {
  mcpServers: { "github": { /* ... */ } },
  allowedTools: [
    "mcp__github__*",           // All tools from github server
    "mcp__db__query",           // Only query tool from db
    "mcp__slack__send_message"  // Only send_message from slack
  ]
}
```

Alternatively, change permission mode:

```typescript
options: {
  mcpServers: { /* ... */ },
  permissionMode: "acceptEdits"  // No allowedTools needed
}
```
