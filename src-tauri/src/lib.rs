use std::sync::{Arc, Mutex};

mod addon_protocol;
mod aggregator;
mod api;
mod cache;
mod database;
mod logging;
mod migrations;
mod models;
mod player;

// Re-export public items (avoid glob conflicts)
pub use addon_protocol::{AddonClient, AddonError, Stream, StreamBehaviorHints, Subtitle};
pub use aggregator::{AggregationResult, ContentAggregator, SourceHealth, StreamAggregationResult};
pub use cache::{CacheManager, CacheStats};
pub use database::Database;
pub use logging::{
    init_logging, log_shutdown, log_startup_info, DiagnosticsInfo, PerformanceMetrics,
};
pub use migrations::{MigrationRunner, CURRENT_SCHEMA_VERSION};
pub use models::*;
pub use player::{ExternalPlayer, PlayerManager, SubtitleCue, SubtitleManager};

use serde::Serialize;

// Application state
pub struct AppState {
    pub db: Arc<Mutex<Database>>,
    pub cache: Arc<Mutex<CacheManager>>,
}

#[derive(Debug, Clone, Serialize)]
struct CatalogInfo {
    addon_id: String,
    addon_name: String,
    id: String,
    name: String,
    media_type: String,
}

// Tauri commands - these are exposed to the frontend
#[tauri::command]
async fn get_library_items(state: tauri::State<'_, AppState>) -> Result<Vec<MediaItem>, String> {
    let db = state.inner().db.clone();
    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.get_library_items().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn add_to_library(item: MediaItem, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.clone();
    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.add_to_library(item).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn search_content(
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<MediaItem>, String> {
    // Load TMDB API key from user preferences if available, then call TMDB
    {
        let db = state.inner().db.clone();
        let _ = tokio::task::spawn_blocking(move || {
            let db = db.lock().map_err(|e| e.to_string())?;
            if let Ok(Some(profile)) = db.get_user_profile("default_user") {
                if let Some(key) = profile.preferences.tmdb_api_key {
                    if !key.is_empty() {
                        std::env::set_var("TMDB_API_KEY", key);
                    }
                }
            }
            Ok::<(), String>(())
        })
        .await;
    }

    let cache = state.inner().cache.clone();
    api::search_movies_and_shows_cached(&query, Some(cache))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_library_advanced(
    filters: crate::models::SearchFilters,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<MediaItem>, String> {
    let db = state.inner().db.clone();
    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.search_library_with_filters(&filters)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn list_catalogs(
    media_type: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<CatalogInfo>, String> {
    let db = state.inner().db.clone();

    // Load addons (initialize built-ins if DB is empty)
    let addons = tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        let mut addons = db.get_addons().map_err(|e| e.to_string())?;
        if addons.is_empty() {
            let builtin = tokio::runtime::Handle::current()
                .block_on(api::get_builtin_addons())
                .map_err(|e| e.to_string())?;
            for addon in &builtin {
                db.save_addon(addon).map_err(|e| e.to_string())?;
            }
            addons = builtin;
        }
        Ok::<Vec<Addon>, String>(addons)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    // Filter enabled and collect catalogs matching media_type
    let mt_lower = media_type.to_lowercase();
    let mut result: Vec<CatalogInfo> = Vec::new();
    for addon in addons.into_iter().filter(|a| a.enabled) {
        for c in addon.manifest.catalogs.iter() {
            if c.catalog_type.to_lowercase() == mt_lower {
                result.push(CatalogInfo {
                    addon_id: addon.id.clone(),
                    addon_name: addon.name.clone(),
                    id: c.id.clone(),
                    name: c.name.clone(),
                    media_type: c.catalog_type.clone(),
                });
            }
        }
    }

    // Optional: sort by addon priority and then by name
    // Not strictly necessary; keep natural order for now

    if result.is_empty() {
        tracing::warn!("No catalogs available for media type: {}", media_type);
    }

    Ok(result)
}

#[tauri::command]
async fn aggregate_catalogs(
    media_type: String,
    catalog_id: String,
    extra: Option<std::collections::HashMap<String, String>>,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    // Load enabled addons from the database
    let db = state.inner().db.clone();
    let addons_res = tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        let mut addons = db.get_addons().map_err(|e| e.to_string())?;

        if addons.is_empty() {
            tracing::info!("No addons found in DB, initializing with built-in addons");
            let builtin = tokio::runtime::Handle::current()
                .block_on(api::get_builtin_addons())
                .map_err(|e| e.to_string())?;
            for addon in &builtin {
                db.save_addon(addon).map_err(|e| e.to_string())?;
            }
            addons = builtin;
        }

        // Filter enabled addons
        let enabled: Vec<Addon> = addons.into_iter().filter(|a| a.enabled).collect();
        Ok::<Vec<Addon>, String>(enabled)
    })
    .await;

    let addons = match addons_res {
        Ok(Ok(v)) if !v.is_empty() => v,
        Ok(Ok(_)) => {
            tracing::error!("No enabled addons available for catalog browsing");
            return Err("No working addons available. Please install addons from the Add-ons section.".to_string());
        }
        Ok(Err(e)) => {
            tracing::error!(error = %e, "Failed to load addons for catalogs");
            return Err(format!("Failed to load addons: {}", e));
        }
        Err(e) => {
            tracing::error!(error = %e, "Critical error loading addons for catalogs");
            return Err(format!("Critical error loading addons: {}", e));
        }
    };

    // Query catalogs via aggregator with cache
    let cache = state.inner().cache.clone();
    let aggregator = ContentAggregator::with_cache(cache);
    let result = aggregator
        .query_catalogs(&addons, &media_type, &catalog_id, &extra)
        .await;

    tracing::info!(
        item_count = result.items.len(),
        source_count = result.sources.len(),
        duration_ms = result.total_time_ms,
        "Catalog aggregation complete"
    );

    // Record health metrics for each addon
    let db_for_health = state.inner().db.clone();
    let sources_clone = result.sources.clone();
    tokio::task::spawn_blocking(move || {
        if let Ok(db) = db_for_health.lock() {
            for source in sources_clone {
                let error_msg = source.error.as_deref();
                let _ = db.record_addon_health(
                    &source.addon_id,
                    source.response_time_ms,
                    source.success,
                    error_msg,
                    source.item_count,
                    "catalog",
                );
            }
        }
    });

    // Convert to JSON for frontend
    Ok(serde_json::json!({
        "items": result.items,
        "sources": result.sources,
        "total_time_ms": result.total_time_ms
    }))
}

#[tauri::command]
async fn get_stream_url(
    content_id: String,
    media_type: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    // Integrate with addon aggregator; fall back to demo URL on failure
    const FALLBACK_URL: &str =
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

    // 1) Load enabled addons from the database (initialize built-ins if DB is empty)
    let db = state.inner().db.clone();
    let addons_res = tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        let mut addons = db.get_addons().map_err(|e| e.to_string())?;

        if addons.is_empty() {
            log::info!("No addons found in DB, initializing with built-in addons");
            let builtin = tokio::runtime::Handle::current()
                .block_on(api::get_builtin_addons())
                .map_err(|e| e.to_string())?;
            for addon in &builtin {
                db.save_addon(addon).map_err(|e| e.to_string())?;
            }
            addons = builtin;
        }

        // Filter enabled addons
        let enabled: Vec<Addon> = addons.into_iter().filter(|a| a.enabled).collect();
        Ok::<Vec<Addon>, String>(enabled)
    })
    .await;

    let addons = match addons_res {
        Ok(Ok(v)) if !v.is_empty() => v,
        Ok(Ok(_)) => {
            tracing::error!("No enabled addons available - StreamGo cannot provide content without working addons");
            return Err("No working addons available. Please install addons from the Add-ons section.".to_string());
        }
        Ok(Err(e)) => {
            tracing::error!(error = %e, "Failed to load addons from database");
            return Err(format!("Failed to load addons: {}. Please check addon installation.", e));
        }
        Err(e) => {
            tracing::error!(error = %e, "Critical error loading addons");
            return Err(format!("Critical error loading addons: {}. Please restart the application.", e));
        }
    };

    // 2) Query streams via aggregator with cache (default media_type to 'movie' for backward compatibility)
    let cache = state.inner().cache.clone();
    let aggregator = ContentAggregator::with_cache(cache);
    let media_type_effective = media_type.unwrap_or_else(|| "movie".to_string());
    let result = aggregator
        .query_streams(&addons, &media_type_effective, &content_id)
        .await;

    // Record health metrics for each addon
    let db_for_health = state.inner().db.clone();
    let sources_clone = result.sources.clone();
    tokio::task::spawn_blocking(move || {
        if let Ok(db) = db_for_health.lock() {
            for source in sources_clone {
                let error_msg = source.error.as_deref();
                let _ = db.record_addon_health(
                    &source.addon_id,
                    source.response_time_ms,
                    source.success,
                    error_msg,
                    source.item_count,
                    "stream",
                );
            }
        }
    });

    if let Some(url) = select_best_stream(&result.streams) {
        tracing::info!(
            stream_count = result.streams.len(),
            duration_ms = result.total_time_ms,
            "Selected best stream via aggregator"
        );
        return Ok(url);
    }

    tracing::warn!(
        stream_count = result.streams.len(),
        "No valid streams from aggregator; using fallback URL"
    );
    Ok(FALLBACK_URL.to_string())
}

#[tauri::command]
async fn get_streams(
    content_id: String,
    media_type: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Stream>, String> {
    // Load enabled addons (initialize built-ins if needed)
    let db = state.inner().db.clone();
    let addons_res = tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        let mut addons = db.get_addons().map_err(|e| e.to_string())?;
        if addons.is_empty() {
            let builtin = tokio::runtime::Handle::current()
                .block_on(api::get_builtin_addons())
                .map_err(|e| e.to_string())?;
            for addon in &builtin {
                db.save_addon(addon).map_err(|e| e.to_string())?;
            }
            addons = builtin;
        }
        let enabled: Vec<Addon> = addons.into_iter().filter(|a| a.enabled).collect();
        Ok::<Vec<Addon>, String>(enabled)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    let addons = match addons_res {
        Ok(v) if !v.is_empty() => v,
        Ok(_) => {
            tracing::warn!("No enabled addons available for subtitles");
            return Err("No working addons available. Please install addons from the Add-ons section.".to_string());
        }
        Err(e) => return Err(format!("Failed to load addons: {}", e)),
    };

    let cache = state.inner().cache.clone();
    let aggregator = ContentAggregator::with_cache(cache);
    let media_type_effective = media_type.unwrap_or_else(|| "movie".to_string());
    let result = aggregator
        .query_streams(&addons, &media_type_effective, &content_id)
        .await;

    // Record health metrics
    let db_for_health = state.inner().db.clone();
    let sources_clone = result.sources.clone();
    tokio::task::spawn_blocking(move || {
        if let Ok(db) = db_for_health.lock() {
            for source in sources_clone {
                let error_msg = source.error.as_deref();
                let _ = db.record_addon_health(
                    &source.addon_id,
                    source.response_time_ms,
                    source.success,
                    error_msg,
                    source.item_count,
                    "stream",
                );
            }
        }
    });

    Ok(result.streams)
}

#[tauri::command]
async fn get_subtitles(
    content_id: String,
    media_type: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Subtitle>, String> {
    // Load enabled addons
    let db = state.inner().db.clone();
    let addons_res = tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        let mut addons = db.get_addons().map_err(|e| e.to_string())?;
        if addons.is_empty() {
            let builtin = tokio::runtime::Handle::current()
                .block_on(api::get_builtin_addons())
                .map_err(|e| e.to_string())?;
            for addon in &builtin {
                db.save_addon(addon).map_err(|e| e.to_string())?;
            }
            addons = builtin;
        }
        let enabled: Vec<Addon> = addons.into_iter().filter(|a| a.enabled).collect();
        Ok::<Vec<Addon>, String>(enabled)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    let addons = match addons_res {
        Ok(v) if !v.is_empty() => v,
        Ok(_) => {
            tracing::warn!("No enabled addons available for streams");
            return Err("No working addons available. Please install addons from the Add-ons section.".to_string());
        }
        Err(e) => return Err(format!("Failed to load addons: {}", e)),
    };

    let media_type_effective = media_type.unwrap_or_else(|| "movie".to_string());
    let mut subs: Vec<Subtitle> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    for addon in addons {
        let base = if addon.url.ends_with("/manifest.json") {
            addon.url.replace("/manifest.json", "")
        } else if addon.url.ends_with("manifest.json") {
            addon.url.replace("manifest.json", "")
        } else {
            addon.url.clone()
        };
        let start = std::time::Instant::now();
        let mut success = false;
        let mut err_msg: Option<String> = None;
        let mut item_count: usize = 0;

        match AddonClient::new(base) {
            Ok(client) => match client
                .get_subtitles(&media_type_effective, &content_id)
                .await
            {
                Ok(response) => {
                    for s in response.subtitles.into_iter() {
                        if seen.insert(s.url.clone()) {
                            subs.push(s);
                            item_count += 1;
                        }
                    }
                    success = item_count > 0;
                }
                Err(e) => {
                    err_msg = Some(e.to_string());
                }
            },
            Err(e) => {
                err_msg = Some(e.to_string());
            }
        }

        let elapsed = start.elapsed().as_millis();
        let addon_id = addon.id.clone();
        let db_for_health = state.inner().db.clone();
        let err_msg_clone = err_msg.clone();
        tokio::task::spawn_blocking(move || {
            if let Ok(db) = db_for_health.lock() {
                let _ = db.record_addon_health(
                    &addon_id,
                    elapsed,
                    success,
                    err_msg_clone.as_deref(),
                    item_count,
                    "subtitles",
                );
            }
        });
    }

    Ok(subs)
}

#[tauri::command]
async fn get_addon_meta(
    content_id: String,
    media_type: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    // Load enabled addons
    let db = state.inner().db.clone();
    let addons_res = tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        let mut addons = db.get_addons().map_err(|e| e.to_string())?;
        if addons.is_empty() {
            let builtin = tokio::runtime::Handle::current()
                .block_on(api::get_builtin_addons())
                .map_err(|e| e.to_string())?;
            for addon in &builtin {
                db.save_addon(addon).map_err(|e| e.to_string())?;
            }
            addons = builtin;
        }
        // Filter enabled addons that provide "meta" resource
        let enabled: Vec<Addon> = addons
            .into_iter()
            .filter(|a| {
                a.enabled && a.manifest.resources.iter().any(|r| r == "meta")
            })
            .collect();
        Ok::<Vec<Addon>, String>(enabled)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    let addons = match addons_res {
        Ok(v) if !v.is_empty() => v,
        Ok(_) => {
            tracing::warn!("No enabled addons with meta resource available");
            return Err("No addons with metadata support available. Please install metadata addons like Cinemeta.".to_string());
        }
        Err(e) => return Err(format!("Failed to load addons: {}", e)),
    };

    let media_type_effective = media_type.unwrap_or_else(|| "movie".to_string());
    let mut aggregated_meta: Option<serde_json::Value> = None;

    // Query each addon for meta and merge results (first successful wins)
    for addon in addons {
        let base = if addon.url.ends_with("/manifest.json") {
            addon.url.replace("/manifest.json", "")
        } else if addon.url.ends_with("manifest.json") {
            addon.url.replace("manifest.json", "")
        } else {
            addon.url.clone()
        };

        let start = std::time::Instant::now();
        let mut success = false;
        let mut err_msg: Option<String> = None;

        match AddonClient::new(base) {
            Ok(client) => match client.get_meta(&media_type_effective, &content_id).await {
                Ok(response) => {
                    // Convert to JSON and use first successful response
                    if let Ok(json) = serde_json::to_value(&response.meta) {
                        aggregated_meta = Some(json);
                        success = true;
                        
                        // Record health and return immediately on success
                        let elapsed = start.elapsed().as_millis();
                        let addon_id = addon.id.clone();
                        let db_for_health = state.inner().db.clone();
                        tokio::task::spawn_blocking(move || {
                            if let Ok(db) = db_for_health.lock() {
                                let _ = db.record_addon_health(
                                    &addon_id,
                                    elapsed,
                                    true,
                                    None,
                                    1,
                                    "meta",
                                );
                            }
                        });
                        
                        break; // Stop at first successful meta response
                    }
                }
                Err(e) => {
                    err_msg = Some(e.to_string());
                }
            },
            Err(e) => {
                err_msg = Some(e.to_string());
            }
        }

        // Record health for failed attempts
        if !success {
            let elapsed = start.elapsed().as_millis();
            let addon_id = addon.id.clone();
            let db_for_health = state.inner().db.clone();
            let err_msg_clone = err_msg.clone();
            tokio::task::spawn_blocking(move || {
                if let Ok(db) = db_for_health.lock() {
                    let _ = db.record_addon_health(
                        &addon_id,
                        elapsed,
                        false,
                        err_msg_clone.as_deref(),
                        0,
                        "meta",
                    );
                }
            });
        }
    }

    aggregated_meta.ok_or_else(|| "No metadata found from any addon".to_string())
}

fn select_best_stream(streams: &[crate::addon_protocol::Stream]) -> Option<String> {
    let mut best_score = i32::MIN;
    let mut best_url: Option<String> = None;

    for s in streams {
        let mut score = 0;

        // Prefer secure protocol
        if s.url.starts_with("https://") {
            score += 5;
        }

        // Prefer HLS streams
        if s.url.to_lowercase().contains(".m3u8") {
            score += 100;
        }

        // Quality parsing from name/title/description
        let mut q = 0;
        if let Some(name) = &s.name {
            q = q.max(parse_quality_hint(name));
        }
        if let Some(title) = &s.title {
            q = q.max(parse_quality_hint(title));
        }
        if let Some(desc) = &s.description {
            q = q.max(parse_quality_hint(desc));
        }

        // Weight higher quality
        score += match q {
            2160 => 50,
            1440 => 40,
            1080 => 30,
            720 => 20,
            480 => 10,
            360 => 5,
            _ => 0,
        };

        // Penalize not web ready
        if s.behaviorHints.notWebReady {
            score -= 25;
        }

        if score > best_score {
            best_score = score;
            best_url = Some(s.url.clone());
        }
    }

    best_url
}

fn parse_quality_hint(s: &str) -> i32 {
    let l = s.to_lowercase();
    if l.contains("2160p") || l.contains("4k") {
        return 2160;
    }
    if l.contains("1440p") {
        return 1440;
    }
    if l.contains("1080p") || l.contains("full hd") {
        return 1080;
    }
    if l.contains("720p") || l.contains(" hd") {
        return 720;
    }
    if l.contains("480p") {
        return 480;
    }
    if l.contains("360p") {
        return 360;
    }
    0
}

#[tauri::command]
async fn install_addon(
    addon_url: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    // Download and validate addon
    let addon = api::install_addon(&addon_url)
        .await
        .map_err(|e| e.to_string())?;

    let addon_id = addon.id.clone();
    let db = state.inner().db.clone();

    // Save to database
    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.save_addon(&addon).map_err(|e| e.to_string())?;
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(addon_id)
}

#[tauri::command]
async fn get_addons(state: tauri::State<'_, AppState>) -> Result<Vec<Addon>, String> {
    let db = state.inner().db.clone();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        let mut addons = db.get_addons().map_err(|e| e.to_string())?;

        // If no addons in DB, initialize with built-in ones
        if addons.is_empty() {
            log::info!("No addons found in DB, initializing with built-in addons");
            let builtin = tokio::runtime::Handle::current()
                .block_on(api::get_builtin_addons())
                .map_err(|e| e.to_string())?;

            for addon in &builtin {
                db.save_addon(addon).map_err(|e| e.to_string())?;
            }
            addons = builtin;
        }

        Ok(addons)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn enable_addon(addon_id: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.clone();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        let addons = db.get_addons().map_err(|e| e.to_string())?;

        let mut addon = addons
            .into_iter()
            .find(|a| a.id == addon_id)
            .ok_or_else(|| format!("Addon not found: {}", addon_id))?;

        addon.enabled = true;
        db.save_addon(&addon).map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn disable_addon(addon_id: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.clone();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        let addons = db.get_addons().map_err(|e| e.to_string())?;

        let mut addon = addons
            .into_iter()
            .find(|a| a.id == addon_id)
            .ok_or_else(|| format!("Addon not found: {}", addon_id))?;

        addon.enabled = false;
        db.save_addon(&addon).map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn uninstall_addon(
    addon_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.inner().db.clone();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.delete_addon(&addon_id).map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn get_media_details(
    content_id: String,
    media_type: MediaType,
    state: tauri::State<'_, AppState>,
) -> Result<MediaItem, String> {
    let cache = state.inner().cache.clone();
    api::get_media_details_cached(&content_id, &media_type, Some(cache))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_settings(state: tauri::State<'_, AppState>) -> Result<UserPreferences, String> {
    let db = state.inner().db.clone();
    let user_id = "default_user".to_string();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;

        match db.get_user_profile(&user_id).map_err(|e| e.to_string())? {
            Some(profile) => Ok(profile.preferences),
            None => {
                // Create default user profile
                let default_profile = UserProfile {
                    id: user_id.clone(),
                    username: "User".to_string(),
                    email: None,
                    preferences: UserPreferences::default(),
                    library_items: Vec::new(),
                    watchlist: Vec::new(),
                    favorites: Vec::new(),
                };
                db.save_user_profile(&default_profile)
                    .map_err(|e| e.to_string())?;
                Ok(default_profile.preferences)
            }
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn save_settings(
    settings: UserPreferences,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.inner().db.clone();
    let user_id = "default_user".to_string();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;

        let mut profile = match db.get_user_profile(&user_id).map_err(|e| e.to_string())? {
            Some(p) => p,
            None => UserProfile {
                id: user_id.clone(),
                username: "User".to_string(),
                email: None,
                preferences: settings.clone(),
                library_items: Vec::new(),
                watchlist: Vec::new(),
                favorites: Vec::new(),
            },
        };

        profile.preferences = settings;
        db.save_user_profile(&profile).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// Watchlist commands
#[tauri::command]
async fn add_to_watchlist(
    media_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.inner().db.clone();
    let user_id = "default_user".to_string();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.add_to_watchlist(&user_id, &media_id)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn remove_from_watchlist(
    media_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.inner().db.clone();
    let user_id = "default_user".to_string();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.remove_from_watchlist(&user_id, &media_id)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn get_watchlist(state: tauri::State<'_, AppState>) -> Result<Vec<MediaItem>, String> {
    let db = state.inner().db.clone();
    let user_id = "default_user".to_string();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.get_watchlist(&user_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// Favorites commands
#[tauri::command]
async fn add_to_favorites(
    media_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.inner().db.clone();
    let user_id = "default_user".to_string();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.add_to_favorites(&user_id, &media_id)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn remove_from_favorites(
    media_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.inner().db.clone();
    let user_id = "default_user".to_string();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.remove_from_favorites(&user_id, &media_id)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn get_favorites(state: tauri::State<'_, AppState>) -> Result<Vec<MediaItem>, String> {
    let db = state.inner().db.clone();
    let user_id = "default_user".to_string();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.get_favorites(&user_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// Watch progress commands
#[tauri::command]
async fn update_watch_progress(
    media_id: String,
    progress: i32,
    watched: bool,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.inner().db.clone();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.update_watch_progress(&media_id, progress, watched)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn get_continue_watching(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<MediaItem>, String> {
    let db = state.inner().db.clone();
    let user_id = "default_user".to_string();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.get_continue_watching(&user_id)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// Playlist commands
#[tauri::command]
async fn create_playlist(
    name: String,
    description: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let db = state.inner().db.clone();
    let user_id = "default_user".to_string();
    let playlist_id = uuid::Uuid::new_v4().to_string();
    let playlist_id_clone = playlist_id.clone();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.create_playlist(&playlist_id_clone, &name, description.as_deref(), &user_id)
            .map_err(|e| e.to_string())?;
        Ok(playlist_id_clone)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn get_playlists(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<crate::models::Playlist>, String> {
    let db = state.inner().db.clone();
    let user_id = "default_user".to_string();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.get_playlists(&user_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn get_playlist(
    playlist_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<crate::models::Playlist>, String> {
    let db = state.inner().db.clone();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.get_playlist(&playlist_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn update_playlist(
    playlist_id: String,
    name: String,
    description: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.inner().db.clone();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.update_playlist(&playlist_id, &name, description.as_deref())
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn delete_playlist(
    playlist_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.inner().db.clone();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.delete_playlist(&playlist_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn add_to_playlist(
    playlist_id: String,
    media_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.inner().db.clone();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.add_item_to_playlist(&playlist_id, &media_id)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn remove_from_playlist(
    playlist_id: String,
    media_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.inner().db.clone();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.remove_item_from_playlist(&playlist_id, &media_id)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn get_playlist_items(
    playlist_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<MediaItem>, String> {
    let db = state.inner().db.clone();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.get_playlist_items(&playlist_id)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn reorder_playlist(
    playlist_id: String,
    media_ids: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.inner().db.clone();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.reorder_playlist_items(&playlist_id, media_ids)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// Cache commands
#[tauri::command]
async fn get_cache_stats(state: tauri::State<'_, AppState>) -> Result<CacheStats, String> {
    let cache = state.inner().cache.clone();
    tokio::task::spawn_blocking(move || {
        let cache = cache.lock().map_err(|e| e.to_string())?;
        cache.get_stats().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn clear_cache(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let cache = state.inner().cache.clone();
    tokio::task::spawn_blocking(move || {
        let cache = cache.lock().map_err(|e| e.to_string())?;
        cache.clear_all().map_err(|e| e.to_string())?;
        Ok("Cache cleared successfully".to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn clear_expired_cache(state: tauri::State<'_, AppState>) -> Result<usize, String> {
    let cache = state.inner().cache.clone();
    tokio::task::spawn_blocking(move || {
        let cache = cache.lock().map_err(|e| e.to_string())?;
        cache.clear_expired().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// Data export command
#[tauri::command]
async fn export_user_data(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let db = state.inner().db.clone();
    let user_id = "default_user".to_string();

    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;

        let profile = db
            .get_user_profile(&user_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "User profile not found".to_string())?;

        let playlists = db.get_playlists(&user_id).map_err(|e| e.to_string())?;
        let mut playlists_with_items = Vec::new();
        for p in playlists {
            let items = db.get_playlist_items(&p.id).map_err(|e| e.to_string())?;
            playlists_with_items.push(PlaylistWithItems { playlist: p, items });
        }

        let library = db.get_library_items().map_err(|e| e.to_string())?;
        let watchlist = db.get_watchlist(&user_id).map_err(|e| e.to_string())?;
        let favorites = db.get_favorites(&user_id).map_err(|e| e.to_string())?;
        let continue_watching = db
            .get_continue_watching(&user_id)
            .map_err(|e| e.to_string())?;

        let export_data = UserExportData {
            profile,
            playlists: playlists_with_items,
            library,
            watchlist,
            favorites,
            continue_watching,
        };

        serde_json::to_string_pretty(&export_data).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// Log viewer command
#[tauri::command]
async fn get_log_directory_path() -> Result<String, String> {
    dirs::data_local_dir()
        .ok_or_else(|| "Could not determine local data directory".to_string())
        .map(|dir| {
            dir.join("StreamGo")
                .join("logs")
                .to_string_lossy()
                .to_string()
        })
}

// Player commands
#[tauri::command]
async fn get_available_players() -> Result<Vec<ExternalPlayer>, String> {
    Ok(PlayerManager::get_available_players())
}

#[tauri::command]
async fn launch_external_player(
    player: ExternalPlayer,
    url: String,
    subtitle: Option<String>,
) -> Result<(), String> {
    player
        .launch(&url, subtitle.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn download_subtitle(url: String) -> Result<String, String> {
    SubtitleManager::download_subtitle(&url)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn convert_srt_to_vtt(srt_content: String) -> Result<String, String> {
    SubtitleManager::srt_to_vtt(&srt_content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn parse_vtt_subtitle(vtt_content: String) -> Result<Vec<SubtitleCue>, String> {
    SubtitleManager::parse_vtt(&vtt_content).map_err(|e| e.to_string())
}

// Diagnostics and metrics commands
#[tauri::command]
async fn get_performance_metrics() -> Result<logging::PerformanceMetrics, String> {
    Ok(logging::get_metrics())
}

#[tauri::command]
async fn export_diagnostics() -> Result<logging::DiagnosticsInfo, String> {
    logging::export_diagnostics().map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_diagnostics_file() -> Result<String, String> {
    let output_path = dirs::data_local_dir()
        .ok_or_else(|| "Could not find data directory".to_string())?
        .join("StreamGo")
        .join(format!(
            "diagnostics-{}.json",
            chrono::Utc::now().timestamp()
        ));

    logging::export_diagnostics_to_file(&output_path).map_err(|e| e.to_string())?;

    Ok(output_path.display().to_string())
}

#[tauri::command]
async fn reset_performance_metrics() -> Result<(), String> {
    logging::reset_metrics();
    Ok(())
}

#[tauri::command]
async fn get_addon_health_summaries(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<AddonHealthSummary>, String> {
    let db = state.inner().db.clone();
    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.get_all_addon_health_summaries()
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn get_addon_health(
    addon_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<AddonHealthSummary>, String> {
    let db = state.inner().db.clone();
    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.get_addon_health_summary(&addon_id)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn auto_disable_unhealthy_addons(
    threshold: f64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let db = state.inner().db.clone();
    
    tokio::task::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        
        // Get health summaries
        let health_summaries = db.get_all_addon_health_summaries()
            .map_err(|e| e.to_string())?;
        
        // Get all addons
        let addons = db.get_addons()
            .map_err(|e| e.to_string())?;
        
        let mut disabled_addons = Vec::new();
        
        // Disable addons below threshold that are currently enabled
        for addon in addons {
            if !addon.enabled {
                continue; // Already disabled
            }
            
            // Find health score for this addon
            if let Some(health) = health_summaries.iter().find(|h| h.addon_id == addon.id) {
                if health.health_score < threshold {
                    tracing::info!(
                        addon_id = %addon.id,
                        health_score = %health.health_score,
                        threshold = %threshold,
                        "Auto-disabling unhealthy addon"
                    );
                    
                    // Disable the addon
                    let mut disabled_addon = addon.clone();
                    disabled_addon.enabled = false;
                    db.save_addon(&disabled_addon)
                        .map_err(|e| e.to_string())?;
                    
                    disabled_addons.push(addon.id);
                }
            }
        }
        
        tracing::info!("Auto-disabled {} addons below health threshold {}", disabled_addons.len(), threshold);
        Ok(disabled_addons)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Fix webkit2gtk 2.50.x explicit sync bug with Wayland compositors
    // See: https://bugs.webkit.org/show_bug.cgi?id=283064
    #[cfg(target_os = "linux")]
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

    // Initialize logging system first
    if let Some(app_data_dir) = dirs::data_local_dir() {
        let log_dir = app_data_dir.join("StreamGo").join("logs");
        if let Err(e) = logging::init_logging(log_dir) {
            eprintln!("Failed to initialize logging: {}", e);
        }
    }

    logging::log_startup_info();

    // Initialize database
    let database = match Database::new() {
        Ok(db) => {
            tracing::info!("Database initialized successfully");
            db
        }
        Err(e) => {
            tracing::error!(error = %e, "Failed to initialize database");
            eprintln!("Failed to initialize database: {}", e);
            eprintln!("The application cannot continue without a database.");
            eprintln!("Please ensure you have write permissions to your local app data directory.");
            std::process::exit(1);
        }
    };

    // Initialize cache
    let cache_path = dirs::data_local_dir()
        .map(|dir| dir.join("StreamGo").join("cache.db"))
        .and_then(|path| path.to_str().map(|s| s.to_string()));

    let cache = match CacheManager::new(cache_path.as_deref()) {
        Ok(cache) => {
            tracing::info!("Cache initialized successfully");
            cache
        }
        Err(e) => {
            tracing::warn!(error = %e, "Failed to initialize cache, using in-memory cache");
            match CacheManager::new(None) {
                Ok(cache) => cache,
                Err(e) => {
                    tracing::error!(error = %e, "Critical: Failed to create in-memory cache");
                    eprintln!("Fatal error: Could not create cache system: {}", e);
                    std::process::exit(1);
                }
            }
        }
    };

    let app_state = AppState {
        db: Arc::new(Mutex::new(database)),
        cache: Arc::new(Mutex::new(cache)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(app_state)
        .setup(|_app| {
            // Initialize application data directories
            if let Some(app_data_dir) = dirs::data_local_dir() {
                let streamgo_dir = app_data_dir.join("StreamGo");
                if let Err(e) = std::fs::create_dir_all(&streamgo_dir) {
                    tracing::error!(error = %e, "Failed to create app data directory");
                } else {
                    tracing::info!(directory = ?streamgo_dir, "App data directory initialized");
                }
            }

            tracing::info!("StreamGo setup completed successfully");

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                logging::log_shutdown();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_library_items,
            add_to_library,
            search_content,
            search_library_advanced,
            get_stream_url,
            get_streams,
            get_subtitles,
            get_addon_meta,
            list_catalogs,
            aggregate_catalogs,
            install_addon,
            get_addons,
            enable_addon,
            disable_addon,
            uninstall_addon,
            get_media_details,
            get_settings,
            save_settings,
            add_to_watchlist,
            remove_from_watchlist,
            get_watchlist,
            add_to_favorites,
            remove_from_favorites,
            get_favorites,
            update_watch_progress,
            get_continue_watching,
            create_playlist,
            get_playlists,
            get_playlist,
            update_playlist,
            delete_playlist,
            add_to_playlist,
            remove_from_playlist,
            get_playlist_items,
            reorder_playlist,
            get_cache_stats,
            clear_cache,
            clear_expired_cache,
            get_available_players,
            launch_external_player,
            export_user_data,
            get_log_directory_path,
            download_subtitle,
            convert_srt_to_vtt,
            parse_vtt_subtitle,
            get_performance_metrics,
            export_diagnostics,
            export_diagnostics_file,
            reset_performance_metrics,
            get_addon_health_summaries,
            get_addon_health,
            auto_disable_unhealthy_addons
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Error while running tauri application: {}", e);
            std::process::exit(1);
        });
}
