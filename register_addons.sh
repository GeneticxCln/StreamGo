#!/bin/bash
# Manually trigger addon registration by calling the API

cd /home/quinton/StreamGo/src-tauri

# Create a test program that calls get_builtin_addons and saves to DB
cat > /tmp/register_test.rs << 'EOF'
use app_lib::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    logging::initialize_logging()?;
    
    // Open database
    let db = Database::new("~/.local/share/StreamGo/streamgo.db".to_string())?;
    
    println!("=== Fetching builtin addons ===");
    let addons = api::get_builtin_addons().await?;
    
    println!("Found {} builtin addons:", addons.len());
    
    for addon in &addons {
        println!("\n📦 {}", addon.name);
        println!("   ID: {}", addon.id);
        println!("   URL: {}", addon.url);
        println!("   Version: {}", addon.version);
        println!("   Priority: {}", addon.priority);
        
        // Save to database
        match db.save_addon(addon) {
            Ok(_) => println!("   ✓ Saved to database"),
            Err(e) => println!("   ✗ Failed to save: {}", e),
        }
    }
    
    println!("\n=== Verifying addons in database ===");
    let saved_addons = db.get_addons()?;
    println!("Database now contains {} addons", saved_addons.len());
    
    for addon in saved_addons {
        println!("  - {} ({})", addon.name, addon.url);
    }
    
    Ok(())
}
EOF

# Compile and run
rustc --edition 2021 --crate-type bin \
  -L target/debug/deps \
  --extern app_lib=target/debug/libapp_lib.rlib \
  --extern tokio=target/debug/deps/libtokio-*.rlib \
  -o /tmp/register_addons \
  /tmp/register_test.rs 2>&1 | head -20

if [ -f /tmp/register_addons ]; then
    /tmp/register_addons
else
    echo "Failed to compile test program"
fi
