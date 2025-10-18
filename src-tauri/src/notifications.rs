use crate::addon_protocol::AddonClient;
use crate::models::{Addon, MediaItem, MediaType};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::time::Duration;

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
/// Note: This requires addon integration and will return empty if addons parameter is added
pub async fn check_new_episodes(
    library_items: Vec<MediaItem>,
    last_check: Option<DateTime<Utc>>,
    addons: Vec<Addon>,
) -> Result<Vec<NewEpisode>, anyhow::Error> {
    let mut new_episodes = Vec::new();

    // Filter for TV shows only
    let tv_shows: Vec<&MediaItem> = library_items
        .iter()
        .filter(|item| matches!(item.media_type, MediaType::TvShow))
        .collect();

    if tv_shows.is_empty() {
        tracing::info!("No TV shows in library to check for new episodes");
        return Ok(new_episodes);
    }

    // Filter enabled addons that support meta resource
    let enabled_addons: Vec<_> = addons
        .into_iter()
        .filter(|a| a.enabled && !a.url.is_empty())
        .filter(|a| a.manifest.resources.iter().any(|r| r == "meta"))
        .collect();

    if enabled_addons.is_empty() {
        tracing::warn!("No enabled addons with meta resource found for episode checking");
        return Ok(new_episodes);
    }

    let now = Utc::now();
    let cutoff = last_check.unwrap_or_else(|| now - chrono::Duration::days(7));

    tracing::info!(
        "Checking {} TV shows against {} addons for new episodes since {}",
        tv_shows.len(),
        enabled_addons.len(),
        cutoff
    );

    // Check each TV show for new episodes
    for show in tv_shows {
        let show_new_episodes =
            check_show_for_new_episodes(show, &enabled_addons, cutoff, now).await;
        new_episodes.extend(show_new_episodes);
    }

    tracing::info!("Found {} new episodes", new_episodes.len());

    Ok(new_episodes)
}

/// Check a single show for new episodes
async fn check_show_for_new_episodes(
    show: &MediaItem,
    addons: &[Addon],
    cutoff: DateTime<Utc>,
    now: DateTime<Utc>,
) -> Vec<NewEpisode> {
    let mut new_episodes = Vec::new();

    // Try each addon until we get episode data
    for addon in addons {
        let base_url = if addon.url.ends_with("/manifest.json") {
            addon.url.replace("/manifest.json", "")
        } else if addon.url.ends_with("manifest.json") {
            addon.url.replace("manifest.json", "")
        } else {
            addon.url.clone()
        };

        let client = match AddonClient::new(base_url) {
            Ok(c) => c,
            Err(e) => {
                tracing::debug!(addon_id = %addon.id, error = %e, "Failed to create addon client");
                continue;
            }
        };

        // Query meta for this series with timeout
        let meta_result = tokio::time::timeout(
            Duration::from_secs(5),
            client.get_meta("series", &show.id),
        )
        .await;

        let meta = match meta_result {
            Ok(Ok(response)) => response.meta,
            Ok(Err(e)) => {
                tracing::debug!(
                    addon_id = %addon.id,
                    show_id = %show.id,
                    error = %e,
                    "Failed to fetch meta"
                );
                continue;
            }
            Err(_) => {
                tracing::debug!(
                    addon_id = %addon.id,
                    show_id = %show.id,
                    "Meta request timed out"
                );
                continue;
            }
        };

        // Process episodes (videos)
        for video in meta.videos {
            // Parse air date
            let air_date = match parse_episode_air_date(&video.released) {
                Some(date) => date,
                None => continue, // Skip episodes without air date
            };

            // Filter: only episodes that aired since last check and before now
            if air_date >= cutoff && air_date <= now {
                new_episodes.push(NewEpisode {
                    series_id: show.id.clone(),
                    series_name: show.title.clone(),
                    episode_id: video.id.clone(),
                    season: video.season.unwrap_or(0),
                    episode: video.episode.unwrap_or(0),
                    title: video.title.clone(),
                    air_date: Some(air_date.to_rfc3339()),
                    poster_url: video.thumbnail.clone().or_else(|| show.poster_url.clone()),
                });
            }
        }

        // If we got episodes from this addon, stop trying others
        if !new_episodes.is_empty() {
            tracing::debug!(
                addon_id = %addon.id,
                show_id = %show.id,
                show_name = %show.title,
                episode_count = new_episodes.len(),
                "Found new episodes"
            );
            break;
        }
    }

    new_episodes
}

/// Parse episode air date from various formats
fn parse_episode_air_date(released: &Option<String>) -> Option<DateTime<Utc>> {
    let date_str = released.as_ref()?;

    // Try ISO 8601 datetime first
    if let Ok(dt) = DateTime::parse_from_rfc3339(date_str) {
        return Some(dt.with_timezone(&Utc));
    }

    // Try date only format
    if let Ok(date) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        return Some(
            date.and_hms_opt(0, 0, 0)
                .unwrap()
                .and_local_timezone(Utc)
                .single()?,
        );
    }

    None
}
