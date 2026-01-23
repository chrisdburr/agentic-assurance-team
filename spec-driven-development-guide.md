# Spec-Driven Development Guide

A multi-phase methodology for greenfield projects with integrated research team deliberation.

---

## Overview

This guide establishes a structured approach to developing software where specifications drive implementation, and a research team provides interdisciplinary review at key decision points.

### Principles

1. **Specification before implementation** — Define what you're building before writing code
2. **Deliberate progression** — Move through phases with explicit sign-off
3. **Interdisciplinary review** — Leverage diverse expertise at decision points
4. **Traceable decisions** — Document rationale, not just outcomes
5. **Reproducible artefacts** — Version control everything

---

## Research Team Roles

| Role | Expertise | Primary Concerns |
|------|-----------|------------------|
| **Alice** | Formal epistemology, argumentation theory | Validity of claims, logical structure, epistemic justification |
| **Bob** | Computer science, AI/ML | Technical feasibility, architecture, performance, security |
| **Charlie** | Decision theory, HCI | User needs, cognitive load, decision support, ethical implications |
| **Project Lead** | Coordination | Facilitates standups, assigns work, resolves conflicts |

Each team member reviews artefacts through their disciplinary lens, raising concerns before implementation begins.

---

## Development Phases

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 0: Problem Framing                                       │
│  ↓                                                              │
│  Phase 1: Specification                                         │
│  ↓                                                              │
│  Phase 2: Architecture                                          │
│  ↓                                                              │
│  Phase 3: Interface Design                                      │
│  ↓                                                              │
│  Phase 4: Implementation                                        │
│  ↓                                                              │
│  Phase 5: Validation & Documentation                            │
└─────────────────────────────────────────────────────────────────┘
```

Each phase produces specific artefacts and requires team review before progression.

---

## Phase 0: Problem Framing

**Purpose:** Establish shared understanding of the problem space before proposing solutions.

### Artefacts

#### `docs/00-problem/PROBLEM.md`
```markdown
# Problem Statement

## Context
[What situation or need prompted this work?]

## Problem
[What specific problem are we solving?]

## Stakeholders
[Who is affected? Who will use this?]

## Constraints
[What limitations exist? Budget, time, technology, regulatory?]

