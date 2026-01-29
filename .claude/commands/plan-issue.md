---
description: Fetch a beads issue and create an implementation plan
argument-hint: <issue-id> ["optional context from user"]
allowed-tools: Bash(bd show:*), Bash(bd list:*), Bash(bd update:*), Bash(git log:*), Bash(git checkout:*), Bash(git pull:*), Bash(git stash:*)
---

# Plan Issue Implementation

**Arguments:** `$ARGUMENTS`

Parse the arguments:
- The first word is the **issue ID** (e.g., `team-abc`)
- Everything after the first word is the **optional user context** (e.g., additional instructions, preferences, or constraints)

## Issue Details

Fetch the issue information using only the issue ID (first word of arguments):

!`bd show $(echo "$ARGUMENTS" | awk '{print $1}')`

## User Context

Extract any additional context provided by the user (everything after the issue ID):

!`echo "$ARGUMENTS" | sed 's/^[^ ]* *//' | grep -v '^$' || echo "No additional context provided"`

If user context was provided above, you MUST incorporate it into your implementation plan. The user's context may include:
- Specific implementation preferences or constraints
- Areas of focus or priority
- Technical decisions already made
- Questions they want answered in the plan

## Related Context

Check for any dependencies or blockers:

!`bd list --status open 2>/dev/null | grep -E "(blocks|blocked)" | head -5 || echo "No blocking relationships found"`

## Your Task

Based on the issue details above:

1. **Ask which branch to use as the base:**
   - Use the `AskUserQuestion` tool to ask: "Which branch should I use as the base for this feature branch?"
   - Offer these options:
     - `main` (Recommended) - Standard workflow for standalone features
     - Current branch - For features that build on in-progress work (e.g., epic branches)
     - Other - Let user specify a different branch
   - Show the current branch name in the "Current branch" option description

2. **Create a feature branch from the chosen base:**
   - First, check for uncommitted changes and stash if necessary
   - Checkout the base branch: `git checkout <base-branch>`
   - Pull latest: `git pull`
   - Create a new branch using the pattern: `<type>/<issue-id>_<short-description>`
     - Use `feature/` for features, `fix/` for bugs, `task/` for tasks
     - Example: `feature/team-tv3_migrate-to-baseui` or `fix/team-6oa_rate-limiting`
   - Mark the issue as in progress: `bd update <issue-id> --status in_progress`

3. **Use the `EnterPlanMode` tool** to enter plan mode for this implementation task

4. In plan mode, explore the codebase to understand the current state

5. Create a detailed implementation plan that includes:
   - Summary of what needs to be done
   - Key files/components that will be affected
   - Step-by-step implementation approach
   - Testing strategy
   - Potential risks or blockers
   - **Address any user context** provided in the arguments (preferences, constraints, questions)

6. Write the plan to the plan file and use `ExitPlanMode` when ready for user approval

**Important:** Always enter plan mode before making any code changes for non-trivial issues.
