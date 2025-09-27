use reqwest;
use serde_json::Value;
use crate::models::*;
use anyhow::{anyhow, Result};

// Mock TMDB API integration (in a real app, you'd use actual API keys)
const TMDB_BASE_URL: &str = "https://api.themoviedb.org/3";

pub async fn search_movies_and_shows(query: &str) -> Result<Vec<MediaItem>> {
    // TODO: Handle API key securely
    std::env::set_var("TMDB_API_KEY", "558a912b85ebe45bde56dac22076ed58");
    search_tmdb(query).await
}

pub async fn get_media_details(content_id: &str) -> Result<MediaItem> {
    // TODO: Handle API key securely
    std::env::set_var("TMDB_API_KEY", "558a912b85ebe45bde56dac22076ed58");
    let api_key = std::env::var("TMDB_API_KEY")
        .map_err(|_| anyhow!("TMDB_API_KEY environment variable not set"))?;

    let client = reqwest::Client::new();
    // This assumes the content is a movie, which is not always true.
    // A better implementation would check the media type.
    let url = format!("{}/movie/{}", TMDB_BASE_URL, content_id);

    let response = client
        .get(&url)
        .query(&[("api_key", &api_key)])
        .send()
        .await?;

    let json: Value = response.json().await?;

    parse_tmdb_movie_details(&json).ok_or_else(|| anyhow!("Failed to parse TMDB result"))
}

fn parse_tmdb_movie_details(result: &Value) -> Option<MediaItem> {
    let title = result["title"].as_str()?;
    let year = result["release_date"].as_str()
            .and_then(|date| date.split('-').next())
            .and_then(|year_str| year_str.parse::<i32>().ok());
    
    let genres: Vec<String> = result["genres"].as_array().map_or(vec![], |genres| {
        genres.iter().filter_map(|g| g["name"].as_str().map(|s| s.to_string())).collect()
    });

    Some(MediaItem {
        id: result["id"].as_u64()?.to_string(),
        title: title.to_string(),
        media_type: MediaType::Movie,
        year,
        genre: genres,
        description: result["overview"].as_str().map(|s| s.to_string()),
        poster_url: result["poster_path"].as_str()
            .map(|path| format!("https://image.tmdb.org/t/p/w500{}", path)),
        backdrop_url: result["backdrop_path"].as_str()
            .map(|path| format!("https://image.tmdb.org/t/p/w1280{}", path)),
        rating: result["vote_average"].as_f64().map(|r| r as f32),
        duration: result["runtime"].as_i64().map(|d| d as i32),
        added_to_library: None,
        watched: false,
        progress: None,
    })
}

pub async fn get_streaming_url(content_id: &str) -> Result<String> {
    // This is where addon system would be integrated
    // For demo purposes, return a mock streaming URL
    
    log::info!("Getting stream URL for content: {}", content_id);
    
    // Simulate checking different addons for stream sources
    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    
    // In a real implementation, this would:
    // 1. Query available addons
    // 2. Call addon APIs to get stream sources
    // 3. Return the best quality/most reliable source
    
    Ok("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4".to_string())
}

pub async fn install_addon(addon_url: &str) -> Result<String> {
    log::info!("Installing addon from: {}", addon_url);
    
    // Simulate addon installation process
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
    
    // In a real implementation, this would:
    // 1. Download addon manifest
    // 2. Validate addon structure and permissions
    // 3. Install addon files
    // 4. Register addon in database
    
    let addon_id = uuid::Uuid::new_v4().to_string();
    
    // Create mock addon
    let _mock_addon = Addon {
        id: addon_id.clone(),
        name: "New Addon".to_string(),
        version: "1.0.0".to_string(),
        description: "A newly installed addon".to_string(),
        author: "Unknown".to_string(),
        url: addon_url.to_string(),
        enabled: true,
        addon_type: AddonType::ContentProvider,
        manifest: AddonManifest {
            id: addon_id.clone(),
            name: "New Addon".to_string(),
            version: "1.0.0".to_string(),
            description: "A newly installed addon".to_string(),
            resources: vec!["catalog".to_string()],
            types: vec!["movie".to_string(), "series".to_string()],
            catalogs: vec![
                Catalog {
                    catalog_type: "movie".to_string(),
                    id: "movie_catalog".to_string(),
                    name: "Movies".to_string(),
                    genres: Some(vec!["action".to_string(), "drama".to_string()]),
                }
            ],
        },
    };
    
    // In a real app, save to database here
    
    Ok(addon_id)
}

pub async fn get_installed_addons() -> Result<Vec<Addon>> {
    // Return mock addons for demo
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
                catalogs: vec![
                    Catalog {
                        catalog_type: "movie".to_string(),
                        id: "yt_movies".to_string(),
                        name: "YouTube Movies".to_string(),
                        genres: None,
                    }
                ],
            },
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
                catalogs: vec![
                    Catalog {
                        catalog_type: "movie".to_string(),
                        id: "local_movies".to_string(),
                        name: "Local Movies".to_string(),
                        genres: None,
                    }
                ],
            },
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
        MediaType::Movie => result["release_date"].as_str()
            .and_then(|date| date.split('-').next())
            .and_then(|year_str| year_str.parse::<i32>().ok()),
        MediaType::TvShow => result["first_air_date"].as_str()
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
        poster_url: result["poster_path"].as_str()
            .map(|path| format!("https://image.tmdb.org/t/p/w500{}", path)),
        backdrop_url: result["backdrop_path"].as_str()
            .map(|path| format!("https://image.tmdb.org/t/p/w1280{}", path)),
        rating: result["vote_average"].as_f64().map(|r| r as f32),
        duration: None, // Would need additional API call
        added_to_library: None,
        watched: false,
        progress: None,
    })
}