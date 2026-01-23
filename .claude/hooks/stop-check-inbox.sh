#!/bin/bash
# Stop hook: Check for unread messages when agent completes a task
# This script runs at natural task completion points to notify agents of pending messages

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
  if [ "$count" -eq 1 ]; then
    echo "You have 1 unread message. Use message_list(unread_only=true) to read it."
  else
    echo "You have $count unread messages. Use message_list(unread_only=true) to read them."
  fi
fi
