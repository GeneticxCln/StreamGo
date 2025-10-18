/**
 * Local Media Scanner Module
 *
 * Scans local filesystem for video files and integrates them with StreamGo library
 */
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tracing::{debug, error, info, warn};

const TMDB_BASE_URL: &str = "https://api.themoviedb.org/3";

/// Supported video file extensions
const VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "mpg", "mpeg", "3gp", "ogv", "ts",
    "m2ts", "vob", "divx", "xvid",
];

/// Local media file information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalMediaFile {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub title: String,
    pub year: Option<u32>,
    pub season: Option<u32>,
    pub episode: Option<u32>,
    pub duration: Option<f64>,
    pub resolution: Option<String>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub tmdb_id: Option<String>,
    pub imdb_id: Option<String>,
    pub poster_url: Option<String>,
    pub added_at: chrono::DateTime<chrono::Utc>,
    pub last_modified: chrono::DateTime<chrono::Utc>,
}

/// Parsed filename information
#[derive(Debug, Clone)]
pub struct ParsedFilename {
    pub title: String,
    pub year: Option<u32>,
    pub season: Option<u32>,
    pub episode: Option<u32>,
    pub quality: Option<String>,
}

/// FFmpeg probe result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoMetadata {
    pub duration: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub bitrate: Option<u64>,
    pub fps: Option<f64>,
}

/// Local media scanner
pub struct LocalMediaScanner {
    scan_paths: Vec<PathBuf>,
}

impl LocalMediaScanner {
    /// Create new scanner with scan paths
    pub fn new(scan_paths: Vec<PathBuf>) -> Self {
        Self { scan_paths }
    }

    /// Scan all configured paths
    pub async fn scan_all(&self) -> Result<Vec<LocalMediaFile>> {
        let mut all_files = Vec::new();

        for path in &self.scan_paths {
            info!("Scanning path: {}", path.display());
            match self.scan_directory(path).await {
                Ok(files) => {
                    info!("Found {} files in {}", files.len(), path.display());
                    all_files.extend(files);
                }
                Err(e) => {
                    error!(error = %e, path = %path.display(), "Failed to scan directory");
                }
            }
        }

        info!("Total files found: {}", all_files.len());
        Ok(all_files)
    }

    /// Scan a single directory recursively
    pub async fn scan_directory(&self, path: &Path) -> Result<Vec<LocalMediaFile>> {
        let mut files = Vec::new();

        if !path.exists() {
            return Err(anyhow!("Path does not exist: {}", path.display()));
        }

        if !path.is_dir() {
            return Err(anyhow!("Path is not a directory: {}", path.display()));
        }

        // Walk directory recursively
        for entry in walkdir::WalkDir::new(path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let entry_path = entry.path();

            // Skip directories
            if entry_path.is_dir() {
                continue;
            }

            // Check if it's a video file
            if is_video_file(entry_path) {
                debug!("Found video file: {}", entry_path.display());

                match self.process_video_file(entry_path).await {
                    Ok(file) => files.push(file),
                    Err(e) => {
                        warn!(
                            error = %e,
                            path = %entry_path.display(),
                            "Failed to process video file"
                        );
                    }
                }
            }
        }

        Ok(files)
    }

    /// Process a single video file with optional TMDB matching
    async fn process_video_file(&self, path: &Path) -> Result<LocalMediaFile> {
        self.process_video_file_with_tmdb(path, true).await
    }

    /// Process a single video file with optional TMDB matching control
    async fn process_video_file_with_tmdb(&self, path: &Path, enable_tmdb: bool) -> Result<LocalMediaFile> {
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| anyhow!("Invalid filename"))?
            .to_string();

        let metadata = std::fs::metadata(path)?;
        let file_size = metadata.len();
        let last_modified = metadata
            .modified()
            .ok()
            .and_then(|t| {
                let dt: chrono::DateTime<chrono::Utc> = t.into();
                Some(dt)
            });

        // Parse filename
        let parsed = parse_filename(&file_name);
        debug!(
            title = %parsed.title,
            year = ?parsed.year,
            season = ?parsed.season,
            episode = ?parsed.episode,
            "Parsed filename"
        );

        // Probe video metadata with FFmpeg
        let video_meta = probe_video_metadata(path).await.ok();

        // Generate unique ID from file path hash
        let digest = md5::compute(path.to_string_lossy().as_bytes());
        let id = format!("local:{:x}", digest);

