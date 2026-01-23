# Multi-Agent Research Team System

## Overview

Build a multi-agent system where multiple Claude Code instances work as a coordinated research team on AI assurance, each with their own identity, memory, and communication channels.

**Design Philosophy**: Use existing tools where possible, build custom only for team-specific needs.

## Team Members

- **Alice**: Philosopher with expertise in formal epistemology and argumentation theory
- **Bob**: Computer scientist with expertise in AI and ML
- **Charlie**: Psychologist with expertise in decision theory and HCI
- **Project Lead (You)**: Coordinates team, facilitates standups, assigns work

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Terminal (tmux)                      │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│   Alice     │    Bob      │   Charlie   │   Web Dashboard   │
│   (CC)      │    (CC)     │    (CC)     │   (Browser)       │
├─────────────┴─────────────┴─────────────┴───────────────────┤
│                     MCP Servers                              │
│  ┌──────────────────────┐  ┌─────────────────────────────┐  │
│  │  MCP Memory Keeper   │  │  Team Communication Server  │  │
│  │  (existing package)  │  │  (custom, ~500 lines)       │  │
│  │  - SQLite storage    │  │  - Messages & standups      │  │
│  │  - Knowledge graph   │  │  - Web UI + WebSocket       │  │
│  │  - Semantic search   │  │  - CC headless spawner      │  │
│  └──────────────────────┘  └─────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                     Shared Resources                         │
│  .agents/identities/     .beads/          .worktrees/       │
│  (markdown files)        (issue tracker)  (git worktrees)   │
└─────────────────────────────────────────────────────────────┘
## Architecture Decisions

### 1. Agent Identity

**Mechanism**: Environment variable AGENT_ID=alice set in terminal
Each agent runs in their own CC session
Slash command /alice loads identity and context on session start
### 2. Storage: Hybrid Approach

**Use existing MCP Memory Keeper** for:
- Long-term memory (facts, learnings, decisions)
- Knowledge graph (entities, relationships)
- Semantic search across memory

**Build custom layer** for:
- Team messages (real-time, threaded)
- Standup transcripts
- Agent status tracking

Storage Layout:
├── ~/mcp-data/memory-keeper/    # MCP Memory Keeper (SQLite)
│   └── memory.db                # Knowledge graph, long-term memory
│
└── .agents/
    ├── team.db                  # Team communication (SQLite)
    │   ├── messages             # Threaded messages
    │   ├── standups             # Daily standup transcripts
    │   └── status               # Agent activity tracking
    │
    ├── identities/
    │   ├── alice.md             # Role, expertise, personality
    │   ├── bob.md
    │   └── charlie.md
    │
    └── shared/
        └── ontology.yaml        # Shared vocabulary for research domain
### 3. Hierarchical Memory (Research-Backed)

