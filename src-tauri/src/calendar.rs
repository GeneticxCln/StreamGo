use crate::addon_protocol::AddonClient;
use crate::models::{Addon, MediaItem, MediaType};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEntry {
    pub series_id: String,
    pub series_name: String,
    pub episode_id: String,
    pub season: u32,
    pub episode: u32,
    pub title: String,
    pub air_date: DateTime<Utc>,
    pub poster_url: Option<String>,
    pub backdrop_url: Option<String>,
    pub description: Option<String>,
}

/// Get upcoming episodes for TV series in the user's library
/// Returns episodes airing within the next `days_ahead` days
pub async fn get_calendar(
    library_items: Vec<MediaItem>,
    days_ahead: u32,
    addons: Vec<Addon>,
) -> Result<Vec<CalendarEntry>, anyhow::Error> {
    let mut calendar_entries = Vec::new();

    // Filter for TV shows only
    let tv_shows: Vec<&MediaItem> = library_items
        .iter()
        .filter(|item| matches!(item.media_type, MediaType::TvShow))
        .collect();

    tracing::info!(
        "Generating calendar for {} TV shows, {} days ahead",
        tv_shows.len(),
        days_ahead
    );

    if tv_shows.is_empty() {
        return Ok(calendar_entries);
    }

    // Filter enabled addons that support meta resource
    let enabled_addons: Vec<_> = addons
        .into_iter()
        .filter(|a| a.enabled && !a.url.is_empty())
        .filter(|a| {
            a.manifest
                .resources
                .iter()
                .any(|r| r == "meta")
        })
        .collect();

    if enabled_addons.is_empty() {
        tracing::warn!("No enabled addons with meta resource found");
        return Ok(calendar_entries);
    }

    // Calculate date range
    let now = Utc::now();
    let cutoff_date = now + chrono::Duration::days(days_ahead as i64);

    // Query each TV show for episodes
    for show in tv_shows {
        let entries = fetch_episodes_for_show(show, &enabled_addons, now, cutoff_date).await;
        calendar_entries.extend(entries);
    }

    // Sort by air_date ascending
    calendar_entries.sort_by(|a, b| a.air_date.cmp(&b.air_date));

    tracing::info!(
        "Found {} upcoming episodes",
        calendar_entries.len()
    );

    Ok(calendar_entries)
}

/// Fetch episodes for a single TV show from addons
async fn fetch_episodes_for_show(
    show: &MediaItem,
    addons: &[Addon],
    now: DateTime<Utc>,
    cutoff_date: DateTime<Utc>,
) -> Vec<CalendarEntry> {
    let mut entries = Vec::new();

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
                tracing::warn!(addon_id = %addon.id, error = %e, "Failed to create addon client");
                continue;
            }
        };

        // Query meta for this series
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
            // Parse air date from released field
            let air_date = match parse_air_date(&video.released) {
                Some(date) => date,
                None => continue, // Skip episodes without air date
            };

            // Filter: only episodes airing between now and cutoff
            if air_date >= now && air_date <= cutoff_date {
                entries.push(CalendarEntry {
                    series_id: show.id.clone(),
                    series_name: show.title.clone(),
                    episode_id: video.id.clone(),
                    season: video.season.unwrap_or(0),
                    episode: video.episode.unwrap_or(0),
                    title: video.title.clone(),
                    air_date,
                    poster_url: video.thumbnail.clone().or_else(|| show.poster_url.clone()),
                    backdrop_url: show.backdrop_url.clone(),
                    description: video.overview.clone(),
                });
            }
        }

        // If we got episodes from this addon, stop trying others
        if !entries.is_empty() {
            tracing::debug!(
                addon_id = %addon.id,
                show_id = %show.id,
                show_name = %show.title,
                episode_count = entries.len(),
                "Found episodes"
            );
            break;
        }
    }

    entries
}

/// Parse air date from various date formats
fn parse_air_date(released: &Option<String>) -> Option<DateTime<Utc>> {
    let date_str = released.as_ref()?;

    // Try ISO 8601 datetime first (e.g., "2024-01-15T20:00:00Z")
    if let Ok(dt) = DateTime::parse_from_rfc3339(date_str) {
        return Some(dt.with_timezone(&Utc));
    }

    // Try date only format (e.g., "2024-01-15")
    if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        return Some(
            date.and_hms_opt(0, 0, 0)
                .unwrap()
                .and_local_timezone(Utc)
                .single()?,
        );
    }

    // Try other common formats
    if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y/%m/%d") {
        return Some(
            date.and_hms_opt(0, 0, 0)
                .unwrap()
                .and_local_timezone(Utc)
                .single()?,
        );
    }

    None
}

/// Group calendar entries by date for UI display
pub fn group_by_date(entries: Vec<CalendarEntry>) -> Vec<(String, Vec<CalendarEntry>)> {
    use std::collections::HashMap;

    let mut grouped: HashMap<String, Vec<CalendarEntry>> = HashMap::new();

    for entry in entries {
        let date_key = entry.air_date.format("%Y-%m-%d").to_string();
        grouped.entry(date_key).or_default().push(entry);
    }

    let mut result: Vec<(String, Vec<CalendarEntry>)> = grouped.into_iter().collect();
    result.sort_by(|a, b| a.0.cmp(&b.0));

    result
}

/// Format relative date for calendar display (Today, Tomorrow, etc.)
pub fn format_relative_date(air_date: &DateTime<Utc>) -> String {
    let now = Utc::now();
    let days_diff = (air_date.date_naive() - now.date_naive()).num_days();

    match days_diff {
        0 => "Today".to_string(),
        1 => "Tomorrow".to_string(),
        2..=6 => air_date.format("%A").to_string(), // Day of week
        7.. => air_date.format("%B %d").to_string(), // Month Day
        _ => air_date.format("%Y-%m-%d").to_string(),
    }
}
