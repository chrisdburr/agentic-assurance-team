---
description: Decompose a complex task into beads issues, assign to agents, and trigger execution
argument-hint: <task description or "channel:<name>"> ["optional context"]
allowed-tools: Bash(bd *), Bash(git log *), Bash(git status *), Read, Grep, Glob, mcp__team__channel_read, mcp__team__channel_write, mcp__team__channel_list, mcp__team__message_send, mcp__team__status_team, mcp__team__team_roster
---

# Task Decomposition

**Input:** `$ARGUMENTS`

You are the Orchestrator. Your job is to decompose a complex task into well-scoped beads issues, assign them to the right agents, and trigger execution.

## Step 1: Parse Input

Parse `$ARGUMENTS`:
- If it starts with `channel:`, read that channel with `channel_read` to extract the task from recent discussion
- Otherwise, treat the full text as the task description
- Any text in quotes after the main task is additional user context

## Step 2: Gather Context

Run these in parallel:
1. **Team state**: `mcp__team__status_team` and `mcp__team__team_roster` — who's available
2. **Existing issues**: `bd list --status=open` — avoid duplicates and understand current work
3. **In-progress work**: `bd list --status=in_progress` — understand agent workload
4. **Codebase context**: Use `Glob`, `Grep`, `Read` to understand relevant code, docs, and architecture that inform the decomposition

## Step 3: Propose Decomposition

Present the decomposition for user approval. Format:

```
## Proposed Decomposition: <Epic Title>

**Goal**: <1-2 sentence summary of what this epic achieves>

| # | Subtask | Agent | Priority | Depends On | Rationale |
|---|---------|-------|----------|------------|-----------|
| 1 | <title> | @alice | P2 | — | <why this agent, why this scope> |
| 2 | <title> | @bob | P2 | — | <why this agent, why this scope> |
| 3 | <title> | @charlie | P2 | #1, #2 | <why this agent, why this scope> |

**First wave** (no dependencies): #1, #2
**Blocked until first wave completes**: #3

**Assumptions**:
- <assumption 1>
- <assumption 2>

Approve to create issues and notify agents?
```

**STOP HERE** and wait for user approval via `AskUserQuestion`. Do NOT create any issues until approved.

## Step 4: Create Issues (after approval)

1. Create the parent epic:
   ```
   bd create --title="<Epic Title>" --type=feature --priority=<N> --label=epic --label=orchestrated
   ```

2. For each subtask, create the issue:
   ```
   bd create --title="<Subtask Title>" --type=<type> --priority=<N> --assignee=<agent> --label=orchestrated
   ```
   Include a detailed description with:
   - Context: how it fits the epic
   - Scope and acceptance criteria
   - Relevant files to read
   - Dependencies (which issues must complete first)

3. Set parent relationships:
   ```
   bd update <child-id> --parent <epic-id>
   ```

4. Add dependencies:
   ```
   bd dep add <blocked-id> <blocker-id>
   ```
   (The first argument depends on the second)

5. Verify the structure:
   ```
   bd show <epic-id>
   bd list --status=open --label=orchestrated
   ```

## Step 5: Trigger First Wave

For each subtask with no unresolved dependencies:

1. **DM the assigned agent** using `message_send`:
   - To: `<agent>` (e.g. "alice")
   - Content:
     ```
     New task assigned: <title> (<issue-id>)
     Context: <1-sentence summary of what to do>
     Run `/plan-issue <issue-id>` to review and start.
     Post your results to #<originating-channel> (the channel this epic was created from).
     When complete, close the issue with `bd close <issue-id>` and message me back.
     ```

2. **Post a dispatch summary** to the channel using `channel_write`:
   ```
   Dispatched <N> tasks to agents via DM: <agent1>, <agent2>, ...
   ```

## Step 6: Summary

Output the final summary:
```
## Epic Created: <title> (<epic-id>)

Created <N> subtasks, <M> dependencies.
First wave (<K> tasks) dispatched via DM.

To check progress: `/orchestrate:status <epic-id>`
```
