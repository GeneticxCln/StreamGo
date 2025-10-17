use app_lib::aggregator::ContentAggregator;
use app_lib::api;
use app_lib::models::Addon;
use std::collections::HashMap;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .init();

    println!("Fetching built-in addons...");
    let addons = api::get_builtin_addons().await?;
    
    println!("Found {} addons:", addons.len());
    for addon in &addons {
        println!("  - {} ({}): enabled={}", addon.name, addon.id, addon.enabled);
        println!("    URL: {}", addon.url);
        println!("    Catalogs:");
        for catalog in &addon.manifest.catalogs {
            println!("      - {} ({}) type={}", catalog.name, catalog.id, catalog.catalog_type);
        }
    }

    let enabled: Vec<Addon> = addons.into_iter().filter(|a| a.enabled).collect();
    println!("\nEnabled addons: {}", enabled.len());

    if !enabled.is_empty() {
        println!("\nTesting catalog aggregation...");
        let aggregator = ContentAggregator::new();
        let extra: Option<HashMap<String, String>> = None;
        
        let result = aggregator
            .query_catalogs(&enabled, "movie", "top", &extra)
            .await;

        println!("\nResults:");
        println!("  Total items: {}", result.items.len());
        println!("  Sources: {}", result.sources.len());
        println!("  Duration: {}ms", result.total_time_ms);

        for source in &result.sources {
            println!("  - {} ({}): success={}, items={}, time={}ms",
                source.addon_name,
                source.addon_id,
                source.success,
                source.item_count,
                source.response_time_ms
            );
            if let Some(error) = &source.error {
                println!("    Error: {}", error);
            }
        }

        if !result.items.is_empty() {
            println!("\nFirst 3 items:");
            for item in result.items.iter().take(3) {
                println!("  - {} ({}) - {}", item.name, item.id, item.type_field);
            }
        }
    }

    Ok(())
}
