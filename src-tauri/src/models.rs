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
    pub resources: Vec<String>, // Stored as strings for database compatibility
    pub types: Vec<String>,     // Stored as strings for database compatibility
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
    #[serde(default = "default_language")]
    pub language: String,

    // Integrations / API keys
    #[serde(default)]
    pub tmdb_api_key: Option<String>,

    // Video Settings
    #[serde(default = "default_quality")]
    pub quality: String,
    #[serde(default = "default_quality")]
    pub default_quality: String,
    #[serde(default = "default_video_codec")]
    pub video_codec: String,
    #[serde(default = "default_max_bitrate")]
    pub max_bitrate: String,
    #[serde(default = "default_bool_false")]
    pub hardware_accel: bool,

    // Audio
    #[serde(default = "default_audio_codec")]
    pub audio_codec: String,
    #[serde(default = "default_audio_channels")]
    pub audio_channels: String,
    #[serde(default = "default_bool_false")]
    pub volume_normalize: bool,

    // Playback
    #[serde(default = "default_true")]
    pub autoplay: bool,
    #[serde(default = "default_playback_speed")]
    pub playback_speed: f32,
    #[serde(default = "default_volume")]
    pub volume: f32,
    #[serde(default = "default_bool_true")]
    pub autoplay_next: bool,
    #[serde(default = "default_bool_false")]
    pub skip_intro: bool,
    #[serde(default = "default_bool_true")]
    pub resume_playback: bool,

    // Subtitles
    #[serde(default = "default_subtitle_lang")]
    pub subtitle_language: String,
    #[serde(default = "default_subtitle_size")]
    pub subtitle_size: String,
    #[serde(default = "default_bool_false")]
    pub subtitles_enabled: bool,

    // Network
    #[serde(default = "default_buffer_size")]
    pub buffer_size: String,
    #[serde(default = "default_bool_true")]
    pub preload_next: bool,
    #[serde(default = "default_torrent_connections")]
    pub torrent_connections: String,
    #[serde(default = "default_cache_size")]
    pub cache_size: String,

    // Advanced
    #[serde(default = "default_player_engine")]
    pub player_engine: String,
    #[serde(default = "default_bool_false")]
    pub debug_logging: bool,
    #[serde(default = "default_bool_false")]
    pub analytics: bool,

    // General
    #[serde(default = "default_true")]
    pub notifications_enabled: bool,
    #[serde(default = "default_true")]
    pub auto_update: bool,
    
    // Notification tracking
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_notification_check: Option<String>, // RFC3339 timestamp

    // Telemetry
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
fn default_bool_true() -> bool {
    true
}
fn default_bool_false() -> bool {
    false
}
fn default_subtitle_lang() -> String {
    "en".to_string()
}
fn default_language() -> String {
    "en".to_string()
}
fn default_theme() -> String {
    "auto".to_string()
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
fn default_quality() -> String {
    "auto".to_string()
}
fn default_video_codec() -> String {
    "auto".to_string()
}
fn default_max_bitrate() -> String {
    "auto".to_string()
}
fn default_audio_codec() -> String {
    "auto".to_string()
}
fn default_audio_channels() -> String {
    "auto".to_string()
}
fn default_subtitle_size() -> String {
    "medium".to_string()
}
fn default_buffer_size() -> String {
    "medium".to_string()
}
fn default_torrent_connections() -> String {
    "100".to_string()
}
fn default_cache_size() -> String {
    "1024".to_string()
}
fn default_player_engine() -> String {
    "auto".to_string()
}

impl Default for UserPreferences {
    fn default() -> Self {
        // These defaults should match the frontend's `getDefaultSettings`
        Self {
            version: 1,
            theme: default_theme(),
            language: default_language(),
            tmdb_api_key: None,
            // Video
            quality: default_quality(),
            default_quality: default_quality(),
            video_codec: default_video_codec(),
            max_bitrate: default_max_bitrate(),
            hardware_accel: default_bool_true(),
            // Audio
            audio_codec: default_audio_codec(),
            audio_channels: default_audio_channels(),
            volume_normalize: default_bool_false(),
            // Playback
            autoplay: default_true(),
            playback_speed: default_playback_speed(),
            volume: default_volume(),
            autoplay_next: default_bool_true(),
            skip_intro: default_bool_false(),
            resume_playback: default_bool_true(),
            // Subtitles
            subtitle_language: default_subtitle_lang(),
            subtitle_size: default_subtitle_size(),
            subtitles_enabled: default_bool_false(),
            // Network
            buffer_size: default_buffer_size(),
            preload_next: default_bool_true(),
            torrent_connections: default_torrent_connections(),
            cache_size: default_cache_size(),
            // Advanced
            player_engine: default_player_engine(),
            debug_logging: default_bool_false(),
            analytics: default_bool_false(),
            // General
            notifications_enabled: default_true(),
            auto_update: default_true(),
            last_notification_check: None,
            // Telemetry
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

/// Addon health summary statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddonHealthSummary {
    pub addon_id: String,
    pub last_check: i64,
    pub success_rate: f64,
    pub avg_response_time_ms: i64,
    pub total_requests: i64,
    pub successful_requests: i64,
    pub failed_requests: i64,
    pub last_error: Option<String>,
    pub health_score: f64,
}
