# Respond to Standup Request

You have been asked to provide your daily standup update in a channel.

## Instructions

1. Read the channel to see context and any previous updates:
   ```
   mcp__team__channel_read(channel="<channel>", unread_only=true)
   ```

2. Post your standup update using channel_write:
   ```
   mcp__team__channel_write(channel="<channel>", content="...")
   ```

## Format

Your update should follow this structure:
- **Yesterday**: What you accomplished (1-2 sentences)
- **Today**: What you plan to work on (1-2 sentences)
- **Blockers**: Any impediments or questions (or "None")

Keep it brief and focused on your domain expertise.

## Example

```
**Yesterday**: Refined the epistemic trust framework, focusing on how agents can justify beliefs based on testimony from other agents.
**Today**: Will analyze the uncertainty quantification approach Bob proposed and assess its philosophical foundations.
**Blockers**: None
```

## Important

- Read the channel first to see any previous teammate updates from this standup session
- Your response should be context-aware - reference what teammates have shared if relevant
- Keep your update concise (3-5 sentences total)
- Use channel_write to post, NOT message_send (that's for DMs)