## Success Criteria
[How will we know we've solved the problem?]
```

#### `docs/00-problem/LANDSCAPE.md`
```markdown
# Landscape Analysis

## Existing Solutions
[What already exists? Open source, commercial, academic?]

## Gaps
[What do existing solutions fail to address?]

## Differentiation
[Why build something new?]
```

### Team Review: Problem Framing Standup

| Reviewer | Focus |
|----------|-------|
| Alice | Is the problem well-defined? Are success criteria measurable? |
| Bob | Are technical constraints accurately captured? |
| Charlie | Are stakeholder needs correctly identified? |

**Gate:** Proceed when team agrees the problem is worth solving and well-understood.

---

## Phase 1: Specification

**Purpose:** Define what the system must do, without prescribing how.

### Artefacts

#### `docs/01-spec/REQUIREMENTS.md`
```markdown
# Requirements Specification

## Functional Requirements

### FR-001: [Short Title]
- **Description:** [What the system must do]
- **Rationale:** [Why this is needed]
- **Acceptance Criteria:** [How to verify this is met]
- **Priority:** [Must/Should/Could/Won't]

### FR-002: ...

## Non-Functional Requirements

### NFR-001: [Short Title]
- **Category:** [Performance/Security/Usability/Reliability/etc.]
- **Description:** [The quality attribute]
- **Metric:** [How to measure]
- **Target:** [Acceptable threshold]
```

#### `docs/01-spec/USER-STORIES.md`
```markdown
# User Stories

## US-001: [Title]
**As a** [role]
**I want** [capability]
**So that** [benefit]

### Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

### Notes
[Additional context, edge cases, examples]
```

#### `docs/01-spec/DOMAIN-MODEL.md`
```markdown
# Domain Model

## Entities

### [Entity Name]
- **Definition:** [What this represents in the domain]
- **Attributes:** [Key properties]
- **Relationships:** [How it relates to other entities]

## Glossary
| Term | Definition |
|------|------------|
| ... | ... |
```

### Team Review: Specification Standup

| Reviewer | Focus |
|----------|-------|
| Alice | Are requirements logically consistent? Is the domain model coherent? |
| Bob | Are requirements technically feasible? Are there hidden dependencies? |
| Charlie | Do user stories reflect actual user needs? Are priorities correct? |

**Gate:** Proceed when requirements are complete, consistent, and feasible.

---

## Phase 2: Architecture

**Purpose:** Define the high-level structure and key technical decisions.

### Artefacts

#### `docs/02-architecture/OVERVIEW.md`
```markdown
# Architecture Overview

## System Context
[How does this system fit into the broader ecosystem?]

## High-Level Components
[Major building blocks and their responsibilities]

## Data Flow
[How data moves through the system]

## Technology Stack
| Layer | Technology | Rationale |
|-------|------------|-----------|
| ... | ... | ... |
```

#### `docs/02-architecture/decisions/ADR-001-[title].md`
```markdown
# ADR-001: [Decision Title]

## Status
[Proposed | Accepted | Deprecated | Superseded]

## Context
[What situation requires a decision?]

## Options Considered

### Option A: [Name]
- **Pros:** ...
- **Cons:** ...

### Option B: [Name]
- **Pros:** ...
- **Cons:** ...

## Decision
[Which option was chosen]

## Rationale
[Why this option was selected]

## Consequences
[What follows from this decision—good and bad]
```

#### `docs/02-architecture/RISKS.md`
```markdown
# Technical Risks

## RISK-001: [Title]
- **Description:** [What could go wrong]
- **Likelihood:** [Low/Medium/High]
- **Impact:** [Low/Medium/High]
- **Mitigation:** [How to reduce likelihood or impact]
- **Contingency:** [What to do if it happens]
```

### Team Review: Architecture Standup

| Reviewer | Focus |
|----------|-------|
| Alice | Are architectural decisions well-justified? Is reasoning traceable? |
| Bob | Is the architecture sound? Are risks adequately addressed? |
| Charlie | Does the architecture support user needs? Are there usability implications? |

**Gate:** Proceed when architecture is sound and risks are acceptable.

---

## Phase 3: Interface Design

**Purpose:** Define contracts between components and with external systems.

### Artefacts

#### `docs/03-interfaces/API.md`
```markdown
# API Specification

## Endpoints

### `POST /api/v1/[resource]`
- **Description:** [What this does]
- **Request Body:**
  ```json
  {
    "field": "type — description"
  }
  ```
- **Response:**
  ```json
  {
    "field": "type — description"
  }
  ```
- **Errors:**
  | Code | Meaning |
  |------|---------|
  | 400 | ... |
  | 404 | ... |
```

#### `docs/03-interfaces/SCHEMAS.md`
```markdown
# Data Schemas

## [Schema Name]
```yaml
type: object
properties:
  id:
    type: string
    format: uuid
    description: Unique identifier
  ...
required:
  - id
```

## Validation Rules
[Business rules that apply to data]
```

#### `docs/03-interfaces/EVENTS.md` (if applicable)
```markdown
# Event Contracts

## [Event Name]
- **Trigger:** [What causes this event]
- **Payload:**
  ```json
  {
    "field": "type — description"
  }
  ```
- **Consumers:** [Who listens for this event]
```

### Team Review: Interface Design Standup

| Reviewer | Focus |
|----------|-------|
| Alice | Are contracts precise and unambiguous? |
| Bob | Are interfaces implementable? Are edge cases handled? |
| Charlie | Are interfaces intuitive for consumers? |

**Gate:** Proceed when interfaces are complete and agreed.

---

## Phase 4: Implementation

**Purpose:** Build the system according to specifications.

### Workflow

1. **Create issue** — Each unit of work gets a tracked issue (bead)
2. **Branch** — Work in feature branches (`feature/[issue-id]-[short-description]`)
3. **Implement** — Write code with tests
4. **Review** — Code review against spec
5. **Merge** — Integrate to main branch

### Issue Structure (Beads)

```
.beads/
└── [issue-id]/
    ├── PROBLEM.md      # What needs to be done
    ├── APPROACH.md     # How it will be done (filled during work)
    ├── EVIDENCE.md     # Test results, benchmarks (filled on completion)
    └── metadata.yaml   # Status, assignee, links to spec
```

#### `metadata.yaml`
```yaml
id: BEAD-001
title: Implement SHAP explainer adapter
status: in_progress  # draft | ready | in_progress | review | done
assignee: bob
created: 2026-01-21
spec_refs:
  - docs/01-spec/REQUIREMENTS.md#FR-003
  - docs/02-architecture/decisions/ADR-002-explainer-interface.md
```

### Test-Driven Development

For each implementation unit:

1. **Red** — Write failing tests that encode the requirement
2. **Green** — Write minimal code to pass tests
3. **Refactor** — Improve code quality while keeping tests green

### Team Involvement During Implementation

| Role | Involvement |
|------|-------------|
| Alice | Review evidence claims, ensure traceability to requirements |
| Bob | Primary implementer, code review |
| Charlie | Review UX-impacting implementations, accessibility |
| Lead | Daily check-ins, blocker resolution |

**Gate:** Proceed when all issues for the phase are done and tests pass.

---

## Phase 5: Validation & Documentation

**Purpose:** Verify the system meets specifications and is ready for use.

### Artefacts

#### `docs/05-validation/TEST-REPORT.md`
```markdown
# Test Report

## Summary
| Category | Passed | Failed | Skipped |
|----------|--------|--------|---------|
| Unit | ... | ... | ... |
| Integration | ... | ... | ... |
| End-to-end | ... | ... | ... |

## Coverage
[Coverage metrics and analysis]

## Known Issues
[Any failing tests with rationale for deferral]
```

#### `docs/05-validation/ACCEPTANCE.md`
```markdown
# Acceptance Checklist

## Functional Requirements
| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| FR-001 | ... | ✅ Pass | [Link to test] |
| FR-002 | ... | ✅ Pass | [Link to test] |

## Non-Functional Requirements
| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| NFR-001 | ... | ✅ Pass | [Link to benchmark] |

## User Stories
| ID | Story | Status | Notes |
|----|-------|--------|-------|
| US-001 | ... | ✅ Accepted | ... |
```

#### `README.md`
```markdown
# [Project Name]

[Brief description]

## Quick Start
[How to get running in < 5 minutes]

## Documentation
- [Problem Statement](docs/00-problem/PROBLEM.md)
- [Requirements](docs/01-spec/REQUIREMENTS.md)
- [Architecture](docs/02-architecture/OVERVIEW.md)
- [API Reference](docs/03-interfaces/API.md)

## Development
[How to set up dev environment, run tests, contribute]

## License
[License information]
```

#### `CHANGELOG.md`
```markdown
# Changelog

## [Unreleased]

## [1.0.0] - YYYY-MM-DD
### Added
- Initial release
- [Feature 1]
- [Feature 2]
```

### Team Review: Validation Standup

| Reviewer | Focus |
|----------|-------|
| Alice | Is evidence sufficient to support claims? Is documentation accurate? |
| Bob | Are tests comprehensive? Is technical documentation correct? |
| Charlie | Is user documentation clear? Are examples helpful? |

**Gate:** Release when acceptance criteria are met and documentation is complete.

---

## Directory Structure

```
project-root/
├── .beads/                     # Issue tracking
│   └── [issue-id]/
├── docs/
│   ├── 00-problem/
│   │   ├── PROBLEM.md
│   │   └── LANDSCAPE.md
│   ├── 01-spec/
│   │   ├── REQUIREMENTS.md
│   │   ├── USER-STORIES.md
│   │   └── DOMAIN-MODEL.md
│   ├── 02-architecture/
│   │   ├── OVERVIEW.md
│   │   ├── RISKS.md
│   │   └── decisions/
│   │       └── ADR-001-*.md
│   ├── 03-interfaces/
│   │   ├── API.md
│   │   ├── SCHEMAS.md
│   │   └── EVENTS.md
│   └── 05-validation/
│       ├── TEST-REPORT.md
│       └── ACCEPTANCE.md
├── src/                        # Source code
├── tests/                      # Test code
├── README.md
├── CHANGELOG.md
└── .gitignore
```

---

## Standup Protocol

### Frequency
- **Phase transitions:** Full team review (all phases)
- **During implementation:** Daily async check-ins, weekly sync standups

### Format (Phase Transition)

1. **Present** (5 min) — Lead summarises artefacts produced
2. **Review** (15 min) — Each team member raises concerns from their perspective
3. **Discuss** (10 min) — Resolve conflicts, clarify ambiguities
4. **Decide** (5 min) — Proceed, revise, or block

### Decision Recording

All standup decisions are recorded in `docs/decisions/STANDUP-LOG.md`:

```markdown
# Standup Log

## 2026-01-21: Phase 1 → Phase 2 Transition

**Attendees:** Alice, Bob, Charlie, Lead

**Decision:** Proceed to Phase 2

**Actions:**
- [ ] Alice to clarify FR-003 acceptance criteria
- [ ] Bob to draft initial ADR for data storage

**Notes:**
- Discussed trade-off between ONNX-only vs multi-format support
- Agreed to start with ONNX + sklearn pickle, defer others
```

---

## Adapting This Guide

This guide is a starting point. Adapt it to your context:

- **Smaller projects:** Collapse phases, reduce artefact formality
- **Larger projects:** Add sub-phases, more detailed review gates
- **Regulated domains:** Expand validation, add compliance checklists
- **Solo work:** Use phases as personal checkpoints, skip standups

The key is maintaining the principle: **specify before you build, review before you proceed**.
