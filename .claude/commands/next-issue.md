---
description: Show all ready beads issues in a formatted table to help pick what to work on next
allowed-tools: Bash(bd ready:*), Bash(bd show:*)
---

# Next Issue

Fetch all ready issues (no blockers) and present them to the user.

## Steps

1. Run `bd ready` to get all issues with no blockers
2. For each issue listed, run `bd show <id>` to get its description (run these in parallel using the Task tool or parallel Bash calls where possible)
3. Present ALL issues in a single **markdown table** with these columns:

| ID | P | Type | Title | Description |
|----|---|------|-------|-------------|

- **ID**: The issue ID (e.g., `team-abc`)
- **P**: Priority number (e.g., P0, P2, P4)
- **Type**: Issue type (feature, bug, task, epic)
- **Title**: The issue title
- **Description**: A 1-sentence summary extracted from the issue's DESCRIPTION field. Keep it under 80 characters. If the description is long, distill it to the core "what and why."

4. After the table, ask the user which issue they'd like to work on using `AskUserQuestion`, offering the top 4 issues (by priority, then recency) as options, with their ID and title as the label.

**Important:** Do NOT start working on any issue. Just present the options and wait for the user to choose.
