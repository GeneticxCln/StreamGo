use std::sync::Mutex;

mod database;
mod api;
mod models;

pub use database::*;
pub use api::*;
pub use models::*;

// Application state
pub struct AppState {
    pub db: Mutex<Database>,
}

// Tauri commands - these are exposed to the frontend
#[tauri::command]
async fn get_library_items(state: tauri::State<'_, AppState>) -> Result<Vec<MediaItem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_library_items().map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_to_library(
    item: MediaItem,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.add_to_library(item).map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_content(query: String) -> Result<Vec<MediaItem>, String> {
    // This would integrate with external APIs like TMDB
    api::search_movies_and_shows(&query).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_stream_url(content_id: String) -> Result<String, String> {
    // This would integrate with addon system to get streaming URLs
    api::get_streaming_url(&content_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn install_addon(addon_url: String) -> Result<String, String> {
    // Handle addon installation
    api::install_addon(&addon_url).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_addons() -> Result<Vec<Addon>, String> {
    // Get list of installed addons
    api::get_installed_addons().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_media_details(content_id: String) -> Result<MediaItem, String> {
    api::get_media_details(&content_id).await.map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database
    let database = Database::new().expect("Failed to initialize database");
    let app_state = AppState {
        db: Mutex::new(database),
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
                std::fs::create_dir_all(&streamgo_dir).unwrap();
                log::info!("App data directory: {:?}", streamgo_dir);
            }
            
            log::info!("StreamGo initialized successfully");
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_library_items,
            add_to_library,
            search_content,
            get_stream_url,
            install_addon,
            get_addons,
            get_media_details
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
