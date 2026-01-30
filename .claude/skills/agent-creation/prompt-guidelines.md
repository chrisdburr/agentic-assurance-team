# Prompt Writing Guidelines

Best practices for writing agent system prompts and description fields.

## Writing Principles

### Be Specific, Not Generic
Bad: "You are a helpful assistant that answers questions."
Good: "You are a computer scientist specializing in AI/ML and uncertainty quantification, working on an AI assurance research team."

### Use Imperative Voice for Instructions
Bad: "The agent should read the identity file before responding."
Good: "You must read and embody your full identity from `.agents/identities/{name}.md` before responding."

### Use Domain Vocabulary
Bad: "Think carefully about how sure you are."
Good: "Acknowledge uncertainty explicitly with degrees of confidence."

### Structure with Clear Headings
Use `##` for major sections and `###` for subsections. Keep section names consistent across agents:
- Identity, Core Expertise, Shared Ontology, Available Tools, Working Style, Collaboration, Dispatch Context

### Provide Concrete Examples
Instead of abstract rules, show the expected behavior:
- List specific tools with their parameters
- Show example JSON for structured data
- Include sample phrases in the identity file

## Description Field

The `description` field in YAML frontmatter serves as a one-line summary visible in tool listings and agent selection UIs.

### Format
`{Role noun} for {primary specialty} and {secondary specialty}`

### Examples
| Agent | Description |
|-------|-------------|
| alice | Philosopher for epistemology and argumentation |
| bob | Computer scientist for AI/ML and uncertainty quantification |
| charlie | Psychologist for decision theory, HCI, and user trust |

### Rules
- Under 80 characters
- Start with a role noun (not "An agent that...")
- Include 2-3 key specialties
- No period at the end
- No articles ("a", "the") at the start

## Model Selection

| Model | Cost | Speed | Best For |
|-------|------|-------|----------|
| `opus` | High | Slow | Deep reasoning, multi-step analysis, philosophical inquiry, complex research |
| `sonnet` | Medium | Fast | Code generation, structured output, routine analysis, template-based tasks |
| `haiku` | Low | Fastest | Simple lookups, validation, formatting, quick transformations |

### Decision Criteria

Choose `opus` when:
- The agent reasons about novel problems without templates
- Tasks require multi-step planning or chain-of-thought
- Quality of reasoning matters more than speed
- The agent participates in open-ended research discussions

Choose `sonnet` when:
- The agent follows established patterns or templates
- Output is structured (code, JSON, YAML)
- Tasks are well-defined with clear acceptance criteria
- Speed matters more than depth of reasoning

Choose `haiku` when:
- The agent performs simple transformations
- Tasks are mechanical (formatting, validation, extraction)
- Latency is critical
- Cost optimization is a priority

## Anti-Patterns

### Avoid Vague Working Style Bullets
Bad: "Be helpful and thorough"
Good: "Quantify claims with metrics when possible"

### Avoid Redundant Tool Descriptions
Bad: Repeating the tool's built-in description
Good: Explaining when and why to use specific tools in the agent's context

### Avoid Identity Leakage into Agent Definition
The agent definition (`.claude/agents/`) describes **what the agent does**.
The identity file (`.agents/identities/`) describes **who the agent is**.
Don't duplicate personality traits in the agent definition — point to the identity file.

### Avoid Over-Specifying Responses
Bad: "Always respond with exactly 3 paragraphs"
Good: "Structure arguments with clear premises and conclusions"

### Avoid Generic Collaboration Sections
Bad: "Work well with the team"
Good: "Help Bob translate philosophical requirements into technical specifications"
