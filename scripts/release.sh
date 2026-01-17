#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Check versions are in sync
PLUGIN_VERSION=$(jq -r '.version' .claude-plugin/plugin.json)
MARKETPLACE_VERSION=$(jq -r '.plugins[0].version' .claude-plugin/marketplace.json)

if [ "$PLUGIN_VERSION" != "$MARKETPLACE_VERSION" ]; then
  echo -e "${RED}Version mismatch!${NC}"
  echo "  plugin.json:      $PLUGIN_VERSION"
  echo "  marketplace.json: $MARKETPLACE_VERSION"
  echo ""
  echo "Please sync the versions before releasing."
  exit 1
fi

# Get current version
CURRENT_VERSION="$PLUGIN_VERSION"
echo -e "${YELLOW}Current version: ${CURRENT_VERSION}${NC}"

# Parse current version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Show options
echo ""
echo "Select version bump type:"
echo "  1) patch  -> $MAJOR.$MINOR.$((PATCH + 1))"
echo "  2) minor  -> $MAJOR.$((MINOR + 1)).0"
echo "  3) major  -> $((MAJOR + 1)).0.0"
echo "  4) custom"
echo ""
read -p "Choice [1-4]: " CHOICE

case $CHOICE in
  1)
    NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
    ;;
  2)
    NEW_VERSION="$MAJOR.$((MINOR + 1)).0"
    ;;
  3)
    NEW_VERSION="$((MAJOR + 1)).0.0"
    ;;
  4)
    read -p "Enter custom version: " NEW_VERSION
    ;;
  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${YELLOW}Bumping version: ${CURRENT_VERSION} -> ${NEW_VERSION}${NC}"
read -p "Continue? [y/N]: " CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# Update plugin.json
jq ".version = \"$NEW_VERSION\"" .claude-plugin/plugin.json > tmp.json && mv tmp.json .claude-plugin/plugin.json
echo -e "${GREEN}Updated .claude-plugin/plugin.json${NC}"

# Update marketplace.json
jq ".plugins[0].version = \"$NEW_VERSION\"" .claude-plugin/marketplace.json > tmp.json && mv tmp.json .claude-plugin/marketplace.json
echo -e "${GREEN}Updated .claude-plugin/marketplace.json${NC}"

# Git operations
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "Bump version to $NEW_VERSION"
echo -e "${GREEN}Committed version bump${NC}"

# Create tag
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"
echo -e "${GREEN}Created tag v$NEW_VERSION${NC}"

# Push
read -p "Push to origin? [y/N]: " PUSH_CONFIRM
if [[ "$PUSH_CONFIRM" =~ ^[Yy]$ ]]; then
  git push origin main
  git push origin "v$NEW_VERSION"
  echo -e "${GREEN}Pushed to origin${NC}"
  echo ""
  echo -e "${GREEN}Release v$NEW_VERSION complete!${NC}"
  echo "Create a GitHub release at: https://github.com/critesjosh/aztec-claude-plugin/releases/new?tag=v$NEW_VERSION"
else
  echo ""
  echo -e "${YELLOW}Don't forget to push:${NC}"
  echo "  git push origin main"
  echo "  git push origin v$NEW_VERSION"
fi
