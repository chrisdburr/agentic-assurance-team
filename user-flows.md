# Orchestrator User Flows

Test flows for the orchestrator agent (`/orchestrate:decompose` and `/orchestrate:status`).

---

## Flow 1: Basic Decomposition (happy path)

Tests: input parsing, context gathering, decomposition proposal, approval gate, issue creation, dependency linking, agent notification.

```
/orchestrate:decompose Build an assurance case framework for neural network uncertainty quantification
```

**What to verify:**
- It gathers team status, existing issues, and scans the codebase before proposing
- Decomposition table has 3-8 subtasks with agent assignments matching the capabilities table (Alice gets epistemology tasks, Bob gets ML/UQ, etc.)
- Dependencies form a sensible DAG (e.g., conceptual design before implementation)
- It **stops and asks for approval** before creating anything
- After approval: epic created with `epic` + `orchestrated` labels, subtasks have `orchestrated` label and correct `--assignee`
- Parent/dep relationships are set (`bd show <child>` shows parent and blockedBy)
- First-wave (unblocked) agents are **DM'd via `message_send`** (NOT channel @mentions)
- A dispatch summary is posted to the channel via `channel_write`
- Summary includes the epic ID and points to `/orchestrate:status`

---

## Flow 2: Status Check on the New Epic

Tests: epic state loading, subtask categorization, progress table formatting, "next actions" summary.

```
/orchestrate:status <epic-id-from-flow-1>
```

**What to verify:**
- All subtasks appear in the table with correct agent/status columns
- Unblocked tasks show as "ready", blocked ones show their blocker IDs
- No "advance" notifications fire (nothing is completed yet)
- "Next actions" section describes what the first-wave agents need to do

---

## Flow 3: Simulate Progress and Re-check Status

Tests: advancing blocked work, newly-ready detection, agent notification on unblock.

Manually close one or two first-wave issues to simulate agent completion:
```bash
bd close <first-wave-issue-1>
bd close <first-wave-issue-2>
```

Then run:
```
/orchestrate:status <epic-id-from-flow-1>
```

**What to verify:**
- Closed tasks show as "completed" in the table
- Any tasks that were blocked on the closed ones are now detected as "ready"
- Newly-unblocked agents are **DM'd via `message_send`**: `"Dependency resolved — you can now start: ..."`
- A channel notification is posted: `"Unblocked: <title> (<id>) — notified <agent> via DM"`
- Progress percentage updates correctly (e.g., "2/6 tasks complete (33%)")

---

## Flow 4: Stalled Work Detection

Tests: in-progress detection with no recent activity.

Mark a task as in-progress but don't do anything with it:
```bash
bd update <some-subtask-id> --status in_progress
```

Then run:
```
/orchestrate:status <epic-id-from-flow-1>
```

**What to verify:**
- The "Potentially stalled" section appears and flags the in-progress issue
- It mentions the assigned agent and notes no recent activity

---

## Flow 5: Channel-Based Input

Tests: `channel:<name>` input parsing, reading channel context.

First, post a task description to a channel:
```bash
# via MCP or manually
```
Then use `channel_write` to post something like "We need a literature review on conformal prediction methods and their applicability to neural network calibration" to #research.

Then run:
```
/orchestrate:decompose channel:research
```

**What to verify:**
- It reads the #research channel and extracts the task from recent messages
- Decomposition is based on the channel content, not a literal string
- The rest of the flow (proposal, approval, creation) works the same as Flow 1

---

## Flow 6: Duplicate Detection

Tests: existing issue awareness, avoiding redundant work.

Run a decomposition request that overlaps with issues already created in Flow 1:
```
/orchestrate:decompose Design an uncertainty quantification module for neural networks
```

**What to verify:**
- During the "Gather Context" phase, it finds the existing open issues from Flow 1
- The proposal either references existing issues instead of creating duplicates, or explicitly notes the overlap and asks how to handle it

---

## Flow 7: Approval Rejection

Tests: the approval gate actually blocks issue creation.

```
/orchestrate:decompose Implement a real-time collaboration protocol for agent pair programming
```

**What to verify:**
- When the decomposition table is presented, decline/request changes
- No issues are created, no channel messages are sent
- It accepts feedback and re-proposes (or stops gracefully)

---

## Recommended Execution Order

| Order | Flow | What It Proves |
|-------|------|----------------|
| 1 | Flow 1 (basic decompose) | Core creation pipeline works end-to-end |
| 2 | Flow 2 (initial status) | Status reads freshly-created epic correctly |
| 3 | Flow 3 (progress + advance) | Unblock detection and agent notification |
| 4 | Flow 4 (stalled detection) | Flags idle in-progress work |
| 5 | Flow 7 (rejection) | Approval gate actually blocks |
| 6 | Flow 5 (channel input) | Alternative input mode |
| 7 | Flow 6 (duplicates) | Awareness of existing issues |

Flows 1-4 are sequential (each builds on prior state). Flows 5-7 are independent and can run in any order after Flow 1.
