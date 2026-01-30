---
name: agent-creation
description: Agent creation specialist that generates agent definitions, identity files, and system prompts following team conventions.
---

# Agent Creation Skill

Guide for creating new Claude Code agents in the team-of-agents system. Every agent requires two files:

1. **Agent definition** (`.claude/agents/{name}.md`) — YAML frontmatter + system prompt
2. **Identity file** (`.agents/identities/{name}.md`) — Persona, personality, communication style

## Creation Checklist

Before generating an agent, confirm:

- [ ] **Name**: lowercase, alphanumeric + hyphens, matches `^[a-z][a-z0-9-]*$`
- [ ] **Role**: one-sentence description of what the agent does
- [ ] **Core expertise**: 3-5 bullet areas with sub-specialties
- [ ] **Model**: chosen based on task complexity (see `prompt-guidelines.md`)
- [ ] **Tool access**: selected from the tool catalogue (see `tools-reference.md`)
- [ ] **Team participation**: does this agent join team communication or is it a utility?

## Two-File Pattern

### Agent Definition (`.claude/agents/{name}.md`)

Contains YAML frontmatter (name, description, model, permissionMode, allowedTools) followed by a markdown system prompt with sections for Identity, Core Expertise, Shared Ontology, Available Tools, Working Style, Collaboration, and Dispatch Context.

See `agent-template.md` for the canonical template.

### Identity File (`.agents/identities/{name}.md`)

Contains the agent's persona: Role, Expertise, Responsibilities, Personality, Communication Style, Working Preferences, and Key Phrases.

See `identity-template.md` for the canonical template.

## Section Overview

| Section | Purpose | Required |
|---------|---------|----------|
| Identity | Points to `.agents/identities/{name}.md` | Yes |
| Core Expertise | 3-5 domain areas with sub-items | Yes |
| Shared Ontology | Terms this agent owns in ontology.yaml | If team agent |
| Available Tools | Categorized tool listing | Yes |
| Working Style | Behavioral guidelines (4-6 bullets) | Yes |
| Collaboration | How this agent works with teammates | If team agent |
| Dispatch Context | How to interpret trigger metadata | If team agent |

## Model Selection

| Model | When to Use |
|-------|-------------|
| `opus` | Deep reasoning, multi-step research, philosophical analysis |
| `sonnet` | Code generation, structured output, routine tasks |
| `haiku` | Quick lookups, simple transformations, validation |

## Skill Files

- `agent-template.md` — Full `.claude/agents/{name}.md` template with all sections
- `identity-template.md` — Full `.agents/identities/{name}.md` template
- `tools-reference.md` — Complete tool catalogue with access profiles
- `prompt-guidelines.md` — System prompt writing best practices
- `team-patterns.md` — Dispatch context, communication patterns, ontology, standups
