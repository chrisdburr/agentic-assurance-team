---
description: Check progress on an orchestrated epic and advance blocked work
argument-hint: <epic-id>
allowed-tools: Bash(bd *), mcp__team__channel_read, mcp__team__channel_write, mcp__team__message_send, mcp__team__status_team
---

# Epic Status Check

**Arguments:** `$ARGUMENTS`

You are the Orchestrator checking progress on an epic. The first word of `$ARGUMENTS` is the **epic ID**.

## Step 1: Load Epic State

Run these commands to gather the full picture:

```bash
bd show <epic-id>
bd list --parent <epic-id>
```

Also check team status with `mcp__team__status_team` to see who's currently active.

## Step 2: Categorize Subtasks

Sort all child issues into categories:
- **Completed**: status = `closed`
- **In Progress**: status = `in_progress`
- **Ready**: status = `open` with no unresolved blockers (all `blockedBy` issues are closed)
- **Blocked**: status = `open` with unresolved blockers

## Step 3: Display Progress

Output the progress report:

```
## Epic: <title> (<epic-id>)
Progress: X/Y tasks complete (Z%)

| Task | ID | Agent | Status | Blockers |
|------|----|-------|--------|----------|
| <title> | <id> | @<agent> | completed | — |
| <title> | <id> | @<agent> | in_progress | — |
| <title> | <id> | @<agent> | ready | — |
| <title> | <id> | @<agent> | blocked | <blocker-id> |
```

## Step 4: Advance Blocked Work

Check if any issues have become **newly ready** (all their blockers are now closed but the issue is still `open` and not `in_progress`).

For each newly ready issue, post to #team:
```
@<agent> Dependency resolved — you can now start: <title> (<issue-id>)
Run `/plan-issue <issue-id>` to review and begin.
```

## Step 5: Flag Stalled Work

Identify issues that are `in_progress` but may be stalled:
- Check if the assigned agent has posted any recent channel messages or standup updates
- If an in-progress issue has no apparent recent activity, flag it:

```
**Potentially stalled:**
- <title> (<id>) assigned to @<agent> — no recent activity detected
```

## Step 6: Next Steps

Summarize what needs to happen next:
```
**Next actions:**
- <what needs to happen for the epic to advance>
- <any blockers that need human intervention>
```
