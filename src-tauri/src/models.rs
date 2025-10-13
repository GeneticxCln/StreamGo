use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaItem {
    pub id: String,
    pub title: String,
    pub media_type: MediaType,
    pub year: Option<i32>,
    pub genre: Vec<String>,
    pub description: Option<String>,
    pub poster_url: Option<String>,
    pub backdrop_url: Option<String>,
    pub rating: Option<f32>,
    pub duration: Option<i32>, // in minutes
    pub added_to_library: Option<chrono::DateTime<chrono::Utc>>,
    pub watched: bool,
    pub progress: Option<i32>, // in seconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MediaType {
    Movie,
    TvShow,
    Episode,
    Documentary,
    LiveTv,
    Podcast,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamSource {
    pub url: String,
    pub quality: String,
    pub format: String,
    pub addon_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Addon {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub url: String,
    pub enabled: bool,
    pub addon_type: AddonType,
    pub manifest: AddonManifest,
    #[serde(default = "default_priority")]
    pub priority: i32, // Higher number = higher priority
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AddonType {
    ContentProvider,
    MetadataProvider,
    Subtitles,
    Player,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddonManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub resources: Vec<String>,
    pub types: Vec<String>,
    pub catalogs: Vec<Catalog>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Catalog {
    pub catalog_type: String,
    pub id: String,
    pub name: String,
    pub genres: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: String,
    pub username: String,
    pub email: Option<String>,
    pub preferences: UserPreferences,
    pub library_items: Vec<String>, // MediaItem IDs
    pub watchlist: Vec<String>,     // MediaItem IDs
    pub favorites: Vec<String>,     // MediaItem IDs
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    #[serde(default = "default_version")]
    pub version: u32,

    // Appearance
    pub theme: String,
    #[serde(default = "default_language")]
    pub language: String,

    // Video Settings
    pub quality: String,

    // Playback
    #[serde(default = "default_true")]
    pub autoplay: bool,
    #[serde(default = "default_playback_speed")]
    pub playback_speed: f32,
    #[serde(default = "default_volume")]
    pub volume: f32,

    // Subtitles
    #[serde(default = "default_subtitle_lang")]
    pub subtitle_language: String,

    // General
    #[serde(default = "default_true")]
    pub notifications_enabled: bool,
    #[serde(default = "default_true")]
    pub auto_update: bool,

    // Advanced
    #[serde(default)]
    pub telemetry_enabled: bool,
}

// Default value functions for serde
fn default_version() -> u32 {
    1
}
fn default_true() -> bool {
    true
}
fn default_subtitle_lang() -> String {
    "en".to_string()
}
fn default_language() -> String {
    "en".to_string()
}
fn default_playback_speed() -> f32 {
    1.0
}
fn default_volume() -> f32 {
    0.8
}
fn default_priority() -> i32 {
    0
}

impl Default for UserPreferences {
    fn default() -> Self {
        // These defaults should match the frontend's `getDefaultSettings`
        Self {
            version: 1,
            theme: "dark".to_string(),
            language: "en".to_string(),
            autoplay: true,
            quality: "auto".to_string(),
            subtitle_language: "en".to_string(),
            playback_speed: 1.0,
            volume: 0.8,
            notifications_enabled: true,
            auto_update: true,
            telemetry_enabled: false,
        }
    }
}

/// A struct to hold all user data for export.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserExportData {
    pub profile: UserProfile,
    pub playlists: Vec<PlaylistWithItems>,
    pub library: Vec<MediaItem>,
    pub watchlist: Vec<MediaItem>,
    pub favorites: Vec<MediaItem>,
    pub continue_watching: Vec<MediaItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub user_id: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub item_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistItem {
    pub playlist_id: String,
    pub media_id: String,
    pub position: i32,
    pub added_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistWithItems {
    pub playlist: Playlist,
    pub items: Vec<MediaItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SearchFilters {
    pub query: Option<String>,
    pub genres: Vec<String>,
    pub media_types: Vec<MediaType>,
    pub year_min: Option<i32>,
    pub year_max: Option<i32>,
    pub rating_min: Option<f32>,
    pub watched: Option<bool>,
    pub sort_by: Option<String>, // "title_asc", "title_desc", "year_asc", "year_desc", "rating_desc", "added_desc"
}
