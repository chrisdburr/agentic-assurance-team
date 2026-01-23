#!/bin/bash
# Beads close hook: Trigger inbox check when a beads issue is closed
# This script runs after `bd close` to notify agents of pending messages

AGENT_ID="${AGENT_ID:-}"
TEAM_SERVER_URL="${TEAM_SERVER_URL:-http://localhost:3030}"

# Skip if no agent ID is set
if [ -z "$AGENT_ID" ]; then
  exit 0
fi

# Query unread count from team server
response=$(curl -s "${TEAM_SERVER_URL}/api/messages/unread/${AGENT_ID}" 2>/dev/null)

# Check if curl succeeded
if [ $? -ne 0 ]; then
  exit 0
fi

# Parse count from JSON response
count=$(echo "$response" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')

# Notify if there are unread messages
if [ -n "$count" ] && [ "$count" -gt 0 ]; then
  echo ""
  echo "--- Task Complete ---"
  if [ "$count" -eq 1 ]; then
    echo "You have 1 unread message waiting."
  else
    echo "You have $count unread messages waiting."
  fi
  echo "Use message_list(unread_only=true) to check your inbox."
  echo "---"
fi