Following best practices from [memory research](https://arxiv.org/abs/2505.18279):

| Layer | Storage | Content | Retention |
|-------|---------|---------|-----------|
| Short-term | In-context | Current conversation | Session only |
| Medium-term | MCP Memory Keeper | Compressed summaries | 7 days |
| Long-term | MCP Memory Keeper | Key facts, decisions | Permanent |

Agents automatically:
- Extract key facts after completing work
- Summarize conversations weekly
- Query relevant memory on session start

### 4. Communication System

#### Daily Standups (Facilitated)
- You run /standup in your CC session
- Orchestrator spawns each agent via CC headless mode (-p flag)
- Each agent hears previous updates (sequential context)
- You can interject with questions
- Transcript saved to team.db and displayed in Web UI

#### Ad Hoc Messages
- Agents use MCP tools to send messages
- Messages appear in Web UI real-time (WebSocket)
- Notifications shown when agent loads session
- Thread-based conversations supported

### 5. Web UI Dashboard

Simple single-page app showing:
- **Messages**: Threaded conversation view
- **Standups**: Daily transcript viewer
- **Status**: Who's working on what
- **Beads**: Link to issue tracker

Runs on localhost:3000, updates via WebSocket.

### 6. Git Worktrees

Each agent works in isolated worktree:
- Naming: {agent}-{slug}-{beads-id}
- Example: alice-epistemology-framework-beads-105
- Location: .worktrees/
- Script: ./scripts/worktree-create.sh alice beads-105

### 7. Shared Ontology

To prevent inter-agent misalignment (36.9% of multi-agent failures), define shared vocabulary:

# .agents/shared/ontology.yaml
domain: AI Assurance Research

terms:
  epistemic_confidence:
    definition: "Degree of justified belief in a claim"
    owner: alice
    related: [uncertainty, calibration]

  model_uncertainty:
    definition: "Quantified uncertainty in ML model predictions"
    owner: bob
    related: [epistemic_confidence, aleatoric_uncertainty]

  user_trust:
    definition: "User's willingness to rely on system recommendations"
    owner: charlie
    related: [epistemic_confidence, perceived_reliability]
Agents reference this for consistent terminology.

## MCP Server Architecture

### External: MCP Memory Keeper

Install existing package: [mkreyman/mcp-memory-keeper](https://github.com/mkreyman/mcp-memory-keeper)

Provides tools:
- store_memory - Save facts, decisions, learnings
- query_memory - Semantic search across memory
- get_context - Retrieve relevant context for current task

### Custom: Team Communication Server

**Tech Stack**: Bun + Hono + better-sqlite3 (~500 lines)

**MCP Tools**:
```typescript
// Messaging
message_send(to, content, thread?)     // Send message (from auto-set via AGENT_ID)
message_list(unread_only?, thread?)    // List messages for current agent
message_mark_read(message_id)          // Mark as read
message_thread(thread_id)              // Get full thread

// Standups
standup_post(content)                  // Post standup update
standup_today()                        // Get today's standup transcript

// Status
status_update(working_on, beads_id?)   // Update current status
status_team()                          // Get all agent statuses

// Roster
team_roster()                          // List all agents with roles
```

**HTTP Endpoints** (for Web UI):

GET  /api/messages          # All messages (with filters)
GET  /api/messages/:thread  # Thread messages
GET  /api/standups/:date    # Standup transcript
GET  /api/status            # Team status
WS   /ws                    # Real-time updates

## Implementation Plan

### Phase 1: Foundation (Day 1)

**Install MCP Memory Keeper:**
bash
# Add to MCP config
npm install -g @mkreyman/mcp-memory-keeper

**Create directory structure:**
bash
mkdir -p .agents/{identities,shared}
mkdir -p .claude/{plugins,agents}
mkdir -p scripts

**Write agent identities:**
- .agents/identities/alice.md
- .agents/identities/bob.md
- .agents/identities/charlie.md

**Create shared ontology:**
- .agents/shared/ontology.yaml

### Phase 2: Team Communication Server (Day 2)

**Files to create:**
- team-server/package.json
- team-server/src/index.ts - MCP server + HTTP server
- team-server/src/db.ts - SQLite schema and queries
- team-server/src/tools.ts - MCP tool definitions

**SQLite Schema:**
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,  -- or 'team' for broadcast
  content TEXT NOT NULL,
  thread_id TEXT,
  timestamp TEXT NOT NULL,
  read_by TEXT DEFAULT '[]'  -- JSON array
);

CREATE TABLE standups (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  session_id TEXT  -- Groups standup into single session
);

CREATE TABLE status (
  agent_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,  -- 'active', 'idle', 'offline'
  working_on TEXT,
  beads_id TEXT,
  updated_at TEXT NOT NULL
);
```

### Phase 3: Agent Plugins (Day 3)

**Slash commands** (.claude/plugins/):
- team:alice.md - Alice onboarding
- team:bob.md - Bob onboarding
- team:charlie.md - Charlie onboarding
- team:standup.md - Standup facilitator (for project lead)

**Agent definitions** (.claude/agents/):
- alice.md - For Task tool invocation
- bob.md
- charlie.md

**Onboarding flow** (each agent):
1. Read identity from .agents/identities/{agent}.md
2. Query MCP Memory Keeper for relevant context
3. Check unread messages via message_list(unread_only=true)
4. Check beads assignments: bd list --assignee={agent} --status=in_progress
5. Display status summary

### Phase 4: Web UI (Day 4)

**Files:**
- team-server/public/index.html - Single page dashboard
- team-server/public/app.js - Vanilla JS (~200 lines)
- team-server/public/styles.css - Minimal CSS

**Features:**
- Messages tab with thread view
- Standups tab with date picker
- Status tab showing team activity
- Real-time updates via WebSocket

### Phase 5: Standup Orchestration (Day 5)

**Add to team-server:**
- team-server/src/orchestrator.ts - Standup session manager

**Standup flow:**
1. Project lead runs /standup command
2. Orchestrator creates session ID
3. For each agent (Alice, Bob, Charlie):
   - Spawn CC in headless mode: claude -p "..." --output-format stream-json
   - Pass context: previous updates, their identity, current beads
   - Capture response, save to standups table
   - Stream to Web UI via WebSocket
4. Project lead can interject between agents
5. Generate summary, identify action items

**CC Headless invocation:**
```bash
AGENT_ID=alice claude -p "$(cat <<EOF
You are Alice. Provide your daily standup update.

Previous updates today:
{previous_updates}

Your current work:
{beads_assignments}

Format: Yesterday/Today/Blockers
EOF
)" --output-format stream-json
```

### Phase 6: Worktree Scripts (Day 6)

**Scripts:**
- scripts/worktree-create.sh - Create worktree for agent+issue
- scripts/worktree-list.sh - List active worktrees
- scripts/worktree-cleanup.sh - Remove merged worktrees

**Usage:**
bash
./scripts/worktree-create.sh alice beads-105
# Creates: .worktrees/alice-formal-epistemology-beads-105
# Checks out branch: alice/beads-105

### Phase 7: Integration & Testing (Day 7)

Configure MCP servers in project .mcp.json
Test full agent onboarding flow
Test message send/receive between agents
Test standup orchestration end-to-end
Test worktree creation and switching
Document common workflows
## File Summary

**Created:**
```
.agents/
├── identities/
│   ├── alice.md
│   ├── bob.md
│   └── charlie.md
├── shared/
│   └── ontology.yaml
└── team.db              # Created by team-server

