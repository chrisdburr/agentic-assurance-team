#!/bin/bash
# Rich conversation logger for Claude Code hooks
# Captures full event data into per-session JSONL files for transcript reconstruction
#
# Usage: Called by hook configs with event type passed via CLAUDE_HOOK_EVENT env var
# Writes to: .agents/logs/{agent_id}/sessions/{session_id}.jsonl
#
# Events handled: SessionStart, SessionEnd, UserPromptSubmit, PreToolUse,
#   PostToolUse, PostToolUseFailure, Stop, SubagentStart, SubagentStop, PreCompact

set -euo pipefail

AGENT_ID="${AGENT_ID:-unknown}"
EVENT="${CLAUDE_HOOK_EVENT:-unknown}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

# Read hook input from stdin
INPUT=$(cat)

# Extract session_id from input (present in all hook events)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
if [ -z "$SESSION_ID" ]; then
  # Fallback: use a hash of date as session identifier
  SESSION_ID="unknown-$(date -u +%Y%m%d)"
fi

# Set up log directory and file
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
LOG_DIR="${REPO_ROOT}/.agents/logs/${AGENT_ID}/sessions"
LOG_FILE="${LOG_DIR}/${SESSION_ID}.jsonl"

mkdir -p "$LOG_DIR"

# Truncation limit for large fields (4KB)
TRUNCATE_LIMIT=4096

# Helper: truncate a string to TRUNCATE_LIMIT bytes
truncate_field() {
  local value="$1"
  local len=${#value}
  if [ "$len" -gt "$TRUNCATE_LIMIT" ]; then
    echo "${value:0:$TRUNCATE_LIMIT}...[truncated, ${len} total chars]"
  else
    echo "$value"
  fi
}

# Build JSON entry based on event type
case "$EVENT" in
  SessionStart)
    ENTRY=$(jq -n \
      --arg ts "$TIMESTAMP" \
      --arg ev "$EVENT" \
      --arg agent "$AGENT_ID" \
      --arg sid "$SESSION_ID" \
      '{timestamp: $ts, event: $ev, agent: $agent, session_id: $sid}')
    ;;

  SessionEnd)
    ENTRY=$(jq -n \
      --arg ts "$TIMESTAMP" \
      --arg ev "$EVENT" \
      --arg agent "$AGENT_ID" \
      --arg sid "$SESSION_ID" \
      '{timestamp: $ts, event: $ev, agent: $agent, session_id: $sid}')
    ;;

  UserPromptSubmit)
    PROMPT=$(echo "$INPUT" | jq -r '.prompt // ""' 2>/dev/null)
    PROMPT=$(truncate_field "$PROMPT")
    ENTRY=$(jq -n \
      --arg ts "$TIMESTAMP" \
      --arg ev "$EVENT" \
      --arg agent "$AGENT_ID" \
      --arg sid "$SESSION_ID" \
      --arg prompt "$PROMPT" \
      '{timestamp: $ts, event: $ev, agent: $agent, session_id: $sid, prompt: $prompt}')
    ;;

  PreToolUse)
    TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"' 2>/dev/null)
    TOOL_INPUT=$(echo "$INPUT" | jq -c '.tool_input // {}' 2>/dev/null)
    TOOL_INPUT=$(truncate_field "$TOOL_INPUT")
    ENTRY=$(jq -n \
      --arg ts "$TIMESTAMP" \
      --arg ev "$EVENT" \
      --arg agent "$AGENT_ID" \
      --arg sid "$SESSION_ID" \
      --arg tool "$TOOL" \
      --arg tinput "$TOOL_INPUT" \
      '{timestamp: $ts, event: $ev, agent: $agent, session_id: $sid, tool_name: $tool, tool_input: $tinput}')
    ;;

  PostToolUse)
    TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"' 2>/dev/null)
    TOOL_RESPONSE=$(echo "$INPUT" | jq -c '.tool_response // null' 2>/dev/null)
    TOOL_RESPONSE=$(truncate_field "$TOOL_RESPONSE")
    ENTRY=$(jq -n \
      --arg ts "$TIMESTAMP" \
      --arg ev "$EVENT" \
      --arg agent "$AGENT_ID" \
      --arg sid "$SESSION_ID" \
      --arg tool "$TOOL" \
      --arg tresp "$TOOL_RESPONSE" \
      '{timestamp: $ts, event: $ev, agent: $agent, session_id: $sid, tool_name: $tool, tool_response: $tresp}')
    ;;

  PostToolUseFailure)
    TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"' 2>/dev/null)
    ERROR=$(echo "$INPUT" | jq -r '.error // "unknown"' 2>/dev/null)
    ERROR=$(truncate_field "$ERROR")
    ENTRY=$(jq -n \
      --arg ts "$TIMESTAMP" \
      --arg ev "$EVENT" \
      --arg agent "$AGENT_ID" \
      --arg sid "$SESSION_ID" \
      --arg tool "$TOOL" \
      --arg err "$ERROR" \
      '{timestamp: $ts, event: $ev, agent: $agent, session_id: $sid, tool_name: $tool, error: $err}')
    ;;

  Stop)
    ENTRY=$(jq -n \
      --arg ts "$TIMESTAMP" \
      --arg ev "$EVENT" \
      --arg agent "$AGENT_ID" \
      --arg sid "$SESSION_ID" \
      '{timestamp: $ts, event: $ev, agent: $agent, session_id: $sid}')
    ;;

  SubagentStart)
    SUBAGENT_ID=$(echo "$INPUT" | jq -r '.subagent_id // ""' 2>/dev/null)
    ENTRY=$(jq -n \
      --arg ts "$TIMESTAMP" \
      --arg ev "$EVENT" \
      --arg agent "$AGENT_ID" \
      --arg sid "$SESSION_ID" \
      --arg subid "$SUBAGENT_ID" \
      '{timestamp: $ts, event: $ev, agent: $agent, session_id: $sid, subagent_id: $subid}')
    ;;

  SubagentStop)
    SUBAGENT_ID=$(echo "$INPUT" | jq -r '.subagent_id // ""' 2>/dev/null)
    ENTRY=$(jq -n \
      --arg ts "$TIMESTAMP" \
      --arg ev "$EVENT" \
      --arg agent "$AGENT_ID" \
      --arg sid "$SESSION_ID" \
      --arg subid "$SUBAGENT_ID" \
      '{timestamp: $ts, event: $ev, agent: $agent, session_id: $sid, subagent_id: $subid}')
    ;;

  PreCompact)
    ENTRY=$(jq -n \
      --arg ts "$TIMESTAMP" \
      --arg ev "$EVENT" \
      --arg agent "$AGENT_ID" \
      --arg sid "$SESSION_ID" \
      '{timestamp: $ts, event: $ev, agent: $agent, session_id: $sid}')
    ;;

  *)
    # Unknown event type - log basic info
    ENTRY=$(jq -n \
      --arg ts "$TIMESTAMP" \
      --arg ev "$EVENT" \
      --arg agent "$AGENT_ID" \
      --arg sid "$SESSION_ID" \
      '{timestamp: $ts, event: $ev, agent: $agent, session_id: $sid}')
    ;;
esac

# Append to session log file
echo "$ENTRY" >> "$LOG_FILE"
