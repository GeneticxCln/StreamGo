#!/bin/bash
cd /home/quinton/StreamGo/src-tauri
rm -f streamgo.db*

# Build and run a quick addon test
cargo build --quiet 2>&1 | grep -i error

# Create a test to verify addon URL is stored
cat > /tmp/test_addon_url.rs << 'EOF'
use streamgo::*;

#[tokio::test]
async fn test_addon_url_stored() {
    let addon = api::install_addon("https://v3-cinemeta.strem.io/manifest.json").await.unwrap();
    println!("Addon ID: {}", addon.id);
    println!("Addon URL: {}", addon.url);
    println!("Addon Name: {}", addon.name);
    assert!(!addon.url.is_empty());
    assert_eq!(addon.url, "https://v3-cinemeta.strem.io");
}
EOF

# Run the test with output
cargo test --lib test_addon_url_stored -- --nocapture 2>&1 | grep -A 20 "test_addon_url_stored"