        // Try to match with TMDB if enabled
        let (tmdb_id, imdb_id, poster_url, enriched_title) = if enable_tmdb {
            match match_tmdb_metadata(&parsed.title, parsed.year, parsed.season).await {
                Ok(tmdb_match) => {
                    debug!(
                        original_title = %parsed.title,
                        tmdb_title = %tmdb_match.title,
                        "TMDB match found"
                    );
                    (
                        Some(tmdb_match.tmdb_id),
                        tmdb_match.imdb_id,
                        tmdb_match.poster_url,
                        tmdb_match.title,
                    )
                }
                Err(e) => {
                    debug!(error = %e, title = %parsed.title, "No TMDB match found");
                    (None, None, None, parsed.title.clone())
                }
            }
        } else {
            (None, None, None, parsed.title.clone())
        };

        Ok(LocalMediaFile {
            id,
            file_path: path.to_string_lossy().to_string(),
            file_name,
            file_size,
            title: enriched_title,
            year: parsed.year,
            season: parsed.season,
            episode: parsed.episode,
            duration: video_meta.as_ref().and_then(|m| m.duration),
            resolution: video_meta.as_ref().and_then(|m| {
                m.width
                    .zip(m.height)
                    .map(|(w, h)| format!("{}x{}", w, h))
            }),
            video_codec: video_meta.as_ref().and_then(|m| m.video_codec.clone()),
            audio_codec: video_meta.as_ref().and_then(|m| m.audio_codec.clone()),
            tmdb_id,
            imdb_id,
            poster_url,
            added_at: chrono::Utc::now(),
            last_modified: last_modified.unwrap_or_else(chrono::Utc::now),
        })
    }
}

/// TMDB match result
#[derive(Debug, Clone)]
pub struct TmdbMatch {
    pub tmdb_id: String,
    pub imdb_id: Option<String>,
    pub title: String,
    pub poster_url: Option<String>,
}

/// Match local file against TMDB
pub async fn match_tmdb_metadata(
    title: &str,
    year: Option<u32>,
    season: Option<u32>,
) -> Result<TmdbMatch> {
    let api_key = std::env::var("TMDB_API_KEY")
        .map_err(|_| anyhow!("TMDB_API_KEY not set"))?;

    // Determine media type: TV show if season is present, movie otherwise
    let is_tv = season.is_some();
    let media_type = if is_tv { "tv" } else { "movie" };

    // Search TMDB
    let client = reqwest::Client::new();
    let url = format!("{}/search/{}", TMDB_BASE_URL, media_type);

    let response = client
        .get(&url)
        .query(&[("api_key", &api_key), ("query", &title.to_string())])
        .send()
        .await?;

    let json: serde_json::Value = response.json().await?;
    let empty_results = vec![];
    let results = json["results"].as_array().unwrap_or(&empty_results);

    // Find best match based on year if provided
    let mut best_match: Option<&serde_json::Value> = None;
    let mut best_score = 0;

    for result in results {
        let mut score = 10; // Base score for any result

        // Match year if provided
        if let Some(target_year) = year {
            let result_year = if is_tv {
                result["first_air_date"]
                    .as_str()
                    .and_then(|d| d.split('-').next())
                    .and_then(|y| y.parse::<u32>().ok())
            } else {
                result["release_date"]
                    .as_str()
                    .and_then(|d| d.split('-').next())
                    .and_then(|y| y.parse::<u32>().ok())
            };

            if let Some(result_year) = result_year {
                let year_diff = (target_year as i32 - result_year as i32).abs();
                if year_diff == 0 {
                    score += 50; // Exact year match
                } else if year_diff == 1 {
                    score += 30; // Off by one year
                } else if year_diff <= 3 {
                    score += 10; // Close year
                }
            }
        }

        // Boost score for popularity
        if let Some(popularity) = result["popularity"].as_f64() {
            score += (popularity / 10.0).min(20.0) as i32;
        }

        if score > best_score {
            best_score = score;
            best_match = Some(result);
        }
    }

    let result = best_match.ok_or_else(|| anyhow!("No TMDB match found"))?;

    // Get TMDB ID
    let tmdb_id = result["id"]
        .as_u64()
        .ok_or_else(|| anyhow!("No TMDB ID"))?;

    // Get title
    let matched_title = if is_tv {
        result["name"].as_str()
    } else {
        result["title"].as_str()
    }
    .ok_or_else(|| anyhow!("No title"))?;

    // Get poster
    let poster_url = result["poster_path"]
        .as_str()
        .map(|path| format!("https://image.tmdb.org/t/p/w500{}", path));

    // Try to get IMDB ID (requires additional API call)
    let imdb_id = get_imdb_id_from_tmdb(tmdb_id, media_type, &api_key).await.ok();

    Ok(TmdbMatch {
        tmdb_id: tmdb_id.to_string(),
        imdb_id,
        title: matched_title.to_string(),
        poster_url,
    })
}

