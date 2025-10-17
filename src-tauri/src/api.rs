use crate::addon_protocol::{AddonClient, ResourceType};
use crate::cache::{ttl, CacheManager};
use crate::models::*;
use anyhow::{anyhow, Result};
use serde_json::Value;
use std::sync::{Arc, Mutex};

// Mock TMDB API integration (in a real app, you'd use actual API keys)
const TMDB_BASE_URL: &str = "https://api.themoviedb.org/3";

#[allow(dead_code)]
pub async fn search_movies_and_shows(query: &str) -> Result<Vec<MediaItem>> {
    search_movies_and_shows_cached(query, None).await
}

pub async fn search_movies_and_shows_cached(
    query: &str,
    cache: Option<Arc<Mutex<CacheManager>>>,
) -> Result<Vec<MediaItem>> {
    // Generate cache key
    let cache_key = format!("tmdb:search:{}", query);

    // Try to get from cache first
    if let Some(cache_manager) = &cache {
        if let Ok(cache_guard) = cache_manager.lock() {
            if let Ok(Some(cached_results)) = cache_guard.get_metadata::<Vec<MediaItem>>(&cache_key)
            {
                tracing::debug!(query = %query, "TMDB search results from cache");
                return Ok(cached_results);
            }
        }
    }

    // Cache miss, fetch from API
    tracing::debug!(query = %query, "TMDB search results from API");
    let results = search_tmdb(query).await?;

    // Store in cache
    if let Some(cache_manager) = &cache {
        if let Ok(cache_guard) = cache_manager.lock() {
            let _ = cache_guard.set_metadata(&cache_key, &results, ttl::METADATA);
        }
    }

    Ok(results)
}

#[allow(dead_code)]
pub async fn get_media_details(content_id: &str, media_type: &MediaType) -> Result<MediaItem> {
    get_media_details_cached(content_id, media_type, None).await
}

pub async fn get_media_details_cached(
    content_id: &str,
    media_type: &MediaType,
    cache: Option<Arc<Mutex<CacheManager>>>,
) -> Result<MediaItem> {
    // Generate cache key
    let media_type_str = match media_type {
        MediaType::Movie => "movie",
        MediaType::TvShow => "tv",
        _ => "movie",
    };
    let cache_key = format!("tmdb:details:{}:{}", media_type_str, content_id);

    // Try to get from cache first
    if let Some(cache_manager) = &cache {
        if let Ok(cache_guard) = cache_manager.lock() {
            if let Ok(Some(cached_item)) = cache_guard.get_metadata::<MediaItem>(&cache_key) {
                tracing::debug!(content_id = %content_id, "TMDB details from cache");
                return Ok(cached_item);
            }
        }
    }

    // Cache miss, fetch from API
    tracing::debug!(content_id = %content_id, "TMDB details from API");
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

    let item = parse_tmdb_movie_details(&json, media_type)
        .ok_or_else(|| anyhow!("Failed to parse TMDB result"))?;

    // Store in cache
    if let Some(cache_manager) = &cache {
        if let Ok(cache_guard) = cache_manager.lock() {
            let _ = cache_guard.set_metadata(&cache_key, &item, ttl::METADATA);
        }
    }

    Ok(item)
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

    // Normalize to base URL (strip trailing /manifest.json if provided)
    let base = if addon_url.ends_with("/manifest.json") {
        addon_url.trim_end_matches("/manifest.json").to_string()
    } else if addon_url.ends_with("manifest.json") {
        addon_url
            .trim_end_matches("manifest.json")
            .trim_end_matches('/')
            .to_string()
    } else {
        addon_url.trim_end_matches('/').to_string()
    };

    // Validate base URL format and scheme
    let parsed_url = url::Url::parse(&base).map_err(|e| anyhow!("Invalid addon URL: {}", e))?;
    if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
        return Err(anyhow!("Addon URL must use http or https protocol"));
    }

    // Use protocol client for strict validation and size limits
    let client = AddonClient::new(base.clone())
        .map_err(|e| anyhow!("Failed to create addon client: {}", e))?;
    let p_manifest = client
        .get_manifest()
        .await
        .map_err(|e| anyhow!("Failed to fetch addon manifest: {}", e))?;

    // Map protocol manifest to storage model
    let resources: Vec<String> = p_manifest
        .resources
        .iter()
        .map(|r| match r {
            ResourceType::Catalog => "catalog".to_string(),
            ResourceType::Stream => "stream".to_string(),
            ResourceType::Meta => "meta".to_string(),
            ResourceType::Subtitles => "subtitles".to_string(),
            ResourceType::AddonCatalog => "addon_catalog".to_string(),
        })
        .collect();

    let types: Vec<String> = p_manifest.types.iter().map(|t| t.0.clone()).collect();

    let catalogs: Vec<Catalog> = p_manifest
        .catalogs
        .iter()
        .map(|c| Catalog {
            catalog_type: c.media_type.0.clone(),
            id: c.id.clone(),
            name: c.name.clone(),
            genres: None,
        })
        .collect();

    let manifest = AddonManifest {
        id: p_manifest.id.clone(),
        name: p_manifest.name.clone(),
        version: p_manifest.version.clone(),
        description: p_manifest.description.clone(),
        resources,
        types,
        catalogs,
    };

    // Determine addon type based on protocol resources
    let addon_type = if p_manifest.resources.contains(&ResourceType::Stream) {
        AddonType::ContentProvider
    } else if p_manifest.resources.contains(&ResourceType::Meta) {
        AddonType::MetadataProvider
    } else if p_manifest.resources.contains(&ResourceType::Subtitles) {
        AddonType::Subtitles
    } else {
        AddonType::ContentProvider
    };

    // Ensure URL is not empty
    if base.is_empty() {
        return Err(anyhow!("Addon URL cannot be empty"));
    }

    let addon = Addon {
        id: manifest.id.clone(),
        name: manifest.name.clone(),
        version: manifest.version.clone(),
        description: manifest.description.clone(),
        author: "Community".to_string(),
        url: base,
        enabled: true,
        addon_type,
        manifest,
        priority: 0,
    };

    log::info!(
        "Successfully validated addon: {} v{}",
        addon.name,
        addon.version
    );

    Ok(addon)
}

/// Get real working Stremio community addons
/// These are actual production addons with real manifests
pub async fn get_builtin_addons() -> Result<Vec<Addon>> {
    log::info!("Fetching real Stremio community addons...");

    // Real, working Stremio community addon URLs
    let addon_urls = vec![
        "https://v3-cinemeta.strem.io/manifest.json", // Official TMDB metadata
        "https://opensubtitles.strem.io/manifest.json", // OpenSubtitles
        "https://watchhub.strem.io/manifest.json",    // WatchHub aggregator
    ];

    let mut addons = Vec::new();
    let mut priority = 10; // Start with high priority

    for url in addon_urls {
        match install_addon(url).await {
            Ok(mut addon) => {
                addon.priority = priority;
                priority -= 1; // Decrease priority for next addon
                log::info!("✓ Installed: {} v{}", addon.name, addon.version);
                addons.push(addon);
            }
            Err(e) => {
                log::warn!("✗ Failed to install {}: {}", url, e);
                // Continue with other addons even if one fails
            }
        }
    }

    if addons.is_empty() {
        log::error!("Failed to install any built-in addons");
        return Err(anyhow!(
            "No built-in addons could be installed. Check network connectivity."
        ));
    }

    log::info!("Successfully installed {} built-in addons", addons.len());
    Ok(addons)
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
