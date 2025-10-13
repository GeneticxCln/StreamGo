use crate::models::*;
use anyhow::{anyhow, Result};
use serde_json::Value;

// Mock TMDB API integration (in a real app, you'd use actual API keys)
const TMDB_BASE_URL: &str = "https://api.themoviedb.org/3";

pub async fn search_movies_and_shows(query: &str) -> Result<Vec<MediaItem>> {
    search_tmdb(query).await
}

pub async fn get_media_details(content_id: &str, media_type: &MediaType) -> Result<MediaItem> {
    let api_key = std::env::var("TMDB_API_KEY")
        .map_err(|_| anyhow!("TMDB_API_KEY environment variable not set"))?;

    let client = reqwest::Client::new();
    // Use the correct endpoint based on media type
    let endpoint = match media_type {
        MediaType::Movie => "movie",
        MediaType::TvShow => "tv",
        _ => "movie", // Default fallback
    };
    let url = format!("{}/{}/{}", TMDB_BASE_URL, endpoint, content_id);

    let response = client
        .get(&url)
        .query(&[("api_key", &api_key)])
        .send()
        .await?;

    let json: Value = response.json().await?;

    parse_tmdb_movie_details(&json, media_type)
        .ok_or_else(|| anyhow!("Failed to parse TMDB result"))
}

fn parse_tmdb_movie_details(result: &Value, media_type: &MediaType) -> Option<MediaItem> {
    let title = match media_type {
        MediaType::Movie => result["title"].as_str()?,
        MediaType::TvShow => result["name"].as_str()?,
        _ => result["title"].as_str()?,
    };

    let year = match media_type {
        MediaType::Movie => result["release_date"]
            .as_str()
            .and_then(|date| date.split('-').next())
            .and_then(|year_str| year_str.parse::<i32>().ok()),
        MediaType::TvShow => result["first_air_date"]
            .as_str()
            .and_then(|date| date.split('-').next())
            .and_then(|year_str| year_str.parse::<i32>().ok()),
        _ => result["release_date"]
            .as_str()
            .and_then(|date| date.split('-').next())
            .and_then(|year_str| year_str.parse::<i32>().ok()),
    };

    let genres: Vec<String> = result["genres"].as_array().map_or(vec![], |genres| {
        genres
            .iter()
            .filter_map(|g| g["name"].as_str().map(|s| s.to_string()))
            .collect()
    });

    Some(MediaItem {
        id: result["id"].as_u64()?.to_string(),
        title: title.to_string(),
        media_type: media_type.clone(),
        year,
        genre: genres,
        description: result["overview"].as_str().map(|s| s.to_string()),
        poster_url: result["poster_path"]
            .as_str()
            .map(|path| format!("https://image.tmdb.org/t/p/w500{}", path)),
        backdrop_url: result["backdrop_path"]
            .as_str()
            .map(|path| format!("https://image.tmdb.org/t/p/w1280{}", path)),
        rating: result["vote_average"].as_f64().map(|r| r as f32),
        duration: result["runtime"].as_i64().map(|d| d as i32),
        added_to_library: None,
        watched: false,
        progress: None,
    })
}

#[allow(dead_code)]
pub async fn get_streaming_url(content_id: &str) -> Result<String> {
    // Legacy function - replaced by aggregator-based get_stream_url in lib.rs
    // Kept for backward compatibility during refactoring

    log::info!("Getting stream URL for content: {}", content_id);

    // Simulate checking different addons for stream sources
    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

    // In a real implementation, this would:
    // 1. Query available addons
    // 2. Call addon APIs to get stream sources
    // 3. Return the best quality/most reliable source

    Ok(
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            .to_string(),
    )
}

