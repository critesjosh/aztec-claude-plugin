#!/bin/bash
#
# Aztec Plugin Network Setup Script
# Switches the plugin to use syntax/patterns for a specific Aztec network version
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/network.json"

# Available networks (branches)
NETWORKS=("mainnet" "testnet" "devnet")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_usage() {
    echo "Usage: ./setup.sh <network>"
    echo ""
    echo "Available networks:"
    echo "  mainnet  - Stable release for Aztec mainnet"
    echo "  testnet  - Current testnet version"
    echo "  devnet   - Latest development version (may have breaking changes)"
    echo ""
    echo "Examples:"
    echo "  ./setup.sh testnet"
    echo "  ./setup.sh devnet"
    echo ""
    echo "Current network: $(get_current_network)"
}

get_current_network() {
    if [ -f "$CONFIG_FILE" ]; then
        grep -o '"network"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | sed 's/.*"\([^"]*\)"$/\1/' 2>/dev/null || echo "unknown"
    else
        # Try to detect from git branch
        git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
    fi
}

validate_network() {
    local network="$1"
    for valid in "${NETWORKS[@]}"; do
        if [ "$network" == "$valid" ]; then
            return 0
        fi
    done
    return 1
}

switch_network() {
    local network="$1"

    echo -e "${BLUE}Switching to $network...${NC}"

    # Check if we're in a git repo
    if git rev-parse --git-dir > /dev/null 2>&1; then
        # Check if the branch exists
        if git show-ref --verify --quiet "refs/heads/$network" || \
           git show-ref --verify --quiet "refs/remotes/origin/$network"; then

            # Stash any local changes
            if ! git diff --quiet 2>/dev/null; then
                echo -e "${YELLOW}Stashing local changes...${NC}"
                git stash
            fi

            # Fetch latest and checkout
            echo "Fetching latest updates..."
            git fetch origin "$network" 2>/dev/null || true

            if git show-ref --verify --quiet "refs/heads/$network"; then
                git checkout "$network"
            else
                git checkout -b "$network" "origin/$network"
            fi

            echo -e "${GREEN}Switched to branch: $network${NC}"
        else
            echo -e "${RED}Error: Branch '$network' does not exist.${NC}"
            echo ""
            echo "Available branches:"
            git branch -r | grep origin | sed 's/origin\//  /' | grep -v HEAD
            echo ""
            echo "This network version may not be available yet."
            echo "Check https://github.com/critesjosh/aztec-claude-plugin for available versions."
            exit 1
        fi
    else
        echo -e "${RED}Error: Not a git repository.${NC}"
        echo "Please clone the plugin repository first:"
        echo "  git clone https://github.com/critesjosh/aztec-claude-plugin"
        exit 1
    fi

    # Write config file
    cat > "$CONFIG_FILE" << EOF
{
  "network": "$network",
  "switchedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "notes": "Plugin configured for $network. Syntax and patterns match this network version."
}
EOF

    echo -e "${GREEN}Configuration saved to network.json${NC}"
    echo ""
    echo -e "Network: ${GREEN}$network${NC}"
    echo "You can now use the plugin with $network-compatible syntax."
}

show_status() {
    local current=$(get_current_network)
    echo -e "Current network: ${GREEN}$current${NC}"

    if [ -f "$CONFIG_FILE" ]; then
        echo ""
        echo "Configuration:"
        cat "$CONFIG_FILE"
    fi

    if git rev-parse --git-dir > /dev/null 2>&1; then
        echo ""
        echo "Git branch: $(git rev-parse --abbrev-ref HEAD)"
    fi
}

# Main
case "${1:-}" in
    "")
        print_usage
        ;;
    "status"|"--status"|"-s")
        show_status
        ;;
    "help"|"--help"|"-h")
        print_usage
        ;;
    *)
        if validate_network "$1"; then
            switch_network "$1"
        else
            echo -e "${RED}Error: Unknown network '$1'${NC}"
            echo ""
            print_usage
            exit 1
        fi
        ;;
esac
