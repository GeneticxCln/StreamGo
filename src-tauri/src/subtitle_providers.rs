/**
 * Subtitle Providers Module
 *
 * Automatic subtitle fetching from OpenSubtitles and SubDB
 */
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use tracing::{debug, error, info, warn};

/// Subtitle search result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubtitleResult {
    pub id: String,
    pub language: String,
    pub language_code: String,
    pub file_name: String,
    pub download_url: String,
    pub score: f32,
    pub provider: SubtitleProvider,
    pub format: String,
    pub hearing_impaired: bool,
    pub download_count: Option<u32>,
    pub rating: Option<f32>,
}

/// Subtitle provider
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SubtitleProvider {
    OpenSubtitles,
    SubDB,
}

/// OpenSubtitles API client
pub struct OpenSubtitlesClient {
    api_key: Option<String>,
    user_agent: String,
    base_url: String,
}

impl OpenSubtitlesClient {
    /// Create new OpenSubtitles client
    pub fn new(api_key: Option<String>) -> Self {
        Self {
            api_key,
            user_agent: format!("StreamGo v{}", env!("CARGO_PKG_VERSION")),
            base_url: "https://api.opensubtitles.com/api/v1".to_string(),
        }
    }

    /// Search subtitles by IMDB ID
    pub async fn search_by_imdb(
        &self,
        imdb_id: &str,
        languages: &[&str],
    ) -> Result<Vec<SubtitleResult>> {
        let api_key = self.api_key.as_ref().ok_or_else(|| {
            anyhow!("OpenSubtitles API key not configured. Get one at https://www.opensubtitles.com/api")
        })?;

        debug!(imdb_id = %imdb_id, "Searching OpenSubtitles by IMDB ID");

        let languages_str = languages.join(",");
        let url = format!(
            "{}/subtitles?imdb_id={}&languages={}",
            self.base_url,
            imdb_id.trim_start_matches("tt"),
            languages_str
        );

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .header("Api-Key", api_key)
            .header("User-Agent", &self.user_agent)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            error!(status = %status, body = %body, "OpenSubtitles API error");
            return Err(anyhow!("OpenSubtitles API error: {}", status));
        }

        let json: serde_json::Value = response.json().await?;
        let data = json
            .get("data")
            .and_then(|d| d.as_array())
            .ok_or_else(|| anyhow!("Invalid OpenSubtitles response"))?;

        let mut results = Vec::new();
        for item in data {
            if let Some(result) = self.parse_subtitle_item(item) {
                results.push(result);
            }
        }

        info!("Found {} subtitles on OpenSubtitles", results.len());
        Ok(results)
    }

    /// Search subtitles by file hash
    pub async fn search_by_hash(
        &self,
        file_hash: &str,
        file_size: u64,
        languages: &[&str],
    ) -> Result<Vec<SubtitleResult>> {
        let api_key = self.api_key.as_ref().ok_or_else(|| {
            anyhow!("OpenSubtitles API key not configured")
        })?;

        debug!(file_hash = %file_hash, file_size = file_size, "Searching OpenSubtitles by hash");

        let languages_str = languages.join(",");
        let url = format!(
            "{}/subtitles?moviehash={}&moviebytesize={}&languages={}",
            self.base_url, file_hash, file_size, languages_str
        );

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .header("Api-Key", api_key)
            .header("User-Agent", &self.user_agent)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            warn!(status = %status, "OpenSubtitles hash search failed");
            return Ok(Vec::new()); // Return empty instead of error
        }

        let json: serde_json::Value = response.json().await?;
        let empty_vec = Vec::new();
        let data = json
            .get("data")
            .and_then(|d| d.as_array())
            .unwrap_or(&empty_vec);

        let mut results = Vec::new();
        for item in data {
            if let Some(result) = self.parse_subtitle_item(item) {
                results.push(result);
            }
        }

        info!("Found {} subtitles by hash on OpenSubtitles", results.len());
        Ok(results)
    }

    /// Parse subtitle item from API response
    fn parse_subtitle_item(&self, item: &serde_json::Value) -> Option<SubtitleResult> {
        let attributes = item.get("attributes")?;
        
        let language = attributes
            .get("language")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let language_code = attributes
            .get("language")
            .and_then(|v| v.as_str())
            .unwrap_or("en")
            .to_string();

        let file_name = attributes
            .get("files")
            .and_then(|f| f.as_array())
            .and_then(|arr| arr.first())
            .and_then(|f| f.get("file_name"))
            .and_then(|v| v.as_str())
            .unwrap_or("subtitle.srt")
            .to_string();

        let file_id = attributes
            .get("files")
            .and_then(|f| f.as_array())
            .and_then(|arr| arr.first())
            .and_then(|f| f.get("file_id"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        let download_url = format!("{}/download", self.base_url);
        
        let hearing_impaired = attributes
            .get("hearing_impaired")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let download_count = attributes
            .get("download_count")
            .and_then(|v| v.as_u64())
            .map(|v| v as u32);

        let rating = attributes
            .get("ratings")
            .and_then(|v| v.as_f64())
            .map(|v| v as f32);

        // Calculate score based on download count and rating
        let score = calculate_subtitle_score(download_count, rating, hearing_impaired);

        Some(SubtitleResult {
            id: file_id.to_string(),
            language,
            language_code,
            file_name,
            download_url,
            score,
            provider: SubtitleProvider::OpenSubtitles,
            format: "srt".to_string(),
            hearing_impaired,
            download_count,
            rating,
        })
    }

    /// Download subtitle by ID
    pub async fn download(&self, file_id: &str) -> Result<String> {
        let api_key = self.api_key.as_ref().ok_or_else(|| {
            anyhow!("OpenSubtitles API key not configured")
        })?;

        debug!(file_id = %file_id, "Downloading subtitle from OpenSubtitles");

        let url = format!("{}/download", self.base_url);
        let body = serde_json::json!({
            "file_id": file_id.parse::<u64>().unwrap_or(0)
        });

        let client = reqwest::Client::new();
        let response = client
            .post(&url)
            .header("Api-Key", api_key)
            .header("User-Agent", &self.user_agent)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            error!(status = %status, body = %body, "OpenSubtitles download error");
            return Err(anyhow!("Failed to download subtitle: {}", status));
        }

        let json: serde_json::Value = response.json().await?;
        let download_link = json
            .get("link")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("No download link in response"))?;

        // Download the actual subtitle file
        let subtitle_response = reqwest::get(download_link).await?;
        let subtitle_content = subtitle_response.text().await?;

        info!("Successfully downloaded subtitle from OpenSubtitles");
        Ok(subtitle_content)
    }
}

