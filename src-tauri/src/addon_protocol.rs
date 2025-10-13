/**
 * Addon Protocol Implementation
 * 
 * HTTP-based protocol for third-party content sources
 * Inspired by Stremio's addon protocol
 */

use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Addon manifest - describes capabilities and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddonManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    #[serde(default)]
    pub types: Vec<AddonMediaType>,
    #[serde(default)]
    pub catalogs: Vec<CatalogDescriptor>,
    #[serde(default)]
    pub resources: Vec<ResourceType>,
    #[serde(default)]
    pub id_prefixes: Vec<String>,
    #[serde(default)]
    pub behavior_hints: BehaviorHints,
}

/// Media types supported by addon
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AddonMediaType {
    Movie,
    Series,
    Channel,
    TV,
}

/// Catalog descriptor - describes a content catalog
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogDescriptor {
    #[serde(rename = "type")]
    pub media_type: AddonMediaType,
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub extra: Vec<ExtraField>,
}

/// Extra fields for catalog queries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtraField {
    pub name: String,
    #[serde(default)]
    pub is_required: bool,
    #[serde(default)]
    pub options: Vec<String>,
    #[serde(default)]
    pub options_limit: Option<u32>,
}

/// Resource types provided by addon
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ResourceType {
    Catalog,
    Stream,
    Meta,
    Subtitles,
}

/// Behavior hints for addon
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BehaviorHints {
    #[serde(default)]
    pub adult: bool,
    #[serde(default)]
    pub p2p: bool,
}

/// Catalog response - list of metadata items
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogResponse {
    pub metas: Vec<MetaPreview>,
}

/// Metadata preview - minimal info for catalog listings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetaPreview {
    pub id: String,
    #[serde(rename = "type")]
    pub media_type: AddonMediaType,
    pub name: String,
    #[serde(default)]
    pub poster: Option<String>,
    #[serde(default)]
    pub posterShape: Option<String>,
    #[serde(default)]
    pub background: Option<String>,
    #[serde(default)]
    pub logo: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub releaseInfo: Option<String>,
    #[serde(default)]
    pub imdbRating: Option<f32>,
}

/// Stream response - list of available streams
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamResponse {
    pub streams: Vec<Stream>,
}

/// Stream - a playable media source
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stream {
    /// Stream URL (required)
    pub url: String,
    
    /// Title/name of the stream
    #[serde(default)]
    pub title: Option<String>,
    
    /// Quality label (e.g. "1080p", "720p")
    #[serde(default)]
    pub name: Option<String>,
    
    /// Info text (e.g. "Cached • 1080p • 5.1")
    #[serde(default)]
    pub description: Option<String>,
    
    /// Behavioral hints
    #[serde(default)]
    pub behaviorHints: StreamBehaviorHints,
    
    /// Subtitles available for this stream
    #[serde(default)]
    pub subtitles: Vec<Subtitle>,
}

/// Stream behavior hints
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StreamBehaviorHints {
    #[serde(default)]
    pub notWebReady: bool,
    #[serde(default)]
    pub bingeGroup: Option<String>,
    #[serde(default)]
    pub countryWhitelist: Option<Vec<String>>,
}

/// Subtitle track
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subtitle {
    pub id: String,
    pub url: String,
    pub lang: String,
}

/// Addon client for making HTTP requests
pub struct AddonClient {
    client: reqwest::Client,
    base_url: String,
}

