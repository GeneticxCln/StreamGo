#!/bin/bash

# Test that builtin addons are properly registered with valid URLs

cd /home/quinton/StreamGo

# Delete test database if exists
rm -f /tmp/test_streamgo.db

# Run a test that checks addon registration
cat > /tmp/test_addon_registration.rs << 'EOF'
#[tokio::test]
async fn test_builtin_addon_urls() {
    use streamgo::*;
    
    // Get builtin addons
    let addons = api::get_builtin_addons().await.unwrap();
    
    println!("\n=== Builtin Addons ===");
    for addon in &addons {
        println!("ID: {}", addon.id);
        println!("Name: {}", addon.name);
        println!("URL: {}", addon.url);
        println!("Enabled: {}", addon.enabled);
        println!("---");
        
        // Verify URL is valid
        assert!(!addon.url.is_empty(), "Addon URL should not be empty");
        assert!(addon.url.starts_with("http"), "Addon URL should start with http");
        assert_ne!(addon.url, "built-in", "Addon URL should not be 'built-in'");
    }
    
    println!("\n✓ All {} builtin addons have valid URLs", addons.len());
}
EOF

# Copy test to src-tauri/tests
mkdir -p src-tauri/tests
cp /tmp/test_addon_registration.rs src-tauri/tests/addon_test.rs

# Run the test
cd src-tauri
cargo test --test addon_test test_builtin_addon_urls -- --nocapture --test-threads=1

# Cleanup
rm tests/addon_test.rs
