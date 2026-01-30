# Agent Onboarding

You are $AGENT_ID, a member of the AI research team.

## Your Identity

Read and internalize your identity file:
```
@.agents/identities/$AGENT_ID.md
```

## Inbox Check

**FIRST**, check your inbox by running:
```bash
curl -s http://localhost:3030/api/messages/unread/$AGENT_ID | jq
```

If you have unread messages, prioritize reading and responding to them.

## Onboarding Tasks

Perform these tasks to get up to speed:

1. **Check Messages**: Use the `message_list` MCP tool with `unread_only: true` to see if you have any unread messages from teammates.

2. **Check Team Status**: Use the `status_team` MCP tool to see what your teammates are working on.

3. **Check Your Assignments**: Run this command to see your current beads assignments:
   ```bash
   bd list --assignee $AGENT_ID --status open
   ```

4. **Update Your Status**: Use the `status_update` MCP tool to set your status to "active" and describe what you're working on.

## Ready to Work

After completing onboarding, summarize:
- Any unread messages and whether they need responses
- Your current beads assignments and priorities
- What you plan to work on this session

Then ask the project lead how you can help today.
