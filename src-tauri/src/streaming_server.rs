use anyhow::{Context, Result};
use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use librqbit::{
    api::TorrentIdOrHash, SessionOptions, SessionPersistenceConfig, AddTorrentOptions, Session as RqbitSession,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    path::PathBuf,
    sync::Arc,
};
use tokio::{
    sync::RwLock,
};
use tower_http::cors::CorsLayer;
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamInfo {
    pub id: String,
    pub name: String,
    pub magnet: Option<String>,
    pub info_hash: String,
    pub total_bytes: u64,
    pub downloaded: u64,
    pub upload_speed: u64,
    pub download_speed: u64,
    pub progress: f32,
    pub state: String,
    pub files: Vec<TorrentFile>,
    pub play_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentFile {
    pub index: usize,
    pub name: String,
    pub size: u64,
    pub path: String,
    pub is_video: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddStreamRequest {
    pub magnet_or_url: String,
    pub file_index: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamResponse {
    pub id: String,
    pub play_url: String,
}

pub struct StreamingServer {
    session: std::sync::Arc<RqbitSession>,
    port: u16,
    base_url: String,
    active_streams: Arc<RwLock<HashMap<String, StreamInfo>>>,
    download_dir: PathBuf,
}

impl StreamingServer {
    pub async fn new(download_dir: PathBuf, port: u16) -> Result<Self> {
        let opts = SessionOptions {
            disable_dht: false,
            disable_dht_persistence: false,
            dht_config: None,
            persistence: Some(SessionPersistenceConfig::Json {
                folder: Some(download_dir.join(".session"))
            }),
            fastresume: true,
            listen_port_range: Some(6881..6891),
            ..Default::default()
        };

        let session = RqbitSession::new_with_opts(download_dir.clone(), opts)
            .await
            .context("Failed to create torrent session")?;

        let base_url = format!("http://127.0.0.1:{}", port);

        Ok(Self {
            session,
            port,
            base_url,
            active_streams: Arc::new(RwLock::new(HashMap::new())),
            download_dir,
        })
    }

    pub async fn start(&self) -> Result<()> {
        let app = Router::new()
            .route("/streams", post(add_stream))
            .route("/streams", get(list_streams))
            .route("/streams/:id", get(get_stream_info))
            .route("/streams/:id", delete(remove_stream))
            .route("/streams/:id/play", get(play_stream))
            .route("/streams/:id/file/:file_index", get(stream_file))
            .route("/health", get(health_check))
            .layer(CorsLayer::permissive())
            .with_state(Arc::new(self.clone()));

        let addr = SocketAddr::from(([127, 0, 0, 1], self.port));
        info!("Streaming server listening on {}", addr);

        let listener = tokio::net::TcpListener::bind(addr)
            .await
            .context("Failed to bind streaming server")?;

        axum::serve(listener, app)
            .await
            .context("Streaming server error")?;

        Ok(())
    }

    pub async fn add_torrent(&self, magnet_or_url: &str, file_index: Option<usize>) -> Result<StreamInfo> {
        info!("Adding torrent: {}", magnet_or_url);

        let opts = AddTorrentOptions {
            only_files_regex: None,
            only_files: file_index.map(|idx| vec![idx]),
            output_folder: None,
            sub_folder: None,
            list_only: false,
            overwrite: false,
            initial_peers: None,
            force_tracker_interval: None,
            ..Default::default()
        };

        let handle = self
            .session
            .add_torrent(librqbit::AddTorrent::from_url(magnet_or_url), Some(opts))
            .await
            .context("Failed to add torrent")?
            .into_handle()
            .context("Failed to get torrent handle")?;

        let info_hash = handle.info_hash().as_string();
        let stats = handle.stats();
        
        let (name, files) = handle.with_metadata(|metadata| {
            let name = metadata.name.clone().unwrap_or_else(|| "Unknown".to_string());
            let files: Vec<TorrentFile> = metadata.file_infos
                .iter()
                .enumerate()
                .map(|(idx, f)| TorrentFile {
                    index: idx,
                    name: f.relative_filename.to_string_lossy().to_string(),
                    size: f.len,
                    path: f.relative_filename.to_string_lossy().to_string(),
                    is_video: is_video_file(&f.relative_filename.to_string_lossy()),
                })
                .collect();
            (name, files)
        }).context("Failed to get torrent metadata")?;

        let stream_info = StreamInfo {
            id: info_hash.clone(),
            name,
            magnet: Some(magnet_or_url.to_string()),
            info_hash: info_hash.clone(),
            total_bytes: stats.total_bytes,
            downloaded: stats.progress_bytes,
            upload_speed: stats.live.as_ref().map(|l| (l.upload_speed.mbps * 1024.0 * 1024.0) as u64).unwrap_or(0),
            download_speed: stats.live.as_ref().map(|l| (l.download_speed.mbps * 1024.0 * 1024.0) as u64).unwrap_or(0),
            progress: if stats.total_bytes > 0 {
                (stats.progress_bytes as f32 / stats.total_bytes as f32) * 100.0
            } else {
                0.0
            },
            state: format!("{:?}", stats.state),
            files: files.clone(),
            play_url: Some(format!("{}/streams/{}/play", self.base_url, info_hash)),
        };

        self.active_streams
            .write()
            .await
            .insert(info_hash.clone(), stream_info.clone());

        Ok(stream_info)
    }

    pub async fn get_stream_info(&self, id: &str) -> Result<StreamInfo> {
        let streams = self.active_streams.read().await;
        streams
            .get(id)
            .cloned()
            .context("Stream not found")
    }

    pub async fn list_streams(&self) -> Vec<StreamInfo> {
        self.active_streams.read().await.values().cloned().collect()
    }

    pub async fn remove_stream(&self, id: &str) -> Result<()> {
        info!("Removing stream: {}", id);
        
        if let Ok(torrent_id) = TorrentIdOrHash::parse(id) {
            if let Err(e) = self.session.delete(torrent_id, false).await {
                warn!("Failed to delete torrent: {}", e);
            }
        }

        self.active_streams.write().await.remove(id);
        Ok(())
    }
}

impl Clone for StreamingServer {
    fn clone(&self) -> Self {
        Self {
            session: Arc::clone(&self.session),
            port: self.port,
            base_url: self.base_url.clone(),
            active_streams: Arc::clone(&self.active_streams),
            download_dir: self.download_dir.clone(),
        }
    }
}

async fn add_stream(
    State(server): State<Arc<StreamingServer>>,
    Json(req): Json<AddStreamRequest>,
) -> Result<Json<StreamResponse>, AppError> {
    let stream_info = server
        .add_torrent(&req.magnet_or_url, req.file_index)
        .await?;

    Ok(Json(StreamResponse {
        id: stream_info.id,
        play_url: stream_info.play_url.unwrap_or_default(),
    }))
}

async fn list_streams(
    State(server): State<Arc<StreamingServer>>,
) -> Result<Json<Vec<StreamInfo>>, AppError> {
    let streams = server.list_streams().await;
    Ok(Json(streams))
}

async fn get_stream_info(
    State(server): State<Arc<StreamingServer>>,
    Path(id): Path<String>,
) -> Result<Json<StreamInfo>, AppError> {
    let info = server.get_stream_info(&id).await?;
    Ok(Json(info))
}

async fn remove_stream(
    State(server): State<Arc<StreamingServer>>,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    server.remove_stream(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn play_stream(
    State(server): State<Arc<StreamingServer>>,
    Path(id): Path<String>,
) -> Result<Json<StreamResponse>, AppError> {
    let info = server.get_stream_info(&id).await?;
    
    let video_file = info.files.iter().find(|f| f.is_video);
    
    let play_url = if let Some(file) = video_file {
        format!("{}/streams/{}/file/{}", server.base_url, id, file.index)
    } else {
        return Err(AppError::NotFound("No video file found in torrent".into()));
    };

    Ok(Json(StreamResponse {
        id: info.id,
        play_url,
    }))
}

async fn stream_file(
    State(server): State<Arc<StreamingServer>>,
    Path((id, file_index)): Path<(String, usize)>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let download_dir = &server.download_dir;
    let info = server.get_stream_info(&id).await?;
    let file_info = info
        .files
        .get(file_index)
        .ok_or_else(|| AppError::NotFound("File not found in torrent".into()))?;

    let file_path = download_dir.join(&file_info.path);

    if !file_path.exists() {
        return Err(AppError::NotFound(format!(
            "File not found on disk: {:?}",
            file_path
        )));
    }

    let mut file = tokio::fs::File::open(&file_path).await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to open file: {:?}, error: {}", file_path, e))
    })?;

    let file_size = file.metadata().await?.len();
    let mime_type = file_path_to_mime_str(&file_path);

    let range_header = headers
        .get(header::RANGE)
        .and_then(|value| value.to_str().ok());

    let (start, end) = if let Some(range_str) = range_header {
        let (start, end) = parse_range_header(range_str, file_size)?;
        (start, end)
    } else {
        (0, file_size - 1)
    };

    let len = end - start + 1;

    file.seek(std::io::SeekFrom::Start(start)).await?;
    let mut buffer = vec![0; len as usize];
    file.read_exact(&mut buffer).await?;

    let content_range = format!("bytes {}-{}/{}", start, end, file_size);

    let response = Response::builder()
        .status(StatusCode::PARTIAL_CONTENT)
        .header(header::CONTENT_TYPE, mime_type)
        .header(header::CONTENT_LENGTH, len)
        .header(header::CONTENT_RANGE, content_range)
        .header(header::ACCEPT_RANGES, "bytes")
        .body(axum::body::Body::from(buffer))
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to build response: {}", e)))?;

    Ok(response)
}

fn parse_range_header(range_str: &str, file_size: u64) -> Result<(u64, u64), AppError> {
    let range = range_str.strip_prefix("bytes=").ok_or_else(|| {
        AppError::BadRequest("Invalid range header format".into())
    })?;

    let parts: Vec<&str> = range.split('-').collect();
    if parts.len() != 2 {
        return Err(AppError::BadRequest("Invalid range header format".into()));
    }

    let start = parts[0].parse::<u64>().map_err(|_| {
        AppError::BadRequest("Invalid start of range".into())
    })?;

    let end = if parts[1].is_empty() {
        file_size - 1
    } else {
        parts[1].parse::<u64>().map_err(|_| {
            AppError::BadRequest("Invalid end of range".into())
        })?.min(file_size - 1)
    };

    if start > end {
        return Err(AppError::RangeNotSatisfiable(format!(
            "Invalid range: start > end ({} > {})",
            start, end
        )));
    }

    Ok((start, end))
}

fn file_path_to_mime_str(path: &std::path::Path) -> &'static str {
    match path.extension().and_then(|s| s.to_str()) {
        Some("mp4") => "video/mp4",
        Some("mkv") => "video/x-matroska",
        Some("webm") => "video/webm",
        Some("avi") => "video/x-msvideo",
        Some("mov") => "video/quicktime",
        _ => "application/octet-stream",
    }
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "service": "streaming-server"
    }))
}

fn is_video_file(filename: &str) -> bool {
    let video_extensions = [
        ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg", ".3gp",
    ];
    
    let filename_lower = filename.to_lowercase();
    video_extensions.iter().any(|ext| filename_lower.ends_with(ext))
}

enum AppError {
    Internal(anyhow::Error),
    NotFound(String),
    BadRequest(String),
    RangeNotSatisfiable(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::Internal(e) => {
                error!("Internal server error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "An internal server error occurred".to_string(),
                )
            }
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::RangeNotSatisfiable(msg) => (StatusCode::RANGE_NOT_SATISFIABLE, msg),
        };

        (
            status,
            Json(serde_json::json!({ "error": error_message })),
        )
            .into_response()
    }
}

impl<E> From<E> for AppError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        AppError::Internal(err.into())
    }
}
