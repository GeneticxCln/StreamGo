/**
 * Addon Protocol Implementation
 *
 * HTTP-based protocol for third-party content sources
 * Inspired by Stremio's addon protocol
 */
use serde::{Deserialize, Serialize};
use std::time::Duration;
use url::Url;

// Security constants
const MAX_MANIFEST_SIZE: u64 = 102400; // 100KB
const MAX_RESPONSE_SIZE: u64 = 10485760; // 10MB
const REQUEST_TIMEOUT_SECS: u64 = 5;
const MAX_CATALOG_ITEMS: usize = 1000;

// Retry configuration
const MAX_RETRIES: u32 = 3;
const INITIAL_RETRY_DELAY_MS: u64 = 100;

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
#[allow(non_snake_case)] // Stremio protocol uses camelCase
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

/// Subtitles response - list of available subtitles
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubtitlesResponse {
    pub subtitles: Vec<Subtitle>,
}

/// Stream - a playable media source
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(non_snake_case)] // Stremio protocol uses camelCase
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
#[allow(non_snake_case)] // Stremio protocol uses camelCase
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
    /// Helper function to retry HTTP requests with exponential backoff
    async fn retry_with_backoff<F, Fut, T>(operation: F) -> Result<T, AddonError>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T, AddonError>>,
    {
        let mut last_error = None;

        for attempt in 0..=MAX_RETRIES {
            match operation().await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    // Don't retry validation errors or parse errors
                    if matches!(
                        e,
                        AddonError::ValidationError(_) | AddonError::ParseError(_)
                    ) {
                        return Err(e);
                    }

                    last_error = Some(e);

                    // Don't sleep after the last attempt
                    if attempt < MAX_RETRIES {
                        let delay = INITIAL_RETRY_DELAY_MS * 2_u64.pow(attempt);
                        tracing::debug!(
                            attempt = attempt + 1,
                            delay_ms = delay,
                            "Retrying after error"
                        );
                        tokio::time::sleep(Duration::from_millis(delay)).await;
                    }
                }
            }
        }

        Err(last_error.unwrap_or_else(|| AddonError::HttpError("All retries failed".to_string())))
    }

    /// Create a new addon client
    pub fn new(base_url: String) -> Result<Self, AddonError> {
        // Validate URL
        if !base_url.starts_with("http://") && !base_url.starts_with("https://") {
            return Err(AddonError::InvalidUrl(
                "URL must start with http:// or https://".to_string(),
            ));
        }

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .user_agent(concat!(
                env!("CARGO_PKG_NAME"),
                "/",
                env!("CARGO_PKG_VERSION")
            ))
            .redirect(reqwest::redirect::Policy::limited(3))
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

        // Check content length
        if let Some(length) = response.content_length() {
            if length > MAX_MANIFEST_SIZE {
                return Err(AddonError::ValidationError(format!(
                    "Manifest size {} exceeds maximum {}",
                    length, MAX_MANIFEST_SIZE
                )));
            }
        }

        let body = response
            .text()
            .await
            .map_err(|e| AddonError::HttpError(e.to_string()))?;

        // Validate size of actual response
        if body.len() > MAX_MANIFEST_SIZE as usize {
            return Err(AddonError::ValidationError(format!(
                "Manifest size {} exceeds maximum {}",
                body.len(),
                MAX_MANIFEST_SIZE
            )));
        }

        let manifest = serde_json::from_str::<AddonManifest>(&body)
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
        let base_url = format!(
            "{}/catalog/{}/{}.json",
            self.base_url, media_type, catalog_id
        );
        let mut url = Url::parse(&base_url).map_err(|e| AddonError::InvalidUrl(e.to_string()))?;

        // Add extra parameters if provided
        if let Some(extra_params) = extra {
            if !extra_params.is_empty() {
                for (k, v) in extra_params {
                    url.query_pairs_mut().append_pair(k, v);
                }
            }
        }

        tracing::info!(url = %url, "Fetching catalog");

        let client = self.client.clone();
        let url_clone = url.clone();

        let response = Self::retry_with_backoff(|| async {
            client
                .get(url_clone.clone())
                .send()
                .await
                .map_err(|e| AddonError::HttpError(e.to_string()))
        })
        .await?;

        if !response.status().is_success() {
            return Err(AddonError::HttpError(format!(
                "HTTP {}: {}",
                response.status(),
                response.text().await.unwrap_or_default()
            )));
        }

        // Check content length
        if let Some(length) = response.content_length() {
            if length > MAX_RESPONSE_SIZE {
                return Err(AddonError::ValidationError(format!(
                    "Response size {} exceeds maximum {}",
                    length, MAX_RESPONSE_SIZE
                )));
            }
        }

        let catalog = response
            .json::<CatalogResponse>()
            .await
            .map_err(|e| AddonError::ParseError(e.to_string()))?;

        // Limit catalog size
        if catalog.metas.len() > MAX_CATALOG_ITEMS {
            tracing::warn!(
                "Catalog has {} items, limiting to {}",
                catalog.metas.len(),
                MAX_CATALOG_ITEMS
            );
            let mut limited_catalog = catalog;
            limited_catalog.metas.truncate(MAX_CATALOG_ITEMS);
            return Ok(limited_catalog);
        }

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

        let client = self.client.clone();
        let url_clone = url.clone();

        let response = Self::retry_with_backoff(|| async {
            client
                .get(url_clone.clone())
                .send()
                .await
                .map_err(|e| AddonError::HttpError(e.to_string()))
        })
        .await?;

        if !response.status().is_success() {
            return Err(AddonError::HttpError(format!(
                "HTTP {}: {}",
                response.status(),
                response.text().await.unwrap_or_default()
            )));
        }

        // Check content length
        if let Some(length) = response.content_length() {
            if length > MAX_RESPONSE_SIZE {
                return Err(AddonError::ValidationError(format!(
                    "Response size {} exceeds maximum {}",
                    length, MAX_RESPONSE_SIZE
                )));
            }
        }

        let mut streams = response
            .json::<StreamResponse>()
            .await
            .map_err(|e| AddonError::ParseError(e.to_string()))?;

        // Validate stream URLs (security check)
        streams
            .streams
            .retain(|stream| Self::validate_stream_url(&stream.url));

        if streams.streams.is_empty() {
            return Err(AddonError::ValidationError(
                "No valid streams found (all URLs failed validation)".to_string(),
            ));
        }

        tracing::info!(
            media_type = %media_type,
            media_id = %media_id,
            stream_count = streams.streams.len(),
            "Successfully fetched streams"
        );

        Ok(streams)
    }

    /// Fetch subtitles for a media item
    pub async fn get_subtitles(
        &self,
        media_type: &str,
        media_id: &str,
    ) -> Result<SubtitlesResponse, AddonError> {
        let url = format!("{}/subtitles/{}/{}.json", self.base_url, media_type, media_id);

        tracing::info!(url = %url, "Fetching subtitles");

        let client = self.client.clone();
        let url_clone = url.clone();

        let response = Self::retry_with_backoff(|| async {
            client
                .get(url_clone.clone())
                .send()
                .await
                .map_err(|e| AddonError::HttpError(e.to_string()))
        })
        .await?;

        if !response.status().is_success() {
            return Err(AddonError::HttpError(format!(
                "HTTP {}: {}",
                response.status(),
                response.text().await.unwrap_or_default()
            )));
        }

        if let Some(length) = response.content_length() {
            if length > MAX_RESPONSE_SIZE {
                return Err(AddonError::ValidationError(format!(
                    "Response size {} exceeds maximum {}",
                    length, MAX_RESPONSE_SIZE
                )));
            }
        }

        let mut subs = response
            .json::<SubtitlesResponse>()
            .await
            .map_err(|e| AddonError::ParseError(e.to_string()))?;

        // Validate subtitle URLs
        subs.subtitles
            .retain(|s| Self::validate_stream_url(&s.url));

        Ok(subs)
    }

    /// Validate manifest with comprehensive checks
    fn validate_manifest(manifest: &AddonManifest) -> Result<(), AddonError> {
        // ID validation
        if manifest.id.is_empty() {
            return Err(AddonError::ValidationError(
                "Manifest ID is required".to_string(),
            ));
        }

        // ID length check (reasonable limit)
        if manifest.id.len() > 100 {
            return Err(AddonError::ValidationError(
                "Manifest ID must be less than 100 characters".to_string(),
            ));
        }

        // ID must be alphanumeric with hyphens/underscores/dots only
        if !manifest
            .id
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.')
        {
            return Err(AddonError::ValidationError(
                "Manifest ID must contain only alphanumeric characters, hyphens, underscores, and dots"
                    .to_string(),
            ));
        }

        // Name validation
        if manifest.name.is_empty() {
            return Err(AddonError::ValidationError(
                "Manifest name is required".to_string(),
            ));
        }

        if manifest.name.len() > 200 {
            return Err(AddonError::ValidationError(
                "Manifest name must be less than 200 characters".to_string(),
            ));
        }

        // Description validation
        if manifest.description.len() > 5000 {
            return Err(AddonError::ValidationError(
                "Manifest description must be less than 5000 characters".to_string(),
            ));
        }

        // Version validation (semver)
        if manifest.version.is_empty() {
            return Err(AddonError::ValidationError(
                "Manifest version is required".to_string(),
            ));
        }

        let version_parts: Vec<&str> = manifest.version.split('.').collect();
        if version_parts.len() < 2 || version_parts.len() > 4 {
            return Err(AddonError::ValidationError(
                "Manifest version must follow semver format (e.g., 1.0.0 or 1.0.0-beta)"
                    .to_string(),
            ));
        }

        // Validate major.minor.patch are numeric
        for (i, part) in version_parts.iter().take(3).enumerate() {
            let clean_part = part.split('-').next().unwrap_or(part);
            if clean_part.parse::<u32>().is_err() {
                return Err(AddonError::ValidationError(format!(
                    "Version part {} must be numeric: {}",
                    i + 1,
                    part
                )));
            }
        }

        // Resources validation
        if manifest.resources.is_empty() {
            return Err(AddonError::ValidationError(
                "At least one resource is required".to_string(),
            ));
        }

        // Validate resource combinations
        let has_catalog = manifest.resources.contains(&ResourceType::Catalog);
        let has_stream = manifest.resources.contains(&ResourceType::Stream);
        let has_meta = manifest.resources.contains(&ResourceType::Meta);

        if has_catalog {
            // If catalog resource is provided, must have catalogs defined
            if manifest.catalogs.is_empty() {
                return Err(AddonError::ValidationError(
                    "Catalog resource requires at least one catalog descriptor".to_string(),
                ));
            }

            // Must have at least one media type
            if manifest.types.is_empty() {
                return Err(AddonError::ValidationError(
                    "Catalog resource requires at least one media type".to_string(),
                ));
            }

            // Validate each catalog
            for catalog in &manifest.catalogs {
                Self::validate_catalog_descriptor(catalog)?;

                // Catalog media type must be in manifest types
                if !manifest.types.contains(&catalog.media_type) {
                    return Err(AddonError::ValidationError(format!(
                        "Catalog '{}' has media type {:?} not listed in manifest types",
                        catalog.id, catalog.media_type
                    )));
                }
            }
        }

        // Validate stream or meta resources need media types
        if (has_stream || has_meta) && manifest.types.is_empty() {
            return Err(AddonError::ValidationError(
                "Stream or Meta resources require at least one media type".to_string(),
            ));
        }

        // Validate id_prefixes if provided
        if !manifest.id_prefixes.is_empty() {
            for prefix in &manifest.id_prefixes {
                if prefix.is_empty() {
                    return Err(AddonError::ValidationError(
                        "ID prefix cannot be empty".to_string(),
                    ));
                }
                if prefix.len() > 50 {
                    return Err(AddonError::ValidationError(
                        "ID prefix must be less than 50 characters".to_string(),
                    ));
                }
            }
        }

        tracing::debug!(
            addon_id = %manifest.id,
            resources = ?manifest.resources,
            types = ?manifest.types,
            catalogs = manifest.catalogs.len(),
            "Manifest validation passed"
        );

        Ok(())
    }

    /// Validate catalog descriptor
    fn validate_catalog_descriptor(catalog: &CatalogDescriptor) -> Result<(), AddonError> {
        if catalog.id.is_empty() {
            return Err(AddonError::ValidationError(
                "Catalog ID is required".to_string(),
            ));
        }

        if catalog.id.len() > 100 {
            return Err(AddonError::ValidationError(
                "Catalog ID must be less than 100 characters".to_string(),
            ));
        }

        // Catalog ID should be URL-safe
        if !catalog
            .id
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
        {
            return Err(AddonError::ValidationError(
                format!(
                    "Catalog ID '{}' must contain only alphanumeric characters, hyphens, and underscores",
                    catalog.id
                ),
            ));
        }

        if catalog.name.is_empty() {
            return Err(AddonError::ValidationError(
                "Catalog name is required".to_string(),
            ));
        }

        if catalog.name.len() > 200 {
            return Err(AddonError::ValidationError(
                "Catalog name must be less than 200 characters".to_string(),
            ));
        }

        // Validate extra fields
        for extra in &catalog.extra {
            Self::validate_extra_field(extra)?;
        }

        Ok(())
    }

    /// Validate extra field
    fn validate_extra_field(extra: &ExtraField) -> Result<(), AddonError> {
        if extra.name.is_empty() {
            return Err(AddonError::ValidationError(
                "Extra field name is required".to_string(),
            ));
        }

        if extra.name.len() > 50 {
            return Err(AddonError::ValidationError(
                "Extra field name must be less than 50 characters".to_string(),
            ));
        }

        // Validate options if provided
        if !extra.options.is_empty() {
            if extra.options.len() > 100 {
                return Err(AddonError::ValidationError(format!(
                    "Extra field '{}' has too many options (max 100)",
                    extra.name
                )));
            }

            for option in &extra.options {
                if option.len() > 200 {
                    return Err(AddonError::ValidationError(format!(
                        "Option value in extra field '{}' is too long (max 200 characters)",
                        extra.name
                    )));
                }
            }
        }

        // Validate options_limit
        if let Some(limit) = extra.options_limit {
            if limit == 0 || limit > 100 {
                return Err(AddonError::ValidationError(format!(
                    "Extra field '{}' options_limit must be between 1 and 100",
                    extra.name
                )));
            }
        }

        Ok(())
    }

    /// Validate stream URL (security check)
    fn validate_stream_url(url_str: &str) -> bool {
        match Url::parse(url_str) {
            Ok(url) => {
                // Only allow http and https protocols
                let scheme = url.scheme();
                if scheme != "http" && scheme != "https" {
                    tracing::warn!(url = %url_str, "Rejected stream URL with invalid protocol: {}", scheme);
                    return false;
                }

                // Validate hostname exists
                if url.host_str().is_none() {
                    tracing::warn!(url = %url_str, "Rejected stream URL without hostname");
                    return false;
                }

                true
            }
            Err(e) => {
                tracing::warn!(url = %url_str, error = %e, "Rejected malformed stream URL");
                false
            }
        }
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
