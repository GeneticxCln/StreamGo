#!/usr/bin/env bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the new version from argument
NEW_VERSION="$1"

if [ -z "$NEW_VERSION" ]; then
    echo -e "${RED}Error: Version number required${NC}"
    echo "Usage: $0 <version>"
    echo "Example: $0 1.0.0"
    exit 1
fi

# Validate version format (semantic versioning)
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Error: Invalid version format${NC}"
    echo "Version must follow semantic versioning: MAJOR.MINOR.PATCH"
    echo "Example: 1.0.0"
    exit 1
fi

# Get the project root (parent of scripts directory)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${YELLOW}Updating version to ${NEW_VERSION}...${NC}"
echo ""

# Update package.json
PACKAGE_JSON="$PROJECT_ROOT/package.json"
if [ -f "$PACKAGE_JSON" ]; then
    sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_JSON"
    echo -e "${GREEN}✓${NC} Updated package.json"
else
    echo -e "${RED}✗${NC} package.json not found"
    exit 1
fi

# Update Cargo.toml
CARGO_TOML="$PROJECT_ROOT/src-tauri/Cargo.toml"
if [ -f "$CARGO_TOML" ]; then
    sed -i "0,/^version = \".*\"/s//version = \"$NEW_VERSION\"/" "$CARGO_TOML"
    echo -e "${GREEN}✓${NC} Updated src-tauri/Cargo.toml"
else
    echo -e "${RED}✗${NC} src-tauri/Cargo.toml not found"
    exit 1
fi

# Update tauri.conf.json
TAURI_CONF="$PROJECT_ROOT/src-tauri/tauri.conf.json"
if [ -f "$TAURI_CONF" ]; then
    sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" "$TAURI_CONF"
    echo -e "${GREEN}✓${NC} Updated src-tauri/tauri.conf.json"
else
    echo -e "${RED}✗${NC} src-tauri/tauri.conf.json not found"
    exit 1
fi

echo ""
echo -e "${GREEN}Version updated successfully to ${NEW_VERSION}${NC}"
echo ""
echo "Next steps:"
echo "  1. Update CHANGELOG.md with release notes"
echo "  2. Commit the changes: git commit -am \"chore: bump version to v${NEW_VERSION}\""
echo "  3. Create and push tag: git tag -a v${NEW_VERSION} -m \"Release v${NEW_VERSION}\" && git push origin v${NEW_VERSION}"
