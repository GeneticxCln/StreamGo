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
    #[serde(default = "default_theme")]
    pub theme: String,

    // Video Settings
    #[serde(default = "default_quality")]
    pub default_quality: String,
    #[serde(default = "default_codec")]
    pub video_codec: String,
    #[serde(default = "default_bitrate")]
    pub max_bitrate: String,
    #[serde(default = "default_true")]
    pub hardware_accel: bool,

    // Audio Settings
    #[serde(default = "default_codec")]
    pub audio_codec: String,
    #[serde(default = "default_codec")]
    pub audio_channels: String,
    #[serde(default)]
    pub volume_normalize: bool,

    // Playback
    #[serde(default = "default_true")]
    pub autoplay_next: bool,
    #[serde(default)]
    pub skip_intro: bool,
    #[serde(default = "default_true")]
    pub resume_playback: bool,

    // Subtitles
    #[serde(default)]
    pub subtitles_enabled: bool,
    #[serde(default = "default_subtitle_lang")]
    pub subtitle_language: String,
    #[serde(default = "default_medium")]
    pub subtitle_size: String,

    // Network & Streaming
    #[serde(default = "default_medium")]
    pub buffer_size: String,
    #[serde(default = "default_true")]
    pub preload_next: bool,
    #[serde(default = "default_torrent_connections")]
    pub torrent_connections: String,
    #[serde(default = "default_cache_size")]
    pub cache_size: String,

    // Advanced
    #[serde(default = "default_codec")]
    pub player_engine: String,
    #[serde(default)]
    pub debug_logging: bool,
    #[serde(default)]
    pub analytics: bool,
}

// Default value functions for serde
fn default_version() -> u32 {
    1
}
fn default_theme() -> String {
    "auto".to_string()
}
fn default_quality() -> String {
    "auto".to_string()
}
fn default_codec() -> String {
    "auto".to_string()
}
fn default_bitrate() -> String {
    "auto".to_string()
}
fn default_true() -> bool {
    true
}
fn default_subtitle_lang() -> String {
    "en".to_string()
}
fn default_medium() -> String {
    "medium".to_string()
}
fn default_torrent_connections() -> String {
    "100".to_string()
}
fn default_cache_size() -> String {
    "1024".to_string()
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            version: 1,
            theme: "auto".to_string(),
            default_quality: "auto".to_string(),
            video_codec: "auto".to_string(),
            max_bitrate: "auto".to_string(),
            hardware_accel: true,
            audio_codec: "auto".to_string(),
            audio_channels: "auto".to_string(),
            volume_normalize: false,
            autoplay_next: true,
            skip_intro: false,
            resume_playback: true,
            subtitles_enabled: false,
            subtitle_language: "en".to_string(),
            subtitle_size: "medium".to_string(),
            buffer_size: "medium".to_string(),
            preload_next: true,
            torrent_connections: "100".to_string(),
            cache_size: "1024".to_string(),
            player_engine: "auto".to_string(),
            debug_logging: false,
            analytics: false,
        }
    }
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