/// Get IMDB ID from TMDB ID
async fn get_imdb_id_from_tmdb(
    tmdb_id: u64,
    media_type: &str,
    api_key: &str,
) -> Result<String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/{}/{}/external_ids",
        TMDB_BASE_URL, media_type, tmdb_id
    );

    let response = client
        .get(&url)
        .query(&[("api_key", api_key)])
        .send()
        .await?;

    let json: serde_json::Value = response.json().await?;
    let imdb_id = json["imdb_id"]
        .as_str()
        .ok_or_else(|| anyhow!("No IMDB ID"))?;

    Ok(imdb_id.to_string())
}

/// Check if file is a video based on extension
pub fn is_video_file<P: AsRef<Path>>(path: P) -> bool {
    path.as_ref()
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| VIDEO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Parse filename to extract metadata
pub fn parse_filename(filename: &str) -> ParsedFilename {
    use regex::Regex;

    // Remove file extension
    let name = filename
        .rsplit('.')
        .skip(1)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join(".");

    // Clean up common patterns
    let cleaned = name
        .replace('.', " ")
        .replace('_', " ")
        .replace('-', " ");

    // Try to extract year (1900-2099)
    let year_re = Regex::new(r"\b(19\d{2}|20\d{2})\b").unwrap();
    let year = year_re
        .find(&cleaned)
        .and_then(|m| m.as_str().parse::<u32>().ok());

    // Try to extract season/episode patterns
    // Patterns: S01E01, s01e01, 1x01, Season 1 Episode 1
    let se_re = Regex::new(r"(?i)[Ss](\d{1,2})[Ee](\d{1,2})").unwrap();
    let x_re = Regex::new(r"(?i)(\d{1,2})x(\d{1,2})").unwrap();

    let (season, episode) = if let Some(caps) = se_re.captures(&cleaned) {
        (
            caps.get(1).and_then(|m| m.as_str().parse().ok()),
            caps.get(2).and_then(|m| m.as_str().parse().ok()),
        )
    } else if let Some(caps) = x_re.captures(&cleaned) {
        (
            caps.get(1).and_then(|m| m.as_str().parse().ok()),
            caps.get(2).and_then(|m| m.as_str().parse().ok()),
        )
    } else {
        (None, None)
    };

    // Extract quality/resolution hints
    let quality_re = Regex::new(r"(?i)(2160p|1080p|720p|480p|4K|UHD)").unwrap();
    let quality = quality_re
        .find(&cleaned)
        .map(|m| m.as_str().to_uppercase());

    // Extract title (everything before year or quality indicators)
    let mut title = cleaned.clone();

    // Remove year
    if let Some(y) = year {
        title = title.replace(&y.to_string(), "");
    }

    // Remove season/episode
    if let Some(caps) = se_re.captures(&title) {
        title = title.replace(caps.get(0).unwrap().as_str(), "");
    }
    if let Some(caps) = x_re.captures(&title) {
        title = title.replace(caps.get(0).unwrap().as_str(), "");
    }

    // Remove quality
    if let Some(q) = &quality {
        title = title.replace(q, "");
    }

    // Remove common tags/patterns
    let tags = [
        "BluRay",
        "BRRip",
        "WEBRip",
        "HDRip",
        "DVDRip",
        "HDTV",
        "WEB-DL",
        "x264",
        "x265",
        "HEVC",
        "AAC",
        "AC3",
        "DTS",
        "YIFY",
        "RARBG",
        "Sample",
    ];
    for tag in &tags {
        title = title.replace(tag, "");
        title = title.replace(&tag.to_lowercase(), "");
    }

    // Clean up whitespace
    title = title.split_whitespace().collect::<Vec<_>>().join(" ");
    title = title.trim().to_string();

    // If title is empty, use original filename
    if title.is_empty() {
        title = name;
    }

    ParsedFilename {
        title,
        year,
        season,
        episode,
        quality,
    }
}

/// Probe video file with FFmpeg
pub async fn probe_video_metadata<P: AsRef<Path>>(path: P) -> Result<VideoMetadata> {
    let path_str = path.as_ref().to_string_lossy().to_string();

    tokio::task::spawn_blocking(move || {
        use std::process::Command;

        // Run ffprobe
        let output = Command::new("ffprobe")
            .args([
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                &path_str,
            ])
            .output()
            .map_err(|e| anyhow!("Failed to run ffprobe: {}. Is FFmpeg installed?", e))?;

        if !output.status.success() {
            return Err(anyhow!("ffprobe failed"));
        }

        let json: serde_json::Value = serde_json::from_slice(&output.stdout)?;

        // Extract format info
        let format = json.get("format");
        let duration = format
            .and_then(|f| f.get("duration"))
            .and_then(|d| d.as_str())
            .and_then(|s| s.parse::<f64>().ok());

        let bitrate = format
            .and_then(|f| f.get("bit_rate"))
            .and_then(|b| b.as_str())
            .and_then(|s| s.parse::<u64>().ok());

        // Extract video stream info
        let streams = json.get("streams").and_then(|s| s.as_array());
        let video_stream = streams
            .and_then(|arr| {
                arr.iter()
                    .find(|s| s.get("codec_type").and_then(|t| t.as_str()) == Some("video"))
            });

        let width = video_stream
            .and_then(|s| s.get("width"))
            .and_then(|w| w.as_u64())
            .map(|w| w as u32);

        let height = video_stream
            .and_then(|s| s.get("height"))
            .and_then(|h| h.as_u64())
            .map(|h| h as u32);

        let video_codec = video_stream
            .and_then(|s| s.get("codec_name"))
            .and_then(|c| c.as_str())
            .map(String::from);

        let fps = video_stream
            .and_then(|s| s.get("r_frame_rate"))
            .and_then(|f| f.as_str())
            .and_then(|s| {
                let parts: Vec<&str> = s.split('/').collect();
                if parts.len() == 2 {
                    let num = parts[0].parse::<f64>().ok()?;
                    let den = parts[1].parse::<f64>().ok()?;
                    Some(num / den)
                } else {
                    None
                }
            });

        // Extract audio stream info
        let audio_stream = streams.and_then(|arr| {
            arr.iter()
                .find(|s| s.get("codec_type").and_then(|t| t.as_str()) == Some("audio"))
        });

        let audio_codec = audio_stream
            .and_then(|s| s.get("codec_name"))
            .and_then(|c| c.as_str())
            .map(String::from);

        Ok(VideoMetadata {
            duration,
            width,
            height,
            video_codec,
            audio_codec,
            bitrate,
            fps,
        })
    })
    .await
    .map_err(|e| anyhow!("Task join error: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_video_file() {
        assert!(is_video_file("movie.mp4"));
        assert!(is_video_file("video.mkv"));
        assert!(is_video_file("show.avi"));
        assert!(!is_video_file("subtitle.srt"));
        assert!(!is_video_file("readme.txt"));
    }

    #[test]
    fn test_parse_filename_movie() {
        let parsed = parse_filename("The.Shawshank.Redemption.1994.1080p.BluRay.x264.mp4");
        assert_eq!(parsed.title, "The Shawshank Redemption");
        assert_eq!(parsed.year, Some(1994));
        assert_eq!(parsed.season, None);
        assert_eq!(parsed.episode, None);
    }

    #[test]
    fn test_parse_filename_tv_show() {
        let parsed = parse_filename("Breaking.Bad.S01E01.Pilot.1080p.WEBRip.x264.mkv");
        assert_eq!(parsed.title, "Breaking Bad Pilot");
        assert_eq!(parsed.season, Some(1));
        assert_eq!(parsed.episode, Some(1));
    }

    #[test]
    fn test_parse_filename_alternate_format() {
        let parsed = parse_filename("Game.of.Thrones.1x01.Winter.is.Coming.720p.mkv");
        assert!(parsed.title.contains("Game of Thrones"));
        assert_eq!(parsed.season, Some(1));
        assert_eq!(parsed.episode, Some(1));
    }
}
