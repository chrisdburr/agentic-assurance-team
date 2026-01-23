#!/usr/bin/env bash
#
# worktree-create.sh - Create a git worktree for an agent working on an issue
#
# Usage: ./scripts/worktree-create.sh <agent> <beads-id> [description]
#
# Examples:
#   ./scripts/worktree-create.sh alice team-001
#   ./scripts/worktree-create.sh bob team-042 "uncertainty quantification"
#
# Creates:
#   - Worktree at .worktrees/<agent>-<slug>-<beads-id>
#   - Branch named <agent>/<beads-id>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREES_DIR="$PROJECT_ROOT/.worktrees"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: $0 <agent> <beads-id> [description]"
    echo ""
    echo "Arguments:"
    echo "  agent        Agent name (alice, bob, charlie)"
    echo "  beads-id     Beads issue ID (e.g., team-001)"
    echo "  description  Optional description for the worktree name"
    echo ""
    echo "Examples:"
    echo "  $0 alice team-001"
    echo "  $0 bob team-042 'uncertainty quantification'"
    exit 1
}

# Validate arguments
if [[ $# -lt 2 ]]; then
    usage
fi

AGENT="$1"
BEADS_ID="$2"
DESCRIPTION="${3:-}"

# Validate agent name
if [[ ! "$AGENT" =~ ^(alice|bob|charlie)$ ]]; then
    echo -e "${RED}Error: Invalid agent name '$AGENT'. Must be alice, bob, or charlie.${NC}"
    exit 1
fi

# Validate beads ID format
if [[ ! "$BEADS_ID" =~ ^[a-zA-Z]+-[a-zA-Z0-9]+$ ]]; then
    echo -e "${RED}Error: Invalid beads ID format '$BEADS_ID'. Expected format: prefix-id (e.g., team-001)${NC}"
    exit 1
fi

# Create slug from description or use beads ID
if [[ -n "$DESCRIPTION" ]]; then
    # Convert description to slug: lowercase, replace spaces with hyphens, remove special chars
    SLUG=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g' | cut -c1-30)
else
    SLUG="work"
fi

# Build worktree name and branch
WORKTREE_NAME="${AGENT}-${SLUG}-${BEADS_ID}"
WORKTREE_PATH="$WORKTREES_DIR/$WORKTREE_NAME"
BRANCH_NAME="${AGENT}/${BEADS_ID}"

# Check if worktree already exists
if [[ -d "$WORKTREE_PATH" ]]; then
    echo -e "${YELLOW}Worktree already exists at $WORKTREE_PATH${NC}"
    echo "To use it: cd $WORKTREE_PATH"
    exit 0
fi

# Ensure worktrees directory exists
mkdir -p "$WORKTREES_DIR"

# Get the main branch name
cd "$PROJECT_ROOT"

# Find the base branch to create from
if git symbolic-ref refs/remotes/origin/HEAD &>/dev/null; then
    MAIN_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
elif git rev-parse --verify HEAD &>/dev/null; then
    # Use current HEAD if it exists
    MAIN_BRANCH=$(git rev-parse --abbrev-ref HEAD)
else
    # No commits yet - need to create initial commit first
    echo -e "${RED}Error: Repository has no commits yet.${NC}"
    echo "Please create an initial commit first:"
    echo "  git add . && git commit -m 'Initial commit'"
    exit 1
fi

# Check if branch already exists
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    echo -e "${YELLOW}Branch $BRANCH_NAME already exists, using it${NC}"
    git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
else
    echo -e "${GREEN}Creating new branch $BRANCH_NAME from $MAIN_BRANCH${NC}"
    git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$MAIN_BRANCH"
fi

echo ""
echo -e "${GREEN}Worktree created successfully!${NC}"
echo ""
echo "  Location: $WORKTREE_PATH"
echo "  Branch:   $BRANCH_NAME"
echo ""
echo "To start working:"
echo "  cd $WORKTREE_PATH"
echo ""
echo "To set agent identity:"
echo "  export AGENT_ID=$AGENT"
