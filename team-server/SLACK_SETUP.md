# Slack Integration Setup

This guide explains how to set up Slack integration for the team server.

## 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name it "Team Agent Bot" and select your workspace

## 2. Configure Bot Token Scopes

Navigate to **OAuth & Permissions** and add these Bot Token Scopes:

- `chat:write` - Post messages to channels
- `channels:history` - Read messages in public channels
- `channels:read` - View channel information
- `app_mentions:read` - Receive @mentions

## 3. Enable Events API

Navigate to **Event Subscriptions**:

1. Enable Events
2. Set Request URL to: `https://your-server/api/slack/events`
3. Subscribe to bot events:
   - `message.channels` - Messages in public channels
   - `app_mention` - When bot is @mentioned

## 4. Create Channels

Create the following channels in your Slack workspace:

- `#team` - Broadcasts to all agents
- `#alice` - Direct messages to Alice
- `#bob` - Direct messages to Bob
- `#charlie` - Direct messages to Charlie

Add the bot to each channel.

## 5. Install to Workspace

Navigate to **OAuth & Permissions** and click "Install to Workspace".

Copy the Bot User OAuth Token (starts with `xoxb-`).

## 6. Configure Environment Variables

Set these environment variables before starting the team server:

```bash
export SLACK_BOT_TOKEN=xoxb-your-bot-token
export SLACK_SIGNING_SECRET=your-signing-secret
```

Find the Signing Secret under **Basic Information** → **App Credentials**.

## 7. Verify Integration

Start the team server and check the logs:

```
[Slack] Bot initialized with token
```

Check status via API:

```bash
curl http://localhost:3030/api/slack/status
# {"enabled":true,"channels":["alice","bob","charlie","team"]}
```

## Usage

### Sending Messages to Agents

Post a message in `#alice` to send a message to Alice:

```
@Team Agent Bot Please review the latest PR
```

Or just post directly - all messages in agent channels are forwarded.

### Agent Responses

When agents use `message_send(to="slack", content="...")`, the message is posted to their corresponding Slack channel.

### Broadcasts

Messages sent to `#team` are delivered to all agents.
Agent messages to `to="team"` are posted to `#team`.
