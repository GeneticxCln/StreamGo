#!/bin/bash

# StreamGo Auto-Updater Test Script
# This script tests the auto-updater functionality

set -e

echo "🧪 Testing StreamGo Auto-Updater Flow"
echo "====================================="

# Check if the updater plugin is enabled in Cargo.toml
echo "1. Checking updater plugin configuration..."
if grep -q "tauri-plugin-updater" src-tauri/Cargo.toml; then
    echo "✅ Updater plugin is enabled in Cargo.toml"
else
    echo "❌ Updater plugin is not enabled in Cargo.toml"
    exit 1
fi

# Check if updater is configured in tauri.conf.json
echo "2. Checking Tauri configuration..."
if grep -q "updater" src-tauri/tauri.conf.json; then
    echo "✅ Updater is configured in tauri.conf.json"
else
    echo "❌ Updater is not configured in tauri.conf.json"
    exit 1
fi

# Check if updater plugin is registered in lib.rs
echo "3. Checking plugin registration..."
if grep -q "tauri_plugin_updater::Builder" src-tauri/src/lib.rs; then
    echo "✅ Updater plugin is registered in lib.rs"
else
    echo "❌ Updater plugin is not registered in lib.rs"
    exit 1
fi

# Check if auto-update setting exists in frontend
echo "4. Checking frontend auto-update setting..."
if grep -q "auto-update-toggle" src/components/settings/SettingsSection.svelte; then
    echo "✅ Auto-update toggle exists in settings UI"
else
    echo "❌ Auto-update toggle not found in settings UI"
    exit 1
fi

# Check if auto-update tests exist
echo "5. Checking test coverage..."
if [ -f "tests/e2e/auto-updater.spec.ts" ]; then
    echo "✅ Auto-updater tests exist"
else
    echo "❌ Auto-updater tests not found"
    exit 1
fi

# Check if release workflow exists
echo "6. Checking release workflow..."
if [ -f ".github/workflows/release.yml" ]; then
    echo "✅ Release workflow exists"
else
    echo "❌ Release workflow not found"
    exit 1
fi

# Check if signing keys are referenced in workflow
echo "7. Checking signing configuration..."
if grep -q "TAURI_SIGNING_PRIVATE_KEY" .github/workflows/release.yml; then
    echo "✅ Signing keys are configured in release workflow"
else
    echo "⚠️  Signing keys not configured in release workflow (this is expected for development)"
fi

echo ""
echo "🎉 Auto-updater configuration test completed successfully!"
echo ""
echo "📋 Summary of auto-updater setup:"
echo "   • Backend plugin: ✅ Enabled"
echo "   • Frontend UI: ✅ Available"
echo "   • Tests: ✅ Created"
echo "   • Release workflow: ✅ Configured"
echo ""
echo "🚀 Next steps:"
echo "   1. Set up code signing certificates for production releases"
echo "   2. Configure GitHub repository secrets for signing"
echo "   3. Test actual update flow with a release build"
echo "   4. Run the Playwright tests: npm run test:e2e"
echo ""
echo "📖 For more information, see:"
echo "   • docs/CODE_SIGNING.md"
echo "   • docs/RELEASE_PROCESS.md"
echo "   • .github/workflows/release.yml"