/// SubDB API client
pub struct SubDBClient {
    user_agent: String,
    base_url: String,
}

impl SubDBClient {
    /// Create new SubDB client
    pub fn new() -> Self {
        Self {
            user_agent: format!("SubDB/1.0 (StreamGo/{})", env!("CARGO_PKG_VERSION")),
            base_url: "http://api.thesubdb.com".to_string(),
        }
    }

    /// Search subtitles by file hash
    pub async fn search_by_hash(
        &self,
        file_hash: &str,
        languages: &[&str],
    ) -> Result<Vec<SubtitleResult>> {
        debug!(file_hash = %file_hash, "Searching SubDB by hash");

        let languages_str = languages.join(",");
        let url = format!(
            "{}/?action=search&hash={}&language={}",
            self.base_url, file_hash, languages_str
        );

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .header("User-Agent", &self.user_agent)
            .send()
            .await?;

        if !response.status().is_success() {
            warn!("SubDB search failed");
            return Ok(Vec::new());
        }

        let available_languages = response.text().await?;
        let mut results = Vec::new();

        for lang in available_languages.split(',') {
            let lang = lang.trim();
            if languages.contains(&lang) {
                results.push(SubtitleResult {
                    id: format!("{}_{}", file_hash, lang),
                    language: lang.to_string(),
                    language_code: lang.to_string(),
                    file_name: format!("subtitle_{}.srt", lang),
                    download_url: format!(
                        "{}/?action=download&hash={}&language={}",
                        self.base_url, file_hash, lang
                    ),
                    score: 0.5, // Lower score than OpenSubtitles
                    provider: SubtitleProvider::SubDB,
                    format: "srt".to_string(),
                    hearing_impaired: false,
                    download_count: None,
                    rating: None,
                });
            }
        }

        info!("Found {} subtitles on SubDB", results.len());
        Ok(results)
    }

    /// Download subtitle
    pub async fn download(&self, file_hash: &str, language: &str) -> Result<String> {
        debug!(file_hash = %file_hash, language = %language, "Downloading subtitle from SubDB");

        let url = format!(
            "{}/?action=download&hash={}&language={}",
            self.base_url, file_hash, language
        );

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .header("User-Agent", &self.user_agent)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("Failed to download subtitle from SubDB"));
        }

        let subtitle_content = response.text().await?;
        info!("Successfully downloaded subtitle from SubDB");
        Ok(subtitle_content)
    }
}

/// Calculate OpenSubtitles hash for a video file
pub fn calculate_opensubtitles_hash<P: AsRef<Path>>(file_path: P) -> Result<(String, u64)> {
    use std::fs::File;

    let mut file = File::open(file_path)?;
    let file_size = file.metadata()?.len();

    if file_size < 65536 {
        return Err(anyhow!("File too small for hash calculation"));
    }

    let mut hash: u64 = file_size;

    // Read first 64KB
    let mut buffer = vec![0u8; 65536];
    file.read_exact(&mut buffer)?;
    
    for chunk in buffer.chunks(8) {
        let value = u64::from_le_bytes([
            chunk[0],
            chunk[1],
            chunk[2],
            chunk[3],
            chunk[4],
            chunk[5],
            chunk[6],
            chunk[7],
        ]);
        hash = hash.wrapping_add(value);
    }

    // Read last 64KB
    file.seek(SeekFrom::End(-65536))?;
    file.read_exact(&mut buffer)?;
    
    for chunk in buffer.chunks(8) {
        let value = u64::from_le_bytes([
            chunk[0],
            chunk[1],
            chunk[2],
            chunk[3],
            chunk[4],
            chunk[5],
            chunk[6],
            chunk[7],
        ]);
        hash = hash.wrapping_add(value);
    }

    Ok((format!("{:016x}", hash), file_size))
}

