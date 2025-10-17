use app_lib::*;

#[tokio::test]
async fn verify_builtin_addons_have_urls() {
    let addons = api::get_builtin_addons().await.expect("Failed to get builtin addons");
    
    assert!(!addons.is_empty(), "Should have at least one builtin addon");
    
    for addon in &addons {
        eprintln!("Addon: {} | URL: {}", addon.name, addon.url);
        assert!(!addon.url.is_empty(), "Addon '{}' has empty URL", addon.name);
        assert!(addon.url.starts_with("http"), "Addon '{}' URL doesn't start with http", addon.name);
        assert_ne!(addon.url, "built-in", "Addon '{}' has placeholder URL", addon.name);
    }
    
    eprintln!("\n✓ All {} builtin addons have valid URLs\n", addons.len());
}
