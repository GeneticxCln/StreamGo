#!/bin/bash
set -e

DB_PATH="$HOME/.local/share/StreamGo/streamgo.db"

echo "=== StreamGo Direct Addon Registration ==="
echo "Database: $DB_PATH"
echo

# Addon definitions
declare -A ADDONS
ADDONS[cinemeta]="https://v3-cinemeta.strem.io/manifest.json"
ADDONS[opensubtitles]="https://opensubtitles.strem.io/manifest.json"
ADDONS[watchhub]="https://watchhub.strem.io/manifest.json"

PRIORITY=10

for name in "${!ADDONS[@]}"; do
    URL="${ADDONS[$name]}"
    echo "📥 Fetching $name from $URL"
    
    MANIFEST=$(curl -s "$URL" 2>&1)
    
    if [ $? -ne 0 ] || [ -z "$MANIFEST" ]; then
        echo "   ✗ Failed to fetch manifest"
        continue
    fi
    
    # Check if response is HTML (not JSON)
    if echo "$MANIFEST" | grep -q "<!DOCTYPE\|<html"; then
        echo "   ⚠ Skipping - requires configuration (returns HTML landing page)"
        continue
    fi
    
    # Parse manifest JSON
    ID=$(echo "$MANIFEST" | jq -r '.id // empty' 2>/dev/null)
    NAME=$(echo "$MANIFEST" | jq -r '.name // empty' 2>/dev/null)
    VERSION=$(echo "$MANIFEST" | jq -r '.version // empty' 2>/dev/null)
    DESC=$(echo "$MANIFEST" | jq -r '.description // empty' 2>/dev/null)
    
    if [ -z "$ID" ] || [ -z "$NAME" ]; then
        echo "   ✗ Invalid manifest (missing id or name)"
        continue
    fi
    
    # Strip /manifest.json from URL for base URL
    BASE_URL="${URL%/manifest.json}"
    
    echo "   Name: $NAME"
    echo "   ID: $ID"
    echo "   Version: $VERSION"
    echo "   Base URL: $BASE_URL"
    
    # Escape JSON for SQL
    MANIFEST_ESC=$(echo "$MANIFEST" | sed "s/'/''/g")
    NOW=$(date -u +"%Y-%m-%dT%H:%M:%S"Z)
    
    # Insert into database
    sqlite3 "$DB_PATH" <<SQL
INSERT OR REPLACE INTO addons (
    id, name, version, description, author, url, enabled, addon_type, manifest, installed_at, priority
) VALUES (
    '$ID',
    '$NAME',
    '$VERSION',
    '$DESC',
    'Stremio Community',
    '$BASE_URL',
    1,
    'ContentProvider',
    '$MANIFEST_ESC',
    '$NOW',
    $PRIORITY
);
SQL
    
    if [ $? -eq 0 ]; then
        echo "   ✓ Installed successfully (priority: $PRIORITY)"
    else
        echo "   ✗ Failed to insert into database"
    fi
    
    ((PRIORITY--))
    echo
done

echo "=== Verification ==="
sqlite3 "$DB_PATH" "SELECT name, url, enabled, priority FROM addons ORDER BY priority DESC;"

echo
echo "✅ Addon registration complete!"