pub async fn install_addon(addon_url: &str) -> Result<Addon> {
    log::info!("Installing addon from: {}", addon_url);

    // Validate URL format
    let parsed_url = url::Url::parse(addon_url).map_err(|e| anyhow!("Invalid addon URL: {}", e))?;

    if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
        return Err(anyhow!("Addon URL must use http or https protocol"));
    }

    // Download addon manifest with timeout
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;

    let manifest_url = if addon_url.ends_with("/manifest.json") {
        addon_url.to_string()
    } else {
        format!("{}/manifest.json", addon_url.trim_end_matches('/'))
    };

    log::info!("Fetching manifest from: {}", manifest_url);

    let response = client
        .get(&manifest_url)
        .send()
        .await
        .map_err(|e| anyhow!("Failed to fetch addon manifest: {}", e))?;

    if !response.status().is_success() {
        return Err(anyhow!(
            "Failed to fetch manifest: HTTP {}",
            response.status()
        ));
    }

    let manifest: AddonManifest = response
        .json()
        .await
        .map_err(|e| anyhow!("Invalid manifest JSON: {}", e))?;

    // Validate manifest structure
    validate_addon_manifest(&manifest)?;

    // Determine addon type based on resources
    let addon_type = if manifest.resources.contains(&"stream".to_string()) {
        AddonType::ContentProvider
    } else if manifest.resources.contains(&"meta".to_string()) {
        AddonType::MetadataProvider
    } else if manifest.resources.contains(&"subtitles".to_string()) {
        AddonType::Subtitles
    } else {
        AddonType::ContentProvider // Default
    };

    let addon = Addon {
        id: manifest.id.clone(),
        name: manifest.name.clone(),
        version: manifest.version.clone(),
        description: manifest.description.clone(),
        author: "Community".to_string(), // Could be added to manifest spec
        url: addon_url.to_string(),
        enabled: true,
        addon_type,
        manifest,
        priority: 0, // Default priority
    };

    log::info!(
        "Successfully validated addon: {} v{}",
        addon.name,
        addon.version
    );

    Ok(addon)
}

fn validate_addon_manifest(manifest: &AddonManifest) -> Result<()> {
    if manifest.id.is_empty() {
        return Err(anyhow!("Manifest missing required field: id"));
    }
    if manifest.name.is_empty() {
        return Err(anyhow!("Manifest missing required field: name"));
    }
    if manifest.version.is_empty() {
        return Err(anyhow!("Manifest missing required field: version"));
    }
    if manifest.resources.is_empty() {
        return Err(anyhow!("Manifest must declare at least one resource"));
    }
    if manifest.types.is_empty() {
        return Err(anyhow!("Manifest must declare at least one content type"));
    }
    Ok(())
}

