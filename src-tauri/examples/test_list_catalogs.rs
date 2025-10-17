fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .init();

    println!("Opening database...");
    let db = app_lib::database::Database::new()?;
    println!("Database opened successfully");
    
    println!("\nGetting addons...");
    let addons = db.get_addons()?;
    println!("Found {} addons:", addons.len());
    for addon in &addons {
        println!("  - {} ({}): enabled={}", addon.name, addon.id, addon.enabled);
        println!("    Catalogs: {}", addon.manifest.catalogs.len());
        for cat in &addon.manifest.catalogs {
            println!("      * {} ({}) type={}", cat.name, cat.id, cat.catalog_type);
        }
    }
    
    println!("\nFiltering enabled addons with movie catalogs...");
    let enabled: Vec<_> = addons.into_iter().filter(|a| a.enabled).collect();
    println!("Enabled: {}", enabled.len());
    
    let mut movie_catalogs = Vec::new();
    for addon in &enabled {
        for cat in &addon.manifest.catalogs {
            if cat.catalog_type.to_lowercase() == "movie" {
                movie_catalogs.push((addon.name.clone(), cat.name.clone(), cat.id.clone()));
            }
        }
    }
    
    println!("\nMovie catalogs found: {}", movie_catalogs.len());
    for (addon, cat_name, cat_id) in &movie_catalogs {
        println!("  - {} / {} ({})", addon, cat_name, cat_id);
    }
    
    Ok(())
}
