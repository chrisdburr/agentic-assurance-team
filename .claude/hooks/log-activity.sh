#!/bin/bash
# Generic activity logger for Claude Code hooks
# Logs agent tool use and session lifecycle events to JSONL files
#
# Usage: Called by hook configs with event type passed via CLAUDE_HOOK_EVENT env var
# Each agent gets their own log file: .agents/logs/{agent_id}-activity.jsonl

AGENT_ID="${AGENT_ID:-unknown}"
LOG_DIR=".agents/logs"
LOG_FILE="${LOG_DIR}/${AGENT_ID}-activity.jsonl"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Read hook input from stdin (contains tool_name, arguments, etc.)
INPUT=$(cat)

# Build JSON entry
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EVENT="${CLAUDE_HOOK_EVENT:-unknown}"

# Extract relevant fields based on event type
case "$EVENT" in
  PreToolUse)
    TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
    ENTRY=$(jq -n --arg ts "$TIMESTAMP" --arg ev "$EVENT" --arg agent "$AGENT_ID" --arg tool "$TOOL" \
      '{timestamp: $ts, event: $ev, agent: $agent, tool: $tool}')
    ;;
  PostToolUse)
    TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
    ENTRY=$(jq -n --arg ts "$TIMESTAMP" --arg ev "$EVENT" --arg agent "$AGENT_ID" --arg tool "$TOOL" \
      '{timestamp: $ts, event: $ev, agent: $agent, tool: $tool, success: true}')
    ;;
  PostToolUseFailure)
    TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
    ERROR=$(echo "$INPUT" | jq -r '.error // "unknown"')
    ENTRY=$(jq -n --arg ts "$TIMESTAMP" --arg ev "$EVENT" --arg agent "$AGENT_ID" --arg tool "$TOOL" --arg err "$ERROR" \
      '{timestamp: $ts, event: $ev, agent: $agent, tool: $tool, success: false, error: $err}')
    ;;
  SessionStart|Stop)
    ENTRY=$(jq -n --arg ts "$TIMESTAMP" --arg ev "$EVENT" --arg agent "$AGENT_ID" \
      '{timestamp: $ts, event: $ev, agent: $agent}')
    ;;
  *)
    # Unknown event type - log it anyway
    ENTRY=$(jq -n --arg ts "$TIMESTAMP" --arg ev "$EVENT" --arg agent "$AGENT_ID" \
      '{timestamp: $ts, event: $ev, agent: $agent}')
    ;;
esac

# Append to log file
echo "$ENTRY" >> "$LOG_FILE"