.claude/
├── plugins/
│   ├── team:alice.md
│   ├── team:bob.md
│   ├── team:charlie.md
│   └── team:standup.md
└── agents/
    ├── alice.md
    ├── bob.md
    └── charlie.md

team-server/
├── package.json
├── src/
│   ├── index.ts
│   ├── db.ts
│   ├── tools.ts
│   └── orchestrator.ts
└── public/
    ├── index.html
    ├── app.js
    └── styles.css

scripts/
├── worktree-create.sh
├── worktree-list.sh
└── worktree-cleanup.sh
```

**Modified:**
- .mcp.json - Add team-server and memory-keeper configs
- .gitignore - Exclude team.db, .worktrees/

## MCP Configuration

.mcp.json (project root):
json
{
  "mcpServers": {
    "memory-keeper": {
      "command": "mcp-memory-keeper",
      "args": ["--db-path", "./mcp-data/memory.db"]
    },
    "team": {
      "command": "bun",
      "args": ["run", "./team-server/src/index.ts"],
      "env": {
        "AGENT_ID": "${AGENT_ID}",
        "DB_PATH": "./.agents/team.db",
        "WEB_PORT": "3000"
      }
    }
  }
}

## Verification Steps

### 1. Memory Keeper
bash
# In any CC session
> Store a fact: "The project focuses on AI assurance"
> Query memory for "AI assurance"
# Should return stored fact

### 2. Agent Onboarding
bash
export AGENT_ID=alice
claude
> /alice
# Should show: identity, unread messages, beads assignments

### 3. Messaging
```bash
# Alice's session
> Send Bob a message asking about ML uncertainty quantification

# Bob's session (new terminal)
export AGENT_ID=bob
claude
> /bob
# Should show: "1 unread message from Alice"
```

### 4. Web Dashboard
bash
# Open http://localhost:3000
# Should see message from Alice to Bob
# Send a message via UI, verify it appears in agent session

### 5. Standup
bash
# Your session (no AGENT_ID)
claude
> /standup
# Should orchestrate Alice → Bob → Charlie updates
# Should appear in Web UI in real-time

### 6. Worktree
bash
./scripts/worktree-create.sh alice beads-105
cd .worktrees/alice-*-beads-105
git branch --show-current
# Should show: alice/beads-105

## Comparison: Original vs Simplified

| Aspect | Original Plan | Simplified Plan |
|--------|---------------|-----------------|
| Storage | Custom JSONL + index | SQLite (Memory Keeper + team.db) |
| Memory | Custom implementation | Existing MCP Memory Keeper |
| Code to write | ~2000 lines | ~500 lines |
| Dependencies | Build everything | Leverage existing tools |
| Risk | High (untested) | Lower (proven components) |
| Flexibility | Maximum | Sufficient |

## Research References

This architecture incorporates findings from:
- [Collaborative Memory for Multi-Agent Systems](https://arxiv.org/abs/2505.18279) - Hierarchical memory, access control
- [Memory-as-a-Service Pattern](https://arxiv.org/html/2506.22815v1) - Decoupled memory architecture
- [Context Window Management](https://factory.ai/news/context-window-problem) - Token budgeting strategies
- [Multi-Agent Failure Analysis](https://www.superannotate.com/blog/multi-agent-llms) - 36.9% failures from misalignment

## Open Questions

Should we use MCP Memory Keeper's knowledge graph for the shared ontology, or keep it as YAML?
Should standup frequency be configurable (daily vs on-demand)?
Should there be agent-to-agent direct invocation, or always through messages?
## Future Enhancements (Post-MVP)

Automatic memory summarization (short→medium→long term)
Message relevance scoring to prevent "noisy commons"
Integration with external research tools (Zotero, LaTeX)

