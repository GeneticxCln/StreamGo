use crate::models::{MediaItem, MediaType};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewEpisode {
    pub series_id: String,
    pub series_name: String,
    pub episode_id: String,
    pub season: u32,
    pub episode: u32,
    pub title: String,
    pub air_date: Option<String>,
    pub poster_url: Option<String>,
}

/// Check library for new episodes since last check
pub async fn check_new_episodes(
    library_items: Vec<MediaItem>,
    _last_check: Option<chrono::DateTime<chrono::Utc>>,
) -> Result<Vec<NewEpisode>, anyhow::Error> {
    let new_episodes = Vec::new();

    // Filter for TV shows only
    let tv_shows: Vec<&MediaItem> = library_items
        .iter()
        .filter(|item| matches!(item.media_type, MediaType::TvShow))
        .collect();

    tracing::info!("Checking {} TV shows for new episodes", tv_shows.len());

    // For now, return empty list since we need addon integration to check for new episodes
    // This is a placeholder that will be expanded with actual addon queries
    // TODO: Query each series from addons to get latest episode information
    // TODO: Compare with last watched episode to find new episodes
    // TODO: Check air dates against last_check timestamp
    
    Ok(new_episodes)
}
