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
    pub theme: String,
    pub default_quality: String,
    pub autoplay_next: bool,
    pub subtitles_enabled: bool,
    pub subtitle_language: String,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            theme: "auto".to_string(),
            default_quality: "auto".to_string(),
            autoplay_next: true,
            subtitles_enabled: false,
            subtitle_language: "en".to_string(),
        }
    }
}