// This function is no longer needed - moved to lib.rs to use DB
// Keeping stub for backwards compatibility during refactor
pub async fn get_builtin_addons() -> Result<Vec<Addon>> {
    let mock_addons = vec![
        Addon {
            id: "tmdb_addon".to_string(),
            name: "TMDB Provider".to_string(),
            version: "1.0.0".to_string(),
            description: "The Movie Database metadata provider".to_string(),
            author: "StreamGo Team".to_string(),
            url: "built-in".to_string(),
            enabled: true,
            addon_type: AddonType::MetadataProvider,
            manifest: AddonManifest {
                id: "tmdb_addon".to_string(),
                name: "TMDB Provider".to_string(),
                version: "1.0.0".to_string(),
                description: "The Movie Database metadata provider".to_string(),
                resources: vec!["meta".to_string()],
                types: vec!["movie".to_string(), "series".to_string()],
                catalogs: vec![],
            },
            priority: 10, // High priority for official TMDB
        },
        Addon {
            id: "youtube_addon".to_string(),
            name: "YouTube Addon".to_string(),
            version: "1.0.0".to_string(),
            description: "Stream content from YouTube".to_string(),
            author: "StreamGo Team".to_string(),
            url: "built-in".to_string(),
            enabled: true,
            addon_type: AddonType::ContentProvider,
            manifest: AddonManifest {
                id: "youtube_addon".to_string(),
                name: "YouTube Addon".to_string(),
                version: "1.0.0".to_string(),
                description: "Stream content from YouTube".to_string(),
                resources: vec!["catalog".to_string(), "stream".to_string()],
                types: vec!["movie".to_string(), "series".to_string()],
                catalogs: vec![Catalog {
                    catalog_type: "movie".to_string(),
                    id: "yt_movies".to_string(),
                    name: "YouTube Movies".to_string(),
                    genres: None,
                }],
            },
            priority: 5, // Medium priority
        },
        Addon {
            id: "local_files".to_string(),
            name: "Local Files".to_string(),
            version: "1.0.0".to_string(),
            description: "Play local video files".to_string(),
            author: "StreamGo Team".to_string(),
            url: "built-in".to_string(),
            enabled: false,
            addon_type: AddonType::ContentProvider,
            manifest: AddonManifest {
                id: "local_files".to_string(),
                name: "Local Files".to_string(),
                version: "1.0.0".to_string(),
                description: "Play local video files".to_string(),
                resources: vec!["catalog".to_string(), "stream".to_string()],
                types: vec!["movie".to_string(), "series".to_string()],
                catalogs: vec![Catalog {
                    catalog_type: "movie".to_string(),
                    id: "local_movies".to_string(),
                    name: "Local Movies".to_string(),
                    genres: None,
                }],
            },
            priority: 0, // Lower priority
        },
    ];

    Ok(mock_addons)
}

// Real TMDB integration function (commented out for demo)
async fn search_tmdb(query: &str) -> Result<Vec<MediaItem>> {
    let api_key = std::env::var("TMDB_API_KEY")
        .map_err(|_| anyhow!("TMDB_API_KEY environment variable not set"))?;

    let client = reqwest::Client::new();
    let url = format!("{}/search/multi", TMDB_BASE_URL);

    let response = client
        .get(&url)
        .query(&[("api_key", &api_key), ("query", &query.to_string())])
        .send()
        .await?;

    let json: Value = response.json().await?;
    let empty_results = vec![];
    let results = json["results"].as_array().unwrap_or(&empty_results);

    let mut media_items = Vec::new();
    for result in results {
        if let Some(media_item) = parse_tmdb_result(result) {
            media_items.push(media_item);
        }
    }

    Ok(media_items)
}

fn parse_tmdb_result(result: &Value) -> Option<MediaItem> {
    let media_type_str = result["media_type"].as_str()?;
    let media_type = match media_type_str {
        "movie" => MediaType::Movie,
        "tv" => MediaType::TvShow,
        _ => return None,
    };

    let title = match media_type {
        MediaType::Movie => result["title"].as_str()?,
        MediaType::TvShow => result["name"].as_str()?,
        _ => return None,
    };

    let year = match media_type {
        MediaType::Movie => result["release_date"]
            .as_str()
            .and_then(|date| date.split('-').next())
            .and_then(|year_str| year_str.parse::<i32>().ok()),
        MediaType::TvShow => result["first_air_date"]
            .as_str()
            .and_then(|date| date.split('-').next())
            .and_then(|year_str| year_str.parse::<i32>().ok()),
        _ => None,
    };

    Some(MediaItem {
        id: result["id"].as_u64()?.to_string(),
        title: title.to_string(),
        media_type,
        year,
        genre: vec![], // Would need additional API call to get genres
        description: result["overview"].as_str().map(|s| s.to_string()),
        poster_url: result["poster_path"]
            .as_str()
            .map(|path| format!("https://image.tmdb.org/t/p/w500{}", path)),
        backdrop_url: result["backdrop_path"]
            .as_str()
            .map(|path| format!("https://image.tmdb.org/t/p/w1280{}", path)),
        rating: result["vote_average"].as_f64().map(|r| r as f32),
        duration: None, // Would need additional API call
        added_to_library: None,
        watched: false,
        progress: None,
    })
}
