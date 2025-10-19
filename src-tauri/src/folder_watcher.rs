/**
 * Folder Watcher Module
 *
 * Monitors configured directories for video file changes and updates database
 */
use anyhow::{anyhow, Result};
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, FileIdMap};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

use crate::database::Database;
use crate::local_media::{is_video_file, LocalMediaScanner};

/// Folder watcher event
#[derive(Debug, Clone)]
pub enum WatchEvent {
    FileCreated(PathBuf),
    FileModified(PathBuf),
    FileDeleted(PathBuf),
}

/// Folder watcher manager
pub struct FolderWatcherManager {
    debouncer: Option<Debouncer<RecommendedWatcher, FileIdMap>>,
    watched_paths: Vec<PathBuf>,
}

impl FolderWatcherManager {
    /// Create new folder watcher manager
    pub fn new() -> Self {
        Self {
            debouncer: None,
            watched_paths: Vec::new(),
        }
    }

    /// Start watching folders
    pub async fn start_watching(
        &mut self,
        paths: Vec<PathBuf>,
        db: Arc<std::sync::Mutex<Database>>,
    ) -> Result<()> {
        info!("Starting folder watcher for {} paths", paths.len());

        // Create channel for events
        let (tx, mut rx) = mpsc::unbounded_channel::<WatchEvent>();

        // Create debouncer with 2 second delay to avoid multiple rapid events
        let mut debouncer = new_debouncer(
            Duration::from_secs(2),
            None,
            move |result: DebounceEventResult| {
                match result {
                    Ok(events) => {
                        for event in events {
                            for path in &event.paths {
                                // Only process video files
                                if !is_video_file(&path) {
                                    continue;
                                }

                                let watch_event = match event.kind {
                                    notify::EventKind::Create(_) => {
                                        debug!("File created: {}", path.display());
                                        WatchEvent::FileCreated(path.clone())
                                    }
                                    notify::EventKind::Modify(_) => {
                                        debug!("File modified: {}", path.display());
                                        WatchEvent::FileModified(path.clone())
                                    }
                                    notify::EventKind::Remove(_) => {
                                        debug!("File removed: {}", path.display());
                                        WatchEvent::FileDeleted(path.clone())
                                    }
                                    _ => continue,
                                };

                                if tx.send(watch_event).is_err() {
                                    error!("Failed to send watch event");
                                }
                            }
                        }
                    }
                    Err(errors) => {
                        for err in errors {
                            error!(error = %err, "Watch error");
                        }
                    }
                }
            },
        )
        .map_err(|e| anyhow!("Failed to create debouncer: {}", e))?;

        // Watch each path
        for path in &paths {
            if !path.exists() {
                warn!(path = %path.display(), "Path does not exist, skipping");
                continue;
            }

            debouncer
                .watcher()
                .watch(path, RecursiveMode::Recursive)
                .map_err(|e| anyhow!("Failed to watch path {}: {}", path.display(), e))?;

            info!("Now watching: {}", path.display());
        }

        self.watched_paths = paths;
        self.debouncer = Some(debouncer);

        // Spawn task to handle events
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                if let Err(e) = handle_watch_event(event, db.clone()).await {
                    error!(error = %e, "Failed to handle watch event");
                }
            }
        });

        Ok(())
    }

    /// Stop watching folders
    pub fn stop_watching(&mut self) {
        if self.debouncer.take().is_some() {
            info!("Stopped folder watcher");
        }
        self.watched_paths.clear();
    }

    /// Get list of watched paths
    pub fn get_watched_paths(&self) -> Vec<PathBuf> {
        self.watched_paths.clone()
    }

    /// Check if watching is active
    pub fn is_watching(&self) -> bool {
        self.debouncer.is_some()
    }
}

impl Drop for FolderWatcherManager {
    fn drop(&mut self) {
        self.stop_watching();
    }
}

/// Handle a watch event
async fn handle_watch_event(
    event: WatchEvent,
    db: Arc<std::sync::Mutex<Database>>,
) -> Result<()> {
    match event {
        WatchEvent::FileCreated(path) | WatchEvent::FileModified(path) => {
            info!("Processing new/modified file: {}", path.display());

            // Scan the file
            let scanner = LocalMediaScanner::new(vec![]);
            match scanner.scan_directory(&path.parent().unwrap_or(Path::new("/"))).await {
                Ok(files) => {
                    // Find the specific file we're interested in
                    if let Some(file) = files.iter().find(|f| f.file_path == path.to_string_lossy()) {
                        // Save to database in blocking task
                        let db_clone = db.clone();
                        let file_clone = file.clone();
                        tokio::task::spawn_blocking(move || {
                            match db_clone.lock() {
                                Ok(db_guard) => {
                                    if let Err(e) = db_guard.upsert_local_media_file(&file_clone) {
                                        error!(error = %e, path = %path.display(), "Failed to save file to database");
                                    } else {
                                        info!("Added/updated file in database: {}", path.display());
                                    }
                                }
                                Err(e) => {
                                    error!(error = %e, "Failed to lock database for update");
                                }
                            }
                        });
                    }
                }
                Err(e) => {
                    error!(error = %e, path = %path.display(), "Failed to scan file");
                }
            }
        }
        WatchEvent::FileDeleted(path) => {
            info!("Processing deleted file: {}", path.display());

            // Remove from database
            let db_clone = db.clone();
            let path_str = path.to_string_lossy().to_string();
            tokio::task::spawn_blocking(move || {
                match db_clone.lock() {
                    Ok(db_guard) => {
                        match db_guard.delete_local_media_file(&path_str) {
                            Ok(_) => info!("Removed file from database: {}", path_str),
                            Err(e) => error!(error = %e, path = %path_str, "Failed to remove file from database"),
                        }
                    }
                    Err(e) => error!(error = %e, "Failed to lock database for delete"),
                }
            });
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_watcher_creation() {
        let watcher = FolderWatcherManager::new();
        assert!(!watcher.is_watching());
        assert_eq!(watcher.get_watched_paths().len(), 0);
    }
}
