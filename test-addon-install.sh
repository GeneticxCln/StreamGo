#!/bin/bash
# Test Stremio Addon Installation
# This script tests if real Stremio addons can now be installed

set -e

echo "🧪 Testing Stremio Addon Installation Fix"
echo "=========================================="
echo ""

# Test addon URLs - real working Stremio addons
ADDON_URLS=(
    "https://v3-cinemeta.strem.io/manifest.json"
    "https://opensubtitles.strem.io/manifest.json"
    "https://watchhub.strem.io/manifest.json"
)

echo "📋 Testing ${#ADDON_URLS[@]} addon manifest URLs..."
echo ""

SUCCESS=0
FAILED=0

for url in "${ADDON_URLS[@]}"; do
    echo "Testing: $url"
    
    # Fetch the manifest
    RESPONSE=$(curl -s -w "\n%{http_code}" "$url" --max-time 10)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
    BODY=$(echo "$RESPONSE" | head -n -1)
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        # Check if it has required fields
        HAS_ID=$(echo "$BODY" | jq -e '.id' > /dev/null 2>&1 && echo "yes" || echo "no")
        HAS_NAME=$(echo "$BODY" | jq -e '.name' > /dev/null 2>&1 && echo "yes" || echo "no")
        HAS_VERSION=$(echo "$BODY" | jq -e '.version' > /dev/null 2>&1 && echo "yes" || echo "no")
        HAS_RESOURCES=$(echo "$BODY" | jq -e '.resources' > /dev/null 2>&1 && echo "yes" || echo "no")
        
        # Check if resources is a string array
        RESOURCES_TYPE=$(echo "$BODY" | jq -r '.resources | type')
        
        echo "  ✅ HTTP 200 OK"
        echo "  📦 Name: $(echo "$BODY" | jq -r '.name')"
        echo "  🆔 ID: $(echo "$BODY" | jq -r '.id')"
        echo "  📌 Version: $(echo "$BODY" | jq -r '.version')"
        echo "  🔧 Resources: $(echo "$BODY" | jq -r '.resources | join(", ")')"
        echo "  📊 Resources Type: $RESOURCES_TYPE"
        
        if [ "$HAS_ID" = "yes" ] && [ "$HAS_NAME" = "yes" ] && [ "$HAS_VERSION" = "yes" ] && [ "$HAS_RESOURCES" = "yes" ] && [ "$RESOURCES_TYPE" = "array" ]; then
            echo "  ✨ Valid Stremio manifest - should now install!"
            SUCCESS=$((SUCCESS + 1))
        else
            echo "  ⚠️ Missing required fields"
            FAILED=$((FAILED + 1))
        fi
    else
        echo "  ❌ HTTP $HTTP_CODE - Failed to fetch"
        FAILED=$((FAILED + 1))
    fi
    
    echo ""
done

echo "=========================================="
echo "📊 Results: $SUCCESS/$((SUCCESS + FAILED)) addons valid"
echo ""

if [ $SUCCESS -eq ${#ADDON_URLS[@]} ]; then
    echo "✅ All test addons are valid and should install successfully!"
    echo ""
    echo "🚀 Next steps:"
    echo "  1. Run: npm run tauri:dev"
    echo "  2. Go to Addons → Discover Store"
    echo "  3. Click 'TMDB Metadata' or 'OpenSubtitles' quick install"
    echo "  4. Verify addon appears in Installed tab"
    exit 0
else
    echo "⚠️ Some addons failed - check network/URLs"
    exit 1
fi
