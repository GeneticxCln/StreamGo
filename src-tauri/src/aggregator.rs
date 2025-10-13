/**
 * Content Aggregator
 *
 * Queries multiple addons in parallel and merges results
 */
use crate::addon_protocol::{AddonClient, MetaPreview};
use crate::models::Addon;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::time::timeout;

/// Aggregation result with health metrics
#[derive(Debug)]
pub struct AggregationResult {
    pub items: Vec<MetaPreview>,
    pub sources: Vec<SourceHealth>,
    pub total_time_ms: u128,
}

/// Health information for a content source
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SourceHealth {
    pub addon_id: String,
    pub addon_name: String,
    pub response_time_ms: u128,
    pub success: bool,
    pub error: Option<String>,
    pub item_count: usize,
    pub priority: i32,
}

/// Content aggregator for querying multiple addons
pub struct ContentAggregator {
    timeout_duration: Duration,
}

impl ContentAggregator {
    /// Create a new aggregator
    pub fn new() -> Self {
        Self {
            timeout_duration: Duration::from_secs(3),
        }
    }

    /// Set custom timeout
    pub fn with_timeout(mut self, duration: Duration) -> Self {
        self.timeout_duration = duration;
        self
    }

    /// Query multiple addons for catalog content
    pub async fn query_catalogs(
        &self,
        addons: &[Addon],
        media_type: &str,
        catalog_id: &str,
        extra: &Option<HashMap<String, String>>,
    ) -> AggregationResult {
        let start = Instant::now();

        tracing::info!(
            addon_count = addons.len(),
            media_type = %media_type,
            catalog_id = %catalog_id,
            extra = ?extra,
            "Starting catalog aggregation"
        );

        // Filter and sort enabled addons by priority (higher priority first)
        let mut enabled_addons: Vec<_> = addons.iter().filter(|a| a.enabled).collect();

        enabled_addons.sort_by(|a, b| b.priority.cmp(&a.priority));

        if enabled_addons.is_empty() {
            tracing::warn!("No enabled addons found");
            return AggregationResult {
                items: vec![],
                sources: vec![],
                total_time_ms: start.elapsed().as_millis(),
            };
        }

        // Query all addons in parallel
        let mut tasks = Vec::new();

        for addon in enabled_addons {
            let addon_clone = addon.clone();
            let media_type = media_type.to_string();
            let catalog_id = catalog_id.to_string();
            let timeout_duration = self.timeout_duration;
            let extra_clone = extra.clone();

            let task = tokio::spawn(async move {
                Self::query_single_addon(
                    &addon_clone,
                    &media_type,
                    &catalog_id,
                    &extra_clone,
                    timeout_duration,
                ).await
            });

            tasks.push((addon.id.clone(), addon.name.clone(), task));
        }

        // Collect results
        let mut all_items = Vec::new();
        let mut sources = Vec::new();
        let mut seen_ids = HashMap::new();

        for (addon_id, addon_name, task) in tasks {
            match task.await {
                Ok((items, health)) => {
                    // Deduplicate by ID (keep first occurrence)
                    let unique_items: Vec<_> = items
                        .into_iter()
                        .filter(|item| {
                            if seen_ids.contains_key(&item.id) {
                                false
                            } else {
                                seen_ids.insert(item.id.clone(), addon_id.clone());
                                true
                            }
                        })
                        .collect();

                    all_items.extend(unique_items);
                    sources.push(health);
                }
                Err(e) => {
                    tracing::error!(
                        addon_id = %addon_id,
                        error = %e,
                        "Task join error"
                    );
                    sources.push(SourceHealth {
                        addon_id: addon_id.clone(),
                        addon_name: addon_name.clone(),
                        response_time_ms: 0,
                        success: false,
                        error: Some(format!("Task error: {}", e)),
                        item_count: 0,
                        priority: 0,
                    });
                }
            }
        }

        let total_time = start.elapsed();

        tracing::info!(
            total_items = all_items.len(),
            unique_items = all_items.len(),
            sources = sources.len(),
            duration_ms = total_time.as_millis(),
            "Aggregation complete"
        );

        AggregationResult {
            items: all_items,
            sources,
            total_time_ms: total_time.as_millis(),
        }
    }

