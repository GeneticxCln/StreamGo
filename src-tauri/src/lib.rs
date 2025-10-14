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
pub use logging::{init_logging, log_shutdown, log_startup_info};
pub use migrations::{MigrationRunner, CURRENT_SCHEMA_VERSION};
pub use models::*;
pub use player::{ExternalPlayer, PlayerManager, SubtitleCue, SubtitleManager};

// Application state
pub struct AppState {
    pub db: Arc<Mutex<Database>>,
    pub cache: Arc<Mutex<CacheManager>>,
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
async fn search_content(query: String) -> Result<Vec<MediaItem>, String> {
    // This would integrate with external APIs like TMDB
    api::search_movies_and_shows(&query)
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
            tracing::warn!("No enabled addons available");
            return Ok(serde_json::json!({
                "items": [],
                "sources": [],
                "total_time_ms": 0
            }));
        }
        Ok(Err(e)) => {
            tracing::warn!(error = %e, "Failed to load addons");
            return Err(e);
        }
        Err(e) => {
            return Err(format!("Task error loading addons: {}", e));
        }
    };

    // Query catalogs via aggregator
    let aggregator = ContentAggregator::new();
    let result = aggregator
        .query_catalogs(&addons, &media_type, &catalog_id, &extra)
        .await;

    tracing::info!(
        item_count = result.items.len(),
        source_count = result.sources.len(),
        duration_ms = result.total_time_ms,
        "Catalog aggregation complete"
    );

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
            tracing::warn!("No enabled addons available; falling back to default stream");
            return Ok(FALLBACK_URL.to_string());
        }
        Ok(Err(e)) => {
            tracing::warn!(error = %e, "Failed to load addons; falling back to default stream");
            return Ok(FALLBACK_URL.to_string());
        }
        Err(e) => {
            tracing::warn!(error = %e, "Task error loading addons; falling back to default stream");
            return Ok(FALLBACK_URL.to_string());
        }
    };

    // 2) Query streams via aggregator (default media_type to 'movie' for backward compatibility)
    let aggregator = ContentAggregator::new();
    let result = aggregator
        .query_streams(&addons, "movie", &content_id)
        .await;

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
async fn get_media_details(content_id: String, media_type: MediaType) -> Result<MediaItem, String> {
    api::get_media_details(&content_id, &media_type)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
            export_user_data,
            get_log_directory_path,
            download_subtitle,
            convert_srt_to_vtt,
            parse_vtt_subtitle
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Error while running tauri application: {}", e);
            std::process::exit(1);
        });
}
