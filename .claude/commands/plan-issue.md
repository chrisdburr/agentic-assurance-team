---
description: Fetch a beads issue and create an implementation plan
argument-hint: <issue-id> ["optional context from user"]
allowed-tools: Bash(bd show:*), Bash(bd list:*), Bash(bd update:*), Bash(bd close:*), Bash(bd sync:*), Bash(git log:*), Bash(git checkout:*), Bash(git pull:*), Bash(git stash:*), Bash(git status:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*)
---

# Plan Issue Implementation

**Arguments:** `$ARGUMENTS`

Parse the arguments:
- The first word is the **issue ID** (e.g., `team-abc`)
- Everything after the first word is the **optional user context** (e.g., additional instructions, preferences, or constraints)

## Issue Details

The issue ID is the **first word** of the arguments. Run `bd show <issue-id>` to fetch details.

## User Context

Any text after the issue ID is **user context** that must be incorporated into the plan.

If user context was provided above, you MUST incorporate it into your implementation plan. The user's context may include:
- Specific implementation preferences or constraints
- Areas of focus or priority
- Technical decisions already made
- Questions they want answered in the plan

## Related Context

Use `bd show <issue-id>` output to identify dependencies. Check parent epics for additional context if mentioned.

## Your Task

Based on the issue details above:

1. **Mark the issue as in progress immediately:**
   - Run `bd update <issue-id> --status in_progress` before doing anything else

2. **Ask which branch to use as the base:**
   - Use the `AskUserQuestion` tool to ask: "Which branch should I use as the base for this feature branch?"
   - Offer these options:
     - `main` (Recommended) - Standard workflow for standalone features
     - Current branch - For features that build on in-progress work (e.g., epic branches)
     - Other - Let user specify a different branch
   - Show the current branch name in the "Current branch" option description

3. **Create a feature branch from the chosen base:**
   - First, check for uncommitted changes and stash if necessary
   - Checkout the base branch: `git checkout <base-branch>`
   - Pull latest: `git pull`
   - Create a new branch using the pattern: `<type>/<issue-id>_<short-description>`
     - Use `feature/` for features, `fix/` for bugs, `task/` for tasks
     - Example: `feature/team-tv3_migrate-to-baseui` or `fix/team-6oa_rate-limiting`

4. **Use the `EnterPlanMode` tool** to enter plan mode for this implementation task

5. In plan mode, explore the codebase to understand the current state

6. Create a detailed implementation plan that includes:
   - Summary of what needs to be done
   - Key files/components that will be affected
   - Step-by-step implementation approach
   - Testing strategy
   - Potential risks or blockers
   - **Address any user context** provided in the arguments (preferences, constraints, questions)

7. **Include a final step in the plan** for post-implementation wrap-up:
   - After all implementation and testing steps, the plan MUST include a final step: **"Commit, close issue, and push"**
   - This step should state: "Ask the user if they would like to commit the changes and close the issue. If yes: stage the relevant files, commit with a descriptive message, run `bd close <issue-id>`, run `bd sync`, and push to remote."

8. Write the plan to the plan file and use `ExitPlanMode` when ready for user approval

**Important:** Always enter plan mode before making any code changes for non-trivial issues.
