use app_lib::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== StreamGo Addon Registration ===\n");
    
    // Open database (uses default location ~/.local/share/StreamGo/streamgo.db)
    println!("Opening database at default location");
    let db = Database::new()?;
    
    println!("Fetching builtin addons from remote manifests...\n");
    let addons = app_lib::api::get_builtin_addons().await?;
    
    println!("✓ Found {} builtin addons\n", addons.len());
    
    for addon in &addons {
        println!("📦 {}", addon.name);
        println!("   ID:       {}", addon.id);
        println!("   URL:      {}", addon.url);
        println!("   Version:  {}", addon.version);
        println!("   Priority: {}", addon.priority);
        println!("   Enabled:  {}", addon.enabled);
        
        // Save to database
        match db.save_addon(addon) {
            Ok(_) => println!("   ✓ Saved to database"),
            Err(e) => {
                println!("   ✗ Failed to save: {}", e);
                return Err(e.into());
            }
        }
        println!();
    }
    
    println!("=== Verification ===");
    let saved_addons = db.get_addons()?;
    println!("Database now contains {} addon(s)\n", saved_addons.len());
    
    for addon in saved_addons {
        let status = if addon.enabled { "ENABLED" } else { "disabled" };
        println!("  ✓ {} - {} [{}]", addon.name, addon.url, status);
    }
    
    println!("\n✅ Addon registration complete!");
    Ok(())
}
