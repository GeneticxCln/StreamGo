#!/bin/bash
# This script fixes the stuck onboarding screen by clearing localStorage

echo "Fixing stuck onboarding..."

# Kill the app if running
pkill -9 streamgo 2>/dev/null

# Clear the onboarding flag from Chrome/WebKit cache
# Tauri stores localStorage in different places depending on the OS

# Find and clear StreamGo config
CONFIG_DIRS=(
    "$HOME/.config/StreamGo"
    "$HOME/.local/share/StreamGo"
    "$HOME/.cache/StreamGo"
)

for dir in "${CONFIG_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "Checking $dir..."
        # Find and delete Local Storage files
        find "$dir" -type f -name "*Local Storage*" -delete 2>/dev/null
        find "$dir" -type f -name "*.localstorage*" -delete 2>/dev/null
    fi
done

echo "Onboarding flag cleared!"
echo "Restart the app now: /home/quinton/StreamGo/src-tauri/target/release/streamgo"
