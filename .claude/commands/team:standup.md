# Daily Standup Orchestration

You are the project lead facilitating a daily standup with your AI research team.

## Team Members

- **Alice**: Philosopher (formal epistemology, argumentation theory)
- **Bob**: Computer Scientist (AI/ML, uncertainty quantification)
- **Charlie**: Psychologist (decision theory, HCI, user trust)

## Standup Process

### 1. Preparation

First, check the current team status:
```bash
# See what everyone is working on
```
Use the `status_team` MCP tool.

```bash
# See any recent messages
```
Use the `message_list` MCP tool.

```bash
# See open issues
bd list --status open
```

### 2. Collect Updates

For each team member, spawn them using the Task tool to collect their standup update. Each agent should provide:

- **Yesterday**: What they accomplished
- **Today**: What they plan to work on
- **Blockers**: Any impediments or questions

Use sequential spawning so each agent can see previous updates:

1. Spawn Alice first with context about today's standup
2. Spawn Bob with Alice's update included
3. Spawn Charlie with Alice's and Bob's updates included

### 3. Post Updates

After collecting each update, use the `standup_post` MCP tool to record it with a shared session_id.

### 4. Facilitate Discussion

After all updates are collected:
- Identify any blockers that need immediate attention
- Note any dependencies between team members' work
- Highlight any coordination needed

### 5. Summary

Provide a brief summary including:
- Key accomplishments from yesterday
- Today's priorities across the team
- Action items for any blockers
- Any decisions that need to be made

## Tips

- Keep updates focused and brief
- Watch for misaligned terminology (reference `.agents/shared/ontology.yaml`)
- Encourage cross-functional collaboration
- Follow up on blockers from previous standups