    /// Query a single addon with timeout
    async fn query_single_addon(
        addon: &Addon,
        media_type: &str,
        catalog_id: &str,
        extra: &Option<HashMap<String, String>>,
        timeout_duration: Duration,
    ) -> (Vec<MetaPreview>, SourceHealth) {
        let start = Instant::now();

        tracing::debug!(
            addon_id = %addon.id,
            addon_name = %addon.name,
            "Querying addon"
        );

        // Use addon URL directly (manifest is already a struct, not JSON string)
        let base_url = addon.url.clone();

        // Create client
        let client = match AddonClient::new(base_url) {
            Ok(client) => client,
            Err(e) => {
                let elapsed = start.elapsed();
                return (
                    vec![],
                    SourceHealth {
                        addon_id: addon.id.clone(),
                        addon_name: addon.name.clone(),
                        response_time_ms: elapsed.as_millis(),
                        success: false,
                        error: Some(format!("Client creation failed: {}", e)),
                        item_count: 0,
                        priority: addon.priority,
                    },
                );
            }
        };

        // Query with timeout
        let result = timeout(
            timeout_duration,
            client.get_catalog(media_type, catalog_id, extra.as_ref()),
        )
        .await;

        let elapsed = start.elapsed();

        match result {
            Ok(Ok(response)) => {
                let item_count = response.metas.len();
                tracing::debug!(
                    addon_id = %addon.id,
                    item_count = item_count,
                    duration_ms = elapsed.as_millis(),
                    "Addon query successful"
                );

                (
                    response.metas,
                    SourceHealth {
                        addon_id: addon.id.clone(),
                        addon_name: addon.name.clone(),
                        response_time_ms: elapsed.as_millis(),
                        success: true,
                        error: None,
                        item_count,
                        priority: addon.priority,
                    },
                )
            }
            Ok(Err(e)) => {
                tracing::warn!(
                    addon_id = %addon.id,
                    error = %e,
                    duration_ms = elapsed.as_millis(),
                    "Addon query failed"
                );

                (
                    vec![],
                    SourceHealth {
                        addon_id: addon.id.clone(),
                        addon_name: addon.name.clone(),
                        response_time_ms: elapsed.as_millis(),
                        success: false,
                        error: Some(e.to_string()),
                        item_count: 0,
                        priority: addon.priority,
                    },
                )
            }
            Err(_) => {
                tracing::warn!(
                    addon_id = %addon.id,
                    timeout_ms = timeout_duration.as_millis(),
                    "Addon query timed out"
                );

                (
                    vec![],
                    SourceHealth {
                        addon_id: addon.id.clone(),
                        addon_name: addon.name.clone(),
                        response_time_ms: elapsed.as_millis(),
                        success: false,
                        error: Some("Timeout".to_string()),
                        item_count: 0,
                        priority: addon.priority,
                    },
                )
            }
        }
    }

