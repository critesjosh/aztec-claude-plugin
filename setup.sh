#!/bin/bash
#
# Aztec Plugin Version Setup Script
# Sets the active Aztec version for syntax and patterns
#
# This script does NOT require git - it works with both cloned repos and marketplace installs.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/.aztec-version"
VERSIONS_FILE="$SCRIPT_DIR/versions/versions.json"

# Available versions
VERSIONS=("devnet" "testnet" "mainnet")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_usage() {
    echo "Usage: ./setup.sh <command>"
    echo ""
    echo "Commands:"
    echo "  devnet   - Set to latest development version (default)"
    echo "  testnet  - Set to testnet version"
    echo "  mainnet  - Set to mainnet version (when available)"
    echo "  status   - Show current version"
    echo "  detect   - Auto-detect version from Nargo.toml"
    echo ""
    echo "Examples:"
    echo "  ./setup.sh devnet     # Use devnet syntax"
    echo "  ./setup.sh status     # Show current setting"
    echo "  ./setup.sh detect     # Detect from project"
    echo ""
    echo "Current version: $(get_current_version)"
}

get_current_version() {
    if [ -f "$CONFIG_FILE" ]; then
        grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" 2>/dev/null | sed 's/.*"\([^"]*\)"$/\1/' || echo "devnet"
    else
        echo "devnet"
    fi
}

validate_version() {
    local version="$1"
    for valid in "${VERSIONS[@]}"; do
        if [ "$version" == "$valid" ]; then
            return 0
        fi
    done
    return 1
}

set_version() {
    local version="$1"

    echo -e "${BLUE}Setting version to $version...${NC}"

    # Write config file
    cat > "$CONFIG_FILE" << EOF
{
  "version": "$version",
  "setAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "note": "Plugin configured for $version syntax. See versions/$version/syntax.md for reference."
}
EOF

    echo -e "${GREEN}Version set to: $version${NC}"
    echo ""
    echo "Syntax reference: versions/$version/syntax.md"
    echo ""

    # Show version-specific notes
    case "$version" in
        "devnet")
            echo "Using latest development syntax (default)."
            echo "May have breaking changes between releases."
            ;;
        "testnet")
            echo "Using testnet syntax."
            echo "For pre-release testing and integration."
            ;;
        "mainnet")
            echo -e "${YELLOW}Note: Mainnet is not yet available.${NC}"
            echo "Syntax may differ when mainnet launches."
            ;;
    esac
}

show_status() {
    local current=$(get_current_version)
    echo -e "Current version: ${GREEN}$current${NC}"
    echo ""

    if [ -f "$CONFIG_FILE" ]; then
        echo "Configuration (.aztec-version):"
        cat "$CONFIG_FILE"
        echo ""
    fi

    echo "Syntax reference: versions/$current/syntax.md"
}

detect_version() {
    echo "Scanning for Nargo.toml files..."
    echo ""

    # Search for Nargo.toml files
    local nargo_files=$(find . -name "Nargo.toml" -type f 2>/dev/null | head -10)

    if [ -z "$nargo_files" ]; then
        echo -e "${YELLOW}No Nargo.toml files found.${NC}"
        echo "Using default: devnet"
        return
    fi

    # Extract version tags
    local found_tags=""
    for file in $nargo_files; do
        local tag=$(grep -o 'tag = "[^"]*"' "$file" 2>/dev/null | head -1 | sed 's/tag = "\([^"]*\)"/\1/')
        if [ -n "$tag" ]; then
            echo "Found in $file:"
            echo "  Tag: $tag"
            found_tags="$tag"
        fi
    done

    if [ -z "$found_tags" ]; then
        echo -e "${YELLOW}No aztec-packages tags found.${NC}"
        echo "Using default: devnet"
        return
    fi

    echo ""

    # Determine version from tag
    if echo "$found_tags" | grep -q "devnet"; then
        echo -e "Detected version: ${GREEN}devnet${NC}"
        echo ""
        read -p "Set plugin to devnet? [Y/n] " confirm
        if [ "$confirm" != "n" ] && [ "$confirm" != "N" ]; then
            set_version "devnet"
        fi
    elif echo "$found_tags" | grep -qE "v0\.(8[7-9]|9[0-9])\."; then
        echo -e "Detected version: ${GREEN}devnet${NC} (v0.87+)"
        echo ""
        read -p "Set plugin to devnet? [Y/n] " confirm
        if [ "$confirm" != "n" ] && [ "$confirm" != "N" ]; then
            set_version "devnet"
        fi
    elif echo "$found_tags" | grep -qE "v0\.(8[0-6])\."; then
        echo -e "Detected version: ${GREEN}testnet${NC}"
        echo ""
        read -p "Set plugin to testnet? [Y/n] " confirm
        if [ "$confirm" != "n" ] && [ "$confirm" != "N" ]; then
            set_version "testnet"
        fi
    elif echo "$found_tags" | grep -qE "v1\."; then
        echo -e "Detected version: ${GREEN}mainnet${NC}"
        echo ""
        read -p "Set plugin to mainnet? [Y/n] " confirm
        if [ "$confirm" != "n" ] && [ "$confirm" != "N" ]; then
            set_version "mainnet"
        fi
    else
        echo -e "${YELLOW}Unknown version pattern.${NC}"
        echo "Tag: $found_tags"
        echo "Using default: devnet"
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
    "detect"|"--detect"|"-d")
        detect_version
        ;;
    "help"|"--help"|"-h")
        print_usage
        ;;
    *)
        if validate_version "$1"; then
            set_version "$1"
        else
            echo -e "${RED}Error: Unknown version '$1'${NC}"
            echo ""
            print_usage
            exit 1
        fi
        ;;
esac