impl AddonClient {
    /// Create a new addon client
    pub fn new(base_url: String) -> Result<Self, AddonError> {
        // Validate URL
        if !base_url.starts_with("http://") && !base_url.starts_with("https://") {
            return Err(AddonError::InvalidUrl("URL must start with http:// or https://".to_string()));
        }

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent(concat!(
                env!("CARGO_PKG_NAME"),
                "/",
                env!("CARGO_PKG_VERSION")
            ))
            .build()
            .map_err(|e| AddonError::HttpError(e.to_string()))?;

        Ok(Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
        })
    }

    /// Fetch addon manifest
    pub async fn get_manifest(&self) -> Result<AddonManifest, AddonError> {
        let url = format!("{}/manifest.json", self.base_url);
        
        tracing::info!(url = %url, "Fetching addon manifest");
        
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AddonError::HttpError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(AddonError::HttpError(format!(
                "HTTP {}: {}",
                response.status(),
                response.text().await.unwrap_or_default()
            )));
        }

        let manifest = response
            .json::<AddonManifest>()
            .await
            .map_err(|e| AddonError::ParseError(e.to_string()))?;

        // Validate manifest
        Self::validate_manifest(&manifest)?;

        tracing::info!(
            addon_id = %manifest.id,
            addon_name = %manifest.name,
            "Successfully fetched manifest"
        );

        Ok(manifest)
    }

    /// Fetch catalog
    pub async fn get_catalog(
        &self,
        media_type: &str,
        catalog_id: &str,
        extra: Option<&std::collections::HashMap<String, String>>,
    ) -> Result<CatalogResponse, AddonError> {
        let mut url = format!(
            "{}/catalog/{}/{}.json",
            self.base_url, media_type, catalog_id
        );

        // Add extra parameters if provided
        if let Some(extra_params) = extra {
            if !extra_params.is_empty() {
                let query_string: Vec<String> = extra_params
                    .iter()
                    .map(|(k, v)| format!("{}={}", k, v))
                    .collect();
                url.push('?');
                url.push_str(&query_string.join("&"));
            }
        }

        tracing::info!(url = %url, "Fetching catalog");

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AddonError::HttpError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(AddonError::HttpError(format!(
                "HTTP {}: {}",
                response.status(),
                response.text().await.unwrap_or_default()
            )));
        }

        let catalog = response
            .json::<CatalogResponse>()
            .await
            .map_err(|e| AddonError::ParseError(e.to_string()))?;

        tracing::info!(
            media_type = %media_type,
            catalog_id = %catalog_id,
            item_count = catalog.metas.len(),
            "Successfully fetched catalog"
        );

        Ok(catalog)
    }

    /// Fetch streams for a media item
    pub async fn get_streams(
        &self,
        media_type: &str,
        media_id: &str,
    ) -> Result<StreamResponse, AddonError> {
        let url = format!("{}/stream/{}/{}.json", self.base_url, media_type, media_id);

        tracing::info!(url = %url, "Fetching streams");

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AddonError::HttpError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(AddonError::HttpError(format!(
                "HTTP {}: {}",
                response.status(),
                response.text().await.unwrap_or_default()
            )));
        }

        let streams = response
            .json::<StreamResponse>()
            .await
            .map_err(|e| AddonError::ParseError(e.to_string()))?;

        tracing::info!(
            media_type = %media_type,
            media_id = %media_id,
            stream_count = streams.streams.len(),
            "Successfully fetched streams"
        );

        Ok(streams)
    }

    /// Validate manifest
    fn validate_manifest(manifest: &AddonManifest) -> Result<(), AddonError> {
        if manifest.id.is_empty() {
            return Err(AddonError::ValidationError("Manifest ID is required".to_string()));
        }

        if manifest.name.is_empty() {
            return Err(AddonError::ValidationError("Manifest name is required".to_string()));
        }

        if manifest.version.is_empty() {
            return Err(AddonError::ValidationError("Manifest version is required".to_string()));
        }

        if manifest.resources.is_empty() {
            return Err(AddonError::ValidationError("At least one resource is required".to_string()));
        }

        Ok(())
    }
}

/// Addon errors
#[derive(Debug, thiserror::Error)]
pub enum AddonError {
    #[error("Invalid URL: {0}")]
    InvalidUrl(String),

    #[error("HTTP error: {0}")]
    HttpError(String),

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Timeout")]
    Timeout,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_manifest_serialization() {
        let manifest = AddonManifest {
            id: "test-addon".to_string(),
            name: "Test Addon".to_string(),
            version: "1.0.0".to_string(),
            description: "A test addon".to_string(),
            types: vec![AddonMediaType::Movie],
            catalogs: vec![CatalogDescriptor {
                media_type: AddonMediaType::Movie,
                id: "popular".to_string(),
                name: "Popular".to_string(),
                extra: vec![],
            }],
            resources: vec![ResourceType::Catalog, ResourceType::Stream],
            id_prefixes: vec![],
            behavior_hints: BehaviorHints::default(),
        };

        let json = serde_json::to_string(&manifest).unwrap();
        let deserialized: AddonManifest = serde_json::from_str(&json).unwrap();

        assert_eq!(manifest.id, deserialized.id);
        assert_eq!(manifest.name, deserialized.name);
    }

    #[test]
    fn test_stream_serialization() {
        let stream = Stream {
            url: "https://example.com/stream.m3u8".to_string(),
            title: Some("Example Stream".to_string()),
            name: Some("1080p".to_string()),
            description: Some("Full HD".to_string()),
            behaviorHints: StreamBehaviorHints::default(),
            subtitles: vec![],
        };

        let json = serde_json::to_string(&stream).unwrap();
        let deserialized: Stream = serde_json::from_str(&json).unwrap();

        assert_eq!(stream.url, deserialized.url);
        assert_eq!(stream.name, deserialized.name);
    }
}
