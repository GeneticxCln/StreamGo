/**
 * Player Module
 *
 * Advanced player features including subtitles, quality selection, and external player integration
 */
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::process::Command;

/// Video quality options
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[allow(clippy::upper_case_acronyms)] // Standard video quality naming
pub enum VideoQuality {
    #[serde(rename = "4K")]
    UHD, // 2160p
    #[serde(rename = "1080p")]
    FullHD, // 1080p
    #[serde(rename = "720p")]
    HD, // 720p
    #[serde(rename = "480p")]
    SD, // 480p
    #[serde(rename = "360p")]
    Low, // 360p
    #[serde(rename = "auto")]
    Auto, // Automatic quality selection
}

impl VideoQuality {
    pub fn to_height(&self) -> Option<u32> {
        match self {
            VideoQuality::UHD => Some(2160),
            VideoQuality::FullHD => Some(1080),
            VideoQuality::HD => Some(720),
            VideoQuality::SD => Some(480),
            VideoQuality::Low => Some(360),
            VideoQuality::Auto => None,
        }
    }
}

/// Subtitle track information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubtitleTrack {
    pub id: String,
    pub language: String,
    pub label: String,
    pub url: Option<String>, // External subtitle URL
    pub format: SubtitleFormat,
    pub embedded: bool, // Whether subtitle is embedded in video
}

/// Supported subtitle formats
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[allow(clippy::upper_case_acronyms)] // Standard subtitle format names
pub enum SubtitleFormat {
    #[serde(rename = "vtt")]
    WebVTT,
    #[serde(rename = "srt")]
    SRT,
    #[serde(rename = "ass")]
    ASS,
    #[serde(rename = "ssa")]
    SSA,
}

/// Audio track information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct AudioTrack {
    pub id: String,
    pub language: String,
    pub label: String,
    pub codec: String,
    pub channels: u8,
}

/// Video stream with multiple quality options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoStream {
    pub id: String,
    pub title: Option<String>,
    pub quality: VideoQuality,
    pub url: String,
    pub format: String,
    pub bitrate: Option<u32>, // in kbps
    pub codec: Option<String>,
    pub size: Option<u64>, // in bytes
}

/// Complete playback information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct PlaybackInfo {
    pub streams: Vec<VideoStream>,
    pub subtitles: Vec<SubtitleTrack>,
    pub audio_tracks: Vec<AudioTrack>,
    pub default_quality: VideoQuality,
    pub autoplay: bool,
    pub start_position: Option<f64>, // in seconds
}

/// External player configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExternalPlayer {
    VLC,
    MPV,
    IINA, // macOS
    Custom {
        name: String,
        command: String,
        args: Vec<String>,
    },
}

impl ExternalPlayer {
    /// Get command for the player
    pub fn command(&self) -> String {
        match self {
            ExternalPlayer::VLC => {
                if cfg!(target_os = "windows") {
                    "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe".to_string()
                } else if cfg!(target_os = "macos") {
                    "/Applications/VLC.app/Contents/MacOS/VLC".to_string()
                } else {
                    "vlc".to_string()
                }
            }
            ExternalPlayer::MPV => "mpv".to_string(),
            ExternalPlayer::IINA => "/Applications/IINA.app/Contents/MacOS/iina-cli".to_string(),
            ExternalPlayer::Custom { command, .. } => command.clone(),
        }
    }

    /// Check if player is available on the system
    pub fn is_available(&self) -> bool {
        let command = self.command();
        let check_cmd = if cfg!(target_os = "windows") {
            Command::new("where").arg(&command).output()
        } else {
            Command::new("which").arg(&command).output()
        };

        check_cmd
            .map(|output| output.status.success())
            .unwrap_or(false)
    }

    /// Launch external player with video URL
    pub fn launch(&self, url: &str, subtitle_path: Option<&str>) -> Result<()> {
        let command = self.command();

        let mut cmd = Command::new(&command);

        match self {
            ExternalPlayer::VLC => {
                cmd.arg(url);
                if let Some(sub_path) = subtitle_path {
                    cmd.arg("--sub-file").arg(sub_path);
                }
            }
            ExternalPlayer::MPV => {
                cmd.arg(url);
                if let Some(sub_path) = subtitle_path {
                    cmd.arg(format!("--sub-file={}", sub_path));
                }
                cmd.arg("--force-window=yes");
            }
            ExternalPlayer::IINA => {
                cmd.arg(url);
                if let Some(sub_path) = subtitle_path {
                    cmd.arg("--sub-file").arg(sub_path);
                }
            }
            ExternalPlayer::Custom { args, .. } => {
                for arg in args {
                    let formatted_arg = arg
                        .replace("{url}", url)
                        .replace("{subtitle}", subtitle_path.unwrap_or(""));
                    cmd.arg(formatted_arg);
                }
            }
        }

        cmd.spawn()
            .map_err(|e| anyhow!("Failed to launch {}: {}", command, e))?;

        Ok(())
    }
}

/// Player manager for handling playback
pub struct PlayerManager {
    external_player: Option<ExternalPlayer>,
}

impl PlayerManager {
    pub fn new() -> Self {
        Self {
            external_player: None,
        }
    }

    /// Set external player
    pub fn set_external_player(&mut self, player: ExternalPlayer) {
        self.external_player = Some(player);
    }