/// Calculate SubDB hash for a video file
pub fn calculate_subdb_hash<P: AsRef<Path>>(file_path: P) -> Result<String> {
    use std::fs::File;

    let mut file = File::open(file_path)?;
    let file_size = file.metadata()?.len();

    if file_size < 131072 {
        return Err(anyhow!("File too small for hash calculation"));
    }

    let mut combined_buffer = Vec::new();

    // Read first 64KB
    let mut buffer = vec![0u8; 65536];
    file.read_exact(&mut buffer)?;
    combined_buffer.extend_from_slice(&buffer);

    // Read last 64KB
    file.seek(SeekFrom::End(-65536))?;
    file.read_exact(&mut buffer)?;
    combined_buffer.extend_from_slice(&buffer);

    let digest = md5::compute(&combined_buffer);
    Ok(format!("{:x}", digest))
}

/// Calculate subtitle score based on various factors
fn calculate_subtitle_score(
    download_count: Option<u32>,
    rating: Option<f32>,
    hearing_impaired: bool,
) -> f32 {
    let mut score = 0.0;

    // Download count contribution (0-50 points)
    if let Some(count) = download_count {
        score += (count as f32).min(10000.0) / 200.0; // Max 50 points
    }

    // Rating contribution (0-30 points)
    if let Some(r) = rating {
        score += r * 6.0; // Max 30 points (rating 0-5)
    }

    // Penalize hearing impaired slightly (some users prefer them)
    if hearing_impaired {
        score -= 5.0;
    }

    score.max(0.0)
}

/// Subtitle manager for auto-fetching
pub struct SubtitleManager {
    opensubtitles: OpenSubtitlesClient,
    subdb: SubDBClient,
}

impl SubtitleManager {
    /// Create new subtitle manager
    pub fn new(opensubtitles_api_key: Option<String>) -> Self {
        Self {
            opensubtitles: OpenSubtitlesClient::new(opensubtitles_api_key),
            subdb: SubDBClient::new(),
        }
    }

    /// Auto-fetch subtitles for a video file
    pub async fn auto_fetch(
        &self,
        file_path: Option<&str>,
        imdb_id: Option<&str>,
        languages: &[&str],
    ) -> Result<Vec<SubtitleResult>> {
        info!("Auto-fetching subtitles");

        let mut all_results = Vec::new();

        // Search by IMDB ID if provided
        if let Some(id) = imdb_id {
            match self.opensubtitles.search_by_imdb(id, languages).await {
                Ok(results) => all_results.extend(results),
                Err(e) => warn!(error = %e, "OpenSubtitles IMDB search failed"),
            }
        }

        // Search by file hash if file path provided
        if let Some(path) = file_path {
            // Try OpenSubtitles hash
            if let Ok((os_hash, file_size)) = calculate_opensubtitles_hash(path) {
                match self
                    .opensubtitles
                    .search_by_hash(&os_hash, file_size, languages)
                    .await
                {
                    Ok(results) => all_results.extend(results),
                    Err(e) => warn!(error = %e, "OpenSubtitles hash search failed"),
                }
            }

            // Try SubDB hash
            if let Ok(subdb_hash) = calculate_subdb_hash(path) {
                match self.subdb.search_by_hash(&subdb_hash, languages).await {
                    Ok(results) => all_results.extend(results),
                    Err(e) => warn!(error = %e, "SubDB hash search failed"),
                }
            }
        }

        // Sort by score
        all_results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

        info!("Found {} total subtitle matches", all_results.len());
        Ok(all_results)
    }

    /// Download best matching subtitle
    pub async fn download_best(&self, results: &[SubtitleResult]) -> Result<(String, SubtitleResult)> {
        let best = results
            .first()
            .ok_or_else(|| anyhow!("No subtitles available"))?;

        info!(
            provider = ?best.provider,
            language = %best.language,
            score = %best.score,
            "Downloading best subtitle"
        );

        let content = match best.provider {
            SubtitleProvider::OpenSubtitles => {
                self.opensubtitles.download(&best.id).await?
            }
            SubtitleProvider::SubDB => {
                self.subdb
                    .download(&best.id.split('_').next().unwrap_or(&best.id), &best.language_code)
                    .await?
            }
        };

        Ok((content, best.clone()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_score_calculation() {
        // High score subtitle
        let score1 = calculate_subtitle_score(Some(5000), Some(4.5), false);
        assert!(score1 > 40.0);

        // Low score subtitle
        let score2 = calculate_subtitle_score(Some(10), Some(2.0), true);
        assert!(score2 < 20.0);

        // No data
        let score3 = calculate_subtitle_score(None, None, false);
        assert_eq!(score3, 0.0);
    }
}