    /// Query multiple addons for streams
    pub async fn query_streams(
        &self,
        addons: &[Addon],
        media_type: &str,
        media_id: &str,
    ) -> StreamAggregationResult {
        let start = Instant::now();

        tracing::info!(
            addon_count = addons.len(),
            media_type = %media_type,
            media_id = %media_id,
            "Starting stream aggregation"
        );

        // Filter and sort enabled addons by priority (higher priority first)
        let mut enabled_addons: Vec<_> = addons.iter().filter(|a| a.enabled).collect();
        enabled_addons.sort_by(|a, b| b.priority.cmp(&a.priority));

        if enabled_addons.is_empty() {
            return StreamAggregationResult {
                streams: vec![],
                sources: vec![],
                total_time_ms: start.elapsed().as_millis(),
            };
        }

        // Query all addons in parallel
        let mut tasks = Vec::new();

        for addon in enabled_addons {
            let addon_clone = addon.clone();
            let media_type = media_type.to_string();
            let media_id = media_id.to_string();
            let timeout_duration = self.timeout_duration;

            let task = tokio::spawn(async move {
                Self::query_single_addon_streams(
                    &addon_clone,
                    &media_type,
                    &media_id,
                    timeout_duration,
                )
                .await
            });

            tasks.push((addon.id.clone(), addon.name.clone(), task));
        }

        // Collect results
        let mut all_streams = Vec::new();
        let mut sources = Vec::new();

        for (addon_id, addon_name, task) in tasks {
            match task.await {
                Ok((streams, health)) => {
                    all_streams.extend(streams);
                    sources.push(health);
                }
                Err(e) => {
                    tracing::error!(
                        addon_id = %addon_id,
                        error = %e,
                        "Task join error"
                    );
                    sources.push(SourceHealth {
                        addon_id,
                        addon_name,
                        response_time_ms: 0,
                        success: false,
                        error: Some(format!("Task error: {}", e)),
                        item_count: 0,
                        priority: 0,
                    });
                }
            }
        }

        let total_time = start.elapsed();

        tracing::info!(
            total_streams = all_streams.len(),
            sources = sources.len(),
            duration_ms = total_time.as_millis(),
            "Stream aggregation complete"
        );

        StreamAggregationResult {
            streams: all_streams,
            sources,
            total_time_ms: total_time.as_millis(),
        }
    }

    /// Query single addon for streams
    async fn query_single_addon_streams(
        addon: &Addon,
        media_type: &str,
        media_id: &str,
        timeout_duration: Duration,
    ) -> (Vec<crate::addon_protocol::Stream>, SourceHealth) {
        let start = Instant::now();

        // Use addon URL directly (manifest is already a struct, not JSON string)
        let base_url = addon.url.clone();

        let client = match AddonClient::new(base_url) {
            Ok(client) => client,
            Err(e) => {
                return (
                    vec![],
                    SourceHealth {
                        addon_id: addon.id.clone(),
                        addon_name: addon.name.clone(),
                        response_time_ms: start.elapsed().as_millis(),
                        success: false,
                        error: Some(format!("Client error: {}", e)),
                        item_count: 0,
                        priority: addon.priority,
                    },
                );
            }
        };

        let result = timeout(timeout_duration, client.get_streams(media_type, media_id)).await;

        let elapsed = start.elapsed();

        match result {
            Ok(Ok(response)) => {
                let stream_count = response.streams.len();
                (
                    response.streams,
                    SourceHealth {
                        addon_id: addon.id.clone(),
                        addon_name: addon.name.clone(),
                        response_time_ms: elapsed.as_millis(),
                        success: true,
                        error: None,
                        item_count: stream_count,
                        priority: addon.priority,
                    },
                )
            }
            Ok(Err(e)) => (
                vec![],
                SourceHealth {
                    addon_id: addon.id.clone(),
                    addon_name: addon.name.clone(),
                    response_time_ms: elapsed.as_millis(),
                    success: false,
                    error: Some(e.to_string()),
                    item_count: 0,
                    priority: addon.priority,
                },
            ),
            Err(_) => (
                vec![],
                SourceHealth {
                    addon_id: addon.id.clone(),
                    addon_name: addon.name.clone(),
                    response_time_ms: elapsed.as_millis(),
                    success: false,
                    error: Some("Timeout".to_string()),
                    item_count: 0,
                    priority: addon.priority,
                },
            ),
        }
    }
}

impl Default for ContentAggregator {
    fn default() -> Self {
        Self::new()
    }
}

/// Stream aggregation result
#[derive(Debug)]
pub struct StreamAggregationResult {
    pub streams: Vec<crate::addon_protocol::Stream>,
    pub sources: Vec<SourceHealth>,
    pub total_time_ms: u128,
}