    /// Get available external players
    pub fn get_available_players() -> Vec<ExternalPlayer> {
        let players = vec![
            ExternalPlayer::VLC,
            ExternalPlayer::MPV,
            ExternalPlayer::IINA,
        ];

        players.into_iter().filter(|p| p.is_available()).collect()
    }

    /// Play video with external player
    pub fn play_external(
        &self,
        stream: &VideoStream,
        subtitle: Option<&SubtitleTrack>,
    ) -> Result<()> {
        let player = self
            .external_player
            .as_ref()
            .ok_or_else(|| anyhow!("No external player configured"))?;

        let subtitle_path = if let Some(sub) = subtitle {
            sub.url.as_deref()
        } else {
            None
        };

        player.launch(&stream.url, subtitle_path)
    }

    /// Select best quality stream based on preferences
    pub fn select_quality(
        streams: &[VideoStream],
        preferred_quality: VideoQuality,
    ) -> Option<&VideoStream> {
        if streams.is_empty() {
            return None;
        }

        // Try to find exact match
        if let Some(stream) = streams.iter().find(|s| s.quality == preferred_quality) {
            return Some(stream);
        }

        // If auto or not found, select highest quality
        if preferred_quality == VideoQuality::Auto {
            return streams.iter().max_by_key(|s| s.bitrate.unwrap_or(0));
        }

        // Find closest quality
        let target_height = preferred_quality.to_height();
        if let Some(height) = target_height {
            streams.iter().min_by_key(|s| {
                let stream_height = s.quality.to_height().unwrap_or(0);
                ((stream_height as i32) - (height as i32)).abs()
            })
        } else {
            streams.first()
        }
    }
}

impl Default for PlayerManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Subtitle downloader and parser
pub struct SubtitleManager;

impl SubtitleManager {
    /// Download subtitle from URL
    pub async fn download_subtitle(url: &str) -> Result<String> {
        let client = reqwest::Client::new();
        let response = client.get(url).send().await?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "Failed to download subtitle: HTTP {}",
                response.status()
            ));
        }

        let content = response.text().await?;
        Ok(content)
    }

    /// Convert SRT to WebVTT format
    pub fn srt_to_vtt(srt_content: &str) -> Result<String> {
        let mut vtt = String::from("WEBVTT\n\n");

        // Replace SRT time format (00:00:00,000) with WebVTT format (00:00:00.000)
        let converted = srt_content.replace(',', ".");
        vtt.push_str(&converted);

        Ok(vtt)
    }

    /// Parse WebVTT subtitle
    pub fn parse_vtt(vtt_content: &str) -> Result<Vec<SubtitleCue>> {
        let mut cues = Vec::new();
        let lines: Vec<&str> = vtt_content.lines().collect();

        let mut i = 0;
        while i < lines.len() {
            let line = lines[i].trim();

            // Skip empty lines and header
            if line.is_empty() || line.starts_with("WEBVTT") {
                i += 1;
                continue;
            }

            // Look for timestamp line
            if line.contains("-->") {
                let parts: Vec<&str> = line.split("-->").collect();
                if parts.len() == 2 {
                    let start = parts[0].trim();
                    let end = parts[1].split_whitespace().next().unwrap_or("");

                    // Collect text lines
                    i += 1;
                    let mut text = String::new();
                    while i < lines.len()
                        && !lines[i].trim().is_empty()
                        && !lines[i].contains("-->")
                    {
                        if !text.is_empty() {
                            text.push('\n');
                        }
                        text.push_str(lines[i].trim());
                        i += 1;
                    }

                    cues.push(SubtitleCue {
                        start: start.to_string(),
                        end: end.to_string(),
                        text,
                    });
                }
            }

            i += 1;
        }

        Ok(cues)
    }
}

/// Subtitle cue (single subtitle entry)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubtitleCue {
    pub start: String,
    pub end: String,
    pub text: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quality_height() {
        assert_eq!(VideoQuality::UHD.to_height(), Some(2160));
        assert_eq!(VideoQuality::FullHD.to_height(), Some(1080));
        assert_eq!(VideoQuality::Auto.to_height(), None);
    }

    #[test]
    fn test_select_quality() {
        let streams = vec![
            VideoStream {
                id: "1".to_string(),
                title: None,
                quality: VideoQuality::HD,
                url: "test1".to_string(),
                format: "mp4".to_string(),
                bitrate: Some(5000),
                codec: None,
                size: None,
            },
            VideoStream {
                id: "2".to_string(),
                title: None,
                quality: VideoQuality::FullHD,
                url: "test2".to_string(),
                format: "mp4".to_string(),
                bitrate: Some(8000),
                codec: None,
                size: None,
            },
        ];

        let selected = PlayerManager::select_quality(&streams, VideoQuality::FullHD);
        assert!(selected.is_some());
        assert_eq!(selected.unwrap().id, "2");

        let auto = PlayerManager::select_quality(&streams, VideoQuality::Auto);
        assert_eq!(auto.unwrap().bitrate, Some(8000));
    }

    #[test]
    fn test_srt_to_vtt() {
        let srt = "1\n00:00:01,000 --> 00:00:04,000\nHello World";
        let vtt = SubtitleManager::srt_to_vtt(srt).unwrap();
        assert!(vtt.starts_with("WEBVTT"));
        assert!(vtt.contains("00:00:01.000"));
    }
}
