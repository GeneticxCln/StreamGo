use std::sync::{Arc, Mutex};

mod api;
mod database;
mod models;

pub use database::*;
pub use models::*;

// Application state
pub struct AppState {
    pub db: Arc<Mutex<Database>>,
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
async fn get_stream_url(content_id: String) -> Result<String, String> {
    // This would integrate with addon system to get streaming URLs
    api::get_streaming_url(&content_id)
        .await
        .map_err(|e| e.to_string())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database
    let database = match Database::new() {
        Ok(db) => db,
        Err(e) => {
            eprintln!("Failed to initialize database: {}", e);
            eprintln!("The application cannot continue without a database.");
            eprintln!("Please ensure you have write permissions to your local app data directory.");
            std::process::exit(1);
        }
    };
    let app_state = AppState {
        db: Arc::new(Mutex::new(database)),
    };

    tauri::Builder::default()
        .manage(app_state)
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize application data directories
            if let Some(app_data_dir) = dirs::data_local_dir() {
                let streamgo_dir = app_data_dir.join("StreamGo");
                if let Err(e) = std::fs::create_dir_all(&streamgo_dir) {
                    log::error!("Failed to create app data directory: {}", e);
                } else {
                    log::info!("App data directory: {:?}", streamgo_dir);
                }
            }

            log::info!("StreamGo initialized successfully");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_library_items,
            add_to_library,
            search_content,
            search_library_advanced,
            get_stream_url,
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
            reorder_playlist
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Error while running tauri application: {}", e);
            std::process::exit(1);
        });
}
