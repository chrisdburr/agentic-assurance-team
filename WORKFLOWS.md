# Team Workflows

Quick reference for common multi-agent team operations.

## Setup

### Prerequisites

```bash
# Install dependencies
cd team-server && bun install
cd ../team-dashboard && bun install
```

### Start Services

```bash
# Terminal 1: Team server (HTTP + WebSocket on port 3030)
AGENT_ID=lead bun run team-server/src/index.ts

# Terminal 2: Dashboard (Vite dev server on port 5173)
cd team-dashboard && bun run dev

# Open http://localhost:5173 in browser
```

## Agent Sessions

### Start a Session as an Agent

```bash
# Set agent identity and start Claude Code
export AGENT_ID=alice
claude

# Run onboarding to load identity and check messages
> /team:alice
```

### Available Agents

| Agent | Role | Expertise | Command |
|-------|------|-----------|---------|
| Alice | Philosopher | Formal epistemology, argumentation | `/team:alice` |
| Bob | Computer Scientist | AI/ML, uncertainty quantification | `/team:bob` |
| Charlie | Psychologist | Decision theory, HCI, user trust | `/team:charlie` |

## Messaging

### Send a Message

```
# In any agent session, use the MCP tool:
> Send a message to Bob asking about uncertainty quantification approaches

# The message_send tool will be called automatically
```

### Check Messages

```
# Check for unread messages
> Check my unread messages

# The message_list tool will show incoming messages
```

### Broadcast to Team

```
# Send to everyone
> Broadcast to the team: I've completed the literature review
```

## Standups

### Run Daily Standup (Project Lead)

```bash
# As project lead (no AGENT_ID needed)
claude
> /team:standup

# Or use the MCP tool directly
> Run the standup orchestration
```

### Post Individual Update

```
# As any agent
> Post my standup update:
> Yesterday: Completed review of epistemic confidence frameworks
> Today: Starting work on argument mapping tool
> Blockers: None
```

### View Standup History

```bash
# Via API
curl http://localhost:3030/api/standups/2026-01-23

# Or in dashboard: Standups tab
```

## Status Tracking

### Update Your Status

```
# Mark yourself as actively working
> Update my status to active, working on "team-001 epistemic framework"
```

### Check Team Status

```
# See what everyone is doing
> Show team status

# Or in dashboard: Status tab
```

## Worktrees

### Create a Worktree for an Issue

```bash
# Create worktree for Alice working on team-001
./scripts/worktree-create.sh alice team-001 "epistemic framework"

# Output:
# Location: .worktrees/alice-epistemic-framework-team-001
# Branch:   alice/team-001

# Switch to it
cd .worktrees/alice-epistemic-framework-team-001
export AGENT_ID=alice
claude
```

### List Active Worktrees

```bash
./scripts/worktree-list.sh
./scripts/worktree-list.sh --agent alice
./scripts/worktree-list.sh --json
```

### Cleanup Merged Worktrees

```bash
# Preview what would be removed
./scripts/worktree-cleanup.sh --dry-run

# Actually remove merged worktrees
./scripts/worktree-cleanup.sh

# Force remove unmerged (careful!)
./scripts/worktree-cleanup.sh --force
```

## Memory (Knowledge Graph)

### Store a Fact

```
# Use memory-server MCP tools
> Remember that we decided to use Bayesian approaches for uncertainty quantification
```

### Query Memory

```
> What do we know about uncertainty quantification?
```

### Create Entities and Relations

```
# Create structured knowledge
> Create an entity for "Epistemic Confidence" with the definition from our ontology
> Create a relation: "Epistemic Confidence" relates_to "Model Uncertainty"
```

## Beads (Issue Tracking)

### Create an Issue

```bash
bd create -t "Implement argument mapping" -T task -P P1
```

### List Open Issues

```bash
bd list --status open
bd list --assignee alice
```

### Update Issue Status

```bash
bd close team-001
```

## Dashboard

### Access

- URL: http://localhost:5173 (dev) or http://localhost:3030 (production build)
- Requires team-server running

### Tabs

1. **Messages**: View all team communication, threaded conversations
2. **Standups**: View standup transcripts by date
3. **Status**: See who's working on what

### Real-time Updates

The dashboard connects via WebSocket and updates automatically when:
- New messages arrive
- Standup updates are posted
- Agent status changes

## Shared Ontology

Reference `.agents/shared/ontology.yaml` for consistent terminology:

```yaml
# Key terms and their owners
epistemic_confidence: alice
model_uncertainty: bob
user_trust: charlie
calibration: bob
explainability: alice
appropriate_reliance: charlie
assurance_case: alice
```

When discussing these concepts, use the agreed definitions to prevent misalignment.

## Troubleshooting

### MCP Server Not Connecting

```bash
# Check if team-server starts correctly
AGENT_ID=test bun run team-server/src/index.ts --mcp

# Should output: "Team MCP server running on stdio"
```

### Database Issues

```bash
# Reset database (loses all data)
rm .agents/team.db*

# Restart team-server to recreate
```

### WebSocket Not Connecting

- Ensure team-server is running (not just --mcp mode)
- Check browser console for connection errors
- Verify port 3030 is not in use

### Worktree Creation Fails

```bash
# Ensure repo has at least one commit
git add . && git commit -m "Initial commit"

# Then create worktree
./scripts/worktree-create.sh alice team-001
```
