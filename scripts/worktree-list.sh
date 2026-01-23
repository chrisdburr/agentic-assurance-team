#!/usr/bin/env bash
#
# worktree-list.sh - List all git worktrees for the team
#
# Usage: ./scripts/worktree-list.sh [--agent <name>] [--json]
#
# Options:
#   --agent <name>  Filter by agent (alice, bob, charlie)
#   --json          Output as JSON

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREES_DIR="$PROJECT_ROOT/.worktrees"

# Colors for output
PURPLE='\033[0;35m'
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

FILTER_AGENT=""
OUTPUT_JSON=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --agent)
            FILTER_AGENT="$2"
            shift 2
            ;;
        --json)
            OUTPUT_JSON=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--agent <name>] [--json]"
            echo ""
            echo "Options:"
            echo "  --agent <name>  Filter by agent (alice, bob, charlie)"
            echo "  --json          Output as JSON"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Agent colors
get_agent_color() {
    case $1 in
        alice) echo "$PURPLE" ;;
        bob) echo "$BLUE" ;;
        charlie) echo "$GREEN" ;;
        *) echo "$NC" ;;
    esac
}

# Get worktree info
cd "$PROJECT_ROOT"

if $OUTPUT_JSON; then
    # JSON output
    echo "["
    first=true

    while IFS= read -r line; do
        if [[ "$line" =~ ^worktree ]]; then
            worktree_path="${line#worktree }"
        elif [[ "$line" =~ ^HEAD ]]; then
            head="${line#HEAD }"
        elif [[ "$line" =~ ^branch ]]; then
            branch="${line#branch refs/heads/}"

            # Extract agent from branch name (agent/beads-id)
            agent="${branch%%/*}"
            beads_id="${branch#*/}"
            worktree_name=$(basename "$worktree_path")

            # Apply filter
            if [[ -n "$FILTER_AGENT" && "$agent" != "$FILTER_AGENT" ]]; then
                continue
            fi

            # Skip the main worktree
            if [[ "$worktree_path" == "$PROJECT_ROOT" ]]; then
                continue
            fi

            if ! $first; then
                echo ","
            fi
            first=false

            cat <<EOF
  {
    "name": "$worktree_name",
    "path": "$worktree_path",
    "branch": "$branch",
    "agent": "$agent",
    "beads_id": "$beads_id"
  }
EOF
        fi
    done < <(git worktree list --porcelain)

    echo ""
    echo "]"
else
    # Human-readable output
    echo ""
    echo "Team Worktrees"
    echo "=============="
    echo ""

    count=0

    while IFS= read -r line; do
        if [[ "$line" =~ ^worktree ]]; then
            worktree_path="${line#worktree }"
        elif [[ "$line" =~ ^HEAD ]]; then
            head="${line#HEAD }"
        elif [[ "$line" =~ ^branch ]]; then
            branch="${line#branch refs/heads/}"

            # Extract agent from branch name
            agent="${branch%%/*}"
            beads_id="${branch#*/}"
            worktree_name=$(basename "$worktree_path")

            # Apply filter
            if [[ -n "$FILTER_AGENT" && "$agent" != "$FILTER_AGENT" ]]; then
                continue
            fi

            # Skip the main worktree
            if [[ "$worktree_path" == "$PROJECT_ROOT" ]]; then
                continue
            fi

            count=$((count + 1))
            color=$(get_agent_color "$agent")

            echo -e "${color}[$agent]${NC} $worktree_name"
            echo "  Branch: $branch"
            echo "  Path:   $worktree_path"
            echo ""
        fi
    done < <(git worktree list --porcelain)

    if [[ $count -eq 0 ]]; then
        echo -e "${YELLOW}No worktrees found.${NC}"
        echo ""
        echo "Create one with:"
        echo "  ./scripts/worktree-create.sh <agent> <beads-id>"
    else
        echo "Total: $count worktree(s)"
    fi
    echo ""
fi
