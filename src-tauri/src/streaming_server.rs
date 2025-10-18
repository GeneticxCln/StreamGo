use anyhow::{Context, Result};
use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
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

        let session = RqbitSession::new_with_opts(download_dir, opts)
            .await
            .context("Failed to create torrent session")?;

        let base_url = format!("http://127.0.0.1:{}", port);

        Ok(Self {
            session,
            port,
            base_url,
            active_streams: Arc::new(RwLock::new(HashMap::new())),
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
        return Err(AppError::not_found("No video file found in torrent".into()));
    };

    Ok(Json(StreamResponse {
        id: info.id,
        play_url,
    }))
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct RangeQuery {
    start: Option<u64>,
    end: Option<u64>,
}

async fn stream_file(
    State(server): State<Arc<StreamingServer>>,
    Path((id, file_index)): Path<(String, usize)>,
    Query(_range): Query<RangeQuery>,
) -> Result<Response, AppError> {
    let info = server.get_stream_info(&id).await?;
    
    let _file = info
        .files
        .get(file_index)
        .ok_or_else(|| AppError::not_found("File not found".into()))?;

    // TODO: Implement actual file streaming with range support
    // For now, return a placeholder response
    let response = (
        StatusCode::PARTIAL_CONTENT,
        [(header::CONTENT_TYPE, "video/mp4")],
        "Streaming not yet fully implemented",
    );

    Ok(response.into_response())
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

struct AppError(anyhow::Error);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        error!("Request error: {:?}", self.0);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": self.0.to_string()
            })),
        )
            .into_response()
    }
}

impl<E> From<E> for AppError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}

impl AppError {
    fn not_found(msg: String) -> Self {
        Self(anyhow::anyhow!(msg))
    }
}
