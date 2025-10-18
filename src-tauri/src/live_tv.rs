use chrono::{DateTime, TimeZone, Utc};
use quick_xml::de::from_str as xml_from_str;
use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::models::{EpgProgram, LiveTvChannel};

#[derive(Debug, thiserror::Error)]
pub enum LiveTvError {
    #[error("Network error: {0}")]
    Network(String),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Validation error: {0}")]
    Validation(String),
}

pub struct LiveTvManager;

impl LiveTvManager {
    pub async fn fetch_text(url: &str) -> Result<String, LiveTvError> {
        let resp = reqwest::Client::new()
            .get(url)
            .send()
            .await
            .map_err(|e| LiveTvError::Network(e.to_string()))?;
        if !resp.status().is_success() {
            return Err(LiveTvError::Network(format!(
                "HTTP {}",
                resp.status()
            )));
        }
        resp.text()
            .await
            .map_err(|e| LiveTvError::Network(e.to_string()))
    }

    /// Parse an M3U playlist (extended) into channels
    pub fn parse_m3u(content: &str) -> Vec<LiveTvChannel> {
        let mut channels = Vec::new();
        let mut current_name: Option<String> = None;
        let mut current_logo: Option<String> = None;
        let mut current_group: Option<String> = None;
        let mut current_tvg_id: Option<String> = None;

        // Regex for attributes in #EXTINF line
        let attr_re = Regex::new(r#"([a-zA-Z0-9_-]+)\s*=\s*"([^"]*)""#).unwrap();

        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            if line.starts_with("#EXTINF") {
                // Reset
                current_name = None;
                current_logo = None;
                current_group = None;
                current_tvg_id = None;

                // Extract attributes
                for cap in attr_re.captures_iter(line) {
                    let key = cap.get(1).unwrap().as_str().to_lowercase();
                    let val = cap.get(2).unwrap().as_str().to_string();
                    match key.as_str() {
                        "tvg-id" => current_tvg_id = Some(val),
                        "tvg-name" => {
                            if current_name.is_none() {
                                current_name = Some(val)
                            }
                        }
                        "tvg-logo" => current_logo = Some(val),
                        "group-title" => current_group = Some(val),
                        _ => {}
                    }
                }
                // Fallback: name is text after comma
                if let Some(idx) = line.rfind(',') {
                    if let Some(name) = line.get(idx + 1..) {
                        if !name.trim().is_empty() {
                            current_name = Some(name.trim().to_string());
                        }
                    }
                }
            } else if !line.starts_with('#') {
                // URL line
                let url = line.to_string();
                if let Some(name) = current_name.clone() {
                    // Channel ID: prefer tvg-id, else sanitized name
                    let id = current_tvg_id
                        .clone()
                        .filter(|s| !s.is_empty())
                        .unwrap_or_else(|| sanitize_channel_id(&name));
                    channels.push(LiveTvChannel {
                        id,
                        name,
                        logo: current_logo.clone(),
                        group: current_group.clone(),
                        tvg_id: current_tvg_id.clone(),
                        stream_url: url,
                    });
                }
            }
        }

        channels
    }

    /// Parse XMLTV into EPG programs
    pub fn parse_xmltv(xml: &str) -> Result<Vec<EpgProgram>, LiveTvError> {
        let tv: XmlTv = xml_from_str(xml).map_err(|e| LiveTvError::Parse(e.to_string()))?;
        let mut programs = Vec::new();

        for p in tv.programmes.unwrap_or_default() {
            let start = parse_xmltv_datetime(&p.start).unwrap_or_else(|| Utc::now());
            let end = parse_xmltv_datetime(&p.stop).unwrap_or_else(|| start + chrono::Duration::minutes(30));
            let title = p.title.map(|t| t.value).unwrap_or_else(|| "".to_string());
            let description = p.desc.map(|d| d.value);
            let category = p.category.map(|c| c.value);

            programs.push(EpgProgram {
                channel_id: p.channel,
                start: start.timestamp(),
                end: end.timestamp(),
                title,
                description,
                category,
                season: None,
                episode: None,
            });
        }

        Ok(programs)
    }
}

fn sanitize_channel_id(name: &str) -> String {
    let mut s = name.to_lowercase();
    s.retain(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if s.is_empty() {
        // fallback to hash
        format!("ch-{:x}", md5::compute(name))
    } else {
        s
    }
}

fn parse_xmltv_datetime(s: &str) -> Option<DateTime<Utc>> {
    // Common formats: YYYYMMDDHHMMSS Z, or without space, with offset
    // Try to parse using chrono
    // Example: 20250101120000 +0000
    if s.len() >= 14 {
        let y: i32 = s.get(0..4)?.parse().ok()?;
        let mo: u32 = s.get(4..6)?.parse().ok()?;
        let d: u32 = s.get(6..8)?.parse().ok()?;
        let h: u32 = s.get(8..10)?.parse().ok()?;
        let mi: u32 = s.get(10..12)?.parse().ok()?;
        let se: u32 = s.get(12..14)?.parse().ok()?;
        let naive = chrono::NaiveDate::from_ymd_opt(y, mo, d)?.and_hms_opt(h, mi, se)?;
        if s.len() >= 19 {
            // has offset
            if let Some(offset_str) = s.get(15..) {
                // offset like +0000 or -0500
                let sign = &offset_str[0..1];
                if let (Ok(oh), Ok(om)) = (
                    offset_str.get(1..3).unwrap_or("00").parse::<i32>(),
                    offset_str.get(3..5).unwrap_or("00").parse::<i32>(),
                ) {
                    let minutes = oh * 60 + om;
                    let offset = if sign == "-" { -minutes } else { minutes };
                    let fixed = chrono::FixedOffset::east_opt(offset * 60)?;
                    return Some(fixed.from_local_datetime(&naive).single()?.with_timezone(&Utc));
                }
            }
        }
        return Some(Utc.from_local_datetime(&naive).single()?);
    }
    None
}

// Minimal XMLTV structs
#[derive(Debug, Deserialize)]
struct XmlTv {
    #[serde(default)]
    programme: Option<Vec<XmlProgramme>>, // some variants use singular/plural inconsistently
    #[serde(default)]
    programmes: Option<Vec<XmlProgramme>>, // fallback field name
}

#[derive(Debug, Deserialize)]
struct XmlProgramme {
    #[serde(rename = "channel")]
    channel: String,
    start: String,
    #[serde(default)]
    stop: String,
    #[serde(default)]
    title: Option<XmlText>,
    #[serde(default)]
    desc: Option<XmlText>,
    #[serde(default)]
    category: Option<XmlText>,
}

#[derive(Debug, Deserialize)]
struct XmlText {
    #[serde(rename = "$text")]
    value: String,
}
