#!/usr/bin/env bash
#
# worktree-cleanup.sh - Remove merged or stale worktrees
#
# Usage: ./scripts/worktree-cleanup.sh [--dry-run] [--force] [--agent <name>]
#
# Options:
#   --dry-run       Show what would be removed without actually removing
#   --force         Remove worktrees even if branches are not merged
#   --agent <name>  Only cleanup worktrees for specific agent

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREES_DIR="$PROJECT_ROOT/.worktrees"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

DRY_RUN=false
FORCE=false
FILTER_AGENT=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --agent)
            FILTER_AGENT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--dry-run] [--force] [--agent <name>]"
            echo ""
            echo "Options:"
            echo "  --dry-run       Show what would be removed without actually removing"
            echo "  --force         Remove worktrees even if branches are not merged"
            echo "  --agent <name>  Only cleanup worktrees for specific agent"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

cd "$PROJECT_ROOT"

# Get the main branch name
MAIN_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

echo ""
if $DRY_RUN; then
    echo -e "${CYAN}Dry run mode - no changes will be made${NC}"
    echo ""
fi

echo "Checking worktrees for cleanup..."
echo ""

removed_count=0
skipped_count=0

# Collect worktree info
while IFS= read -r line; do
    if [[ "$line" =~ ^worktree ]]; then
        worktree_path="${line#worktree }"
    elif [[ "$line" =~ ^HEAD ]]; then
        head="${line#HEAD }"
    elif [[ "$line" =~ ^branch ]]; then
        branch="${line#branch refs/heads/}"

        # Skip the main worktree
        if [[ "$worktree_path" == "$PROJECT_ROOT" ]]; then
            continue
        fi

        # Extract agent from branch name
        agent="${branch%%/*}"

        # Apply filter
        if [[ -n "$FILTER_AGENT" && "$agent" != "$FILTER_AGENT" ]]; then
            continue
        fi

        worktree_name=$(basename "$worktree_path")

        # Check if branch is merged into main
        if git branch --merged "$MAIN_BRANCH" | grep -q "^\s*$branch$"; then
            is_merged=true
        else
            is_merged=false
        fi

        if $is_merged; then
            echo -e "${GREEN}[merged]${NC} $worktree_name"
            echo "  Branch: $branch"

            if ! $DRY_RUN; then
                # Remove worktree
                git worktree remove "$worktree_path"
                # Delete branch
                git branch -d "$branch" 2>/dev/null || true
                echo -e "  ${GREEN}Removed${NC}"
            else
                echo "  Would remove worktree and delete branch"
            fi
            removed_count=$((removed_count + 1))
            echo ""

        elif $FORCE; then
            echo -e "${YELLOW}[unmerged]${NC} $worktree_name"
            echo "  Branch: $branch"

            if ! $DRY_RUN; then
                # Force remove worktree
                git worktree remove --force "$worktree_path"
                # Force delete branch
                git branch -D "$branch" 2>/dev/null || true
                echo -e "  ${YELLOW}Force removed${NC}"
            else
                echo "  Would force remove worktree and delete branch"
            fi
            removed_count=$((removed_count + 1))
            echo ""

        else
            echo -e "${RED}[unmerged]${NC} $worktree_name"
            echo "  Branch: $branch"
            echo "  Skipped (use --force to remove unmerged worktrees)"
            skipped_count=$((skipped_count + 1))
            echo ""
        fi
    fi
done < <(git worktree list --porcelain)

# Prune stale worktree references
if ! $DRY_RUN; then
    echo "Pruning stale worktree references..."
    git worktree prune
fi

echo ""
echo "Summary:"
echo "  Removed: $removed_count"
echo "  Skipped: $skipped_count"
echo ""

if $DRY_RUN && [[ $removed_count -gt 0 ]]; then
    echo -e "${YELLOW}Run without --dry-run to apply changes${NC}"
fi
