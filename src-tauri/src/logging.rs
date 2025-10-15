use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;
use tracing_appender::{non_blocking, rolling};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Layer};

/// Initialize the logging system with structured logging support
pub fn init_logging(log_dir: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    // Ensure log directory exists
    std::fs::create_dir_all(&log_dir)?;

    // Store log directory for later use
    if let Ok(mut guard) = LOG_DIR.lock() {
        *guard = Some(log_dir.clone());
    }

    // File appender with daily rotation
    let file_appender = rolling::daily(&log_dir, "streamgo.log");
    let (non_blocking_file, _guard) = non_blocking(file_appender);

    // Keep the guard alive for the lifetime of the application
    std::mem::forget(_guard);

    // Create env filter with default level
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("streamgo=info,app_lib=info"));

    // Build subscriber with multiple layers
    tracing_subscriber::registry()
        // Console output layer (for development)
        .with(
            fmt::layer()
                .with_writer(std::io::stdout)
                .with_target(true)
                .with_thread_ids(true)
                .with_thread_names(true)
                .with_line_number(true)
                .with_filter(env_filter.clone()),
        )
        // File output layer (for production)
        .with(
            fmt::layer()
                .with_writer(non_blocking_file)
                .with_target(true)
                .with_thread_ids(true)
                .with_thread_names(true)
                .with_line_number(true)
                .with_ansi(false)
                .with_filter(env_filter),
        )
        .init();

    tracing::info!("Logging system initialized");
    tracing::info!("Log directory: {:?}", log_dir);

    Ok(())
}

/// Log application startup information
pub fn log_startup_info() {
    tracing::info!(
        app_name = "StreamGo",
        version = env!("CARGO_PKG_VERSION"),
        "Application starting"
    );

    // Log system information
    tracing::debug!(
        os = std::env::consts::OS,
        arch = std::env::consts::ARCH,
        "System information"
    );
}

/// Log application shutdown
pub fn log_shutdown() {
    tracing::info!("Application shutting down gracefully");
}

/// Helper macros for common logging patterns
#[macro_export]
macro_rules! log_operation {
    ($op:expr, $result:expr) => {
        match $result {
            Ok(val) => {
                tracing::info!(operation = $op, status = "success", "Operation completed");
                Ok(val)
            }
            Err(e) => {
                tracing::error!(
                    operation = $op,
                    status = "failed",
                    error = %e,
                    "Operation failed"
                );
                Err(e)
            }
        }
    };
}

#[macro_export]
macro_rules! log_command {
    ($command:expr) => {
        tracing::info!(command = $command, "Tauri command invoked");
    };
}

#[macro_export]
macro_rules! log_error_context {
    ($error:expr, $context:expr) => {
        tracing::error!(
            error = %$error,
            context = $context,
            "Error with context"
        );
    };
}

/// Performance timing helper
#[allow(dead_code)]
pub struct OperationTimer {
    operation: String,
    start: std::time::Instant,
}

impl OperationTimer {
    #[allow(dead_code)]
    pub fn new(operation: impl Into<String>) -> Self {
        let operation = operation.into();
        tracing::debug!(operation = %operation, "Operation started");
        Self {
            operation,
            start: std::time::Instant::now(),
        }
    }

    #[allow(dead_code)]
    pub fn finish(self) {
        let duration = self.start.elapsed();
        tracing::info!(
            operation = %self.operation,
            duration_ms = duration.as_millis(),
            "Operation completed"
        );
    }

    #[allow(dead_code)]
    pub fn finish_with_result<T, E: std::fmt::Display>(
        self,
        result: &Result<T, E>,
    ) -> std::time::Duration {
        let duration = self.start.elapsed();
        match result {
            Ok(_) => tracing::info!(
                operation = %self.operation,
                duration_ms = duration.as_millis(),
                status = "success",
                "Operation completed"
            ),
            Err(e) => tracing::error!(
                operation = %self.operation,
                duration_ms = duration.as_millis(),
                status = "failed",
                error = %e,
                "Operation failed"
            ),
        }
        duration
    }
}

/// Log database operations
pub mod database {

    #[allow(dead_code)]
    pub fn log_query(query: &str, params_count: usize) {
        tracing::debug!(
            query = query,
            params_count = params_count,
            "Executing database query"
        );
    }

    #[allow(dead_code)]
    pub fn log_query_result<T>(query: &str, result: &Result<Vec<T>, impl std::fmt::Display>) {
        match result {
            Ok(items) => tracing::debug!(
                query = query,
                result_count = items.len(),
                "Query completed successfully"
            ),
            Err(e) => tracing::error!(
                query = query,
                error = %e,
                "Query failed"
            ),
        }
    }

    #[allow(dead_code)]
    pub fn log_transaction(operation: &str) {
        tracing::info!(transaction = operation, "Database transaction");
    }
}

/// Log API operations
pub mod api {

    #[allow(dead_code)]
    pub fn log_request(url: &str, method: &str) {
        tracing::info!(url = url, method = method, "API request");
    }

    #[allow(dead_code)]
    pub fn log_response(url: &str, status: u16, duration_ms: u128) {
        if (200..300).contains(&status) {
            tracing::info!(
                url = url,
                status = status,
                duration_ms = duration_ms,
                "API response"
            );
        } else {
            tracing::warn!(
                url = url,
                status = status,
                duration_ms = duration_ms,
                "API response with non-2xx status"
            );
        }
    }

    #[allow(dead_code)]
    pub fn log_error(url: &str, error: &impl std::fmt::Display) {
        tracing::error!(
            url = url,
            error = %error,
            "API request failed"
        );
    }
}

/// Log user actions
pub mod user {

    #[allow(dead_code)]
    pub fn log_action(action: &str, details: Option<&str>) {
        if let Some(details) = details {
            tracing::info!(action = action, details = details, "User action");
        } else {
            tracing::info!(action = action, "User action");
        }
    }

    #[allow(dead_code)]
    pub fn log_preference_change(key: &str, value: &str) {
        tracing::info!(preference = key, value = value, "User preference changed");
    }
}

/// Diagnostics information for export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticsInfo {
    pub timestamp: u64,
    pub app_version: String,
    pub os: String,
    pub arch: String,
    pub uptime_seconds: u64,
    pub log_path: String,
    pub metrics: PerformanceMetrics,
}

/// Performance metrics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PerformanceMetrics {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub avg_response_time_ms: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
}

/// Global metrics tracker
static METRICS: once_cell::sync::Lazy<Arc<Mutex<PerformanceMetrics>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(PerformanceMetrics::default())));

static APP_START_TIME: once_cell::sync::Lazy<SystemTime> =
    once_cell::sync::Lazy::new(SystemTime::now);

static LOG_DIR: once_cell::sync::Lazy<Arc<Mutex<Option<PathBuf>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// Record a request metric
#[allow(dead_code)]
pub fn record_request(success: bool, response_time_ms: u128) {
    if let Ok(mut metrics) = METRICS.lock() {
        metrics.total_requests += 1;
        if success {
            metrics.successful_requests += 1;
        } else {
            metrics.failed_requests += 1;
        }

        // Update average response time (simple moving average)
        let current_avg = metrics.avg_response_time_ms;
        let total = metrics.total_requests;
        metrics.avg_response_time_ms =
            ((current_avg * (total - 1)) + response_time_ms as u64) / total;
    }
}

/// Record a cache operation
#[allow(dead_code)]
pub fn record_cache_operation(hit: bool) {
    if let Ok(mut metrics) = METRICS.lock() {
        if hit {
            metrics.cache_hits += 1;
        } else {
            metrics.cache_misses += 1;
        }
    }
}

/// Get current performance metrics
pub fn get_metrics() -> PerformanceMetrics {
    METRICS.lock().map(|m| m.clone()).unwrap_or_default()
}

/// Reset performance metrics
pub fn reset_metrics() {
    if let Ok(mut metrics) = METRICS.lock() {
        *metrics = PerformanceMetrics::default();
    }
}

/// Export diagnostics information
pub fn export_diagnostics() -> Result<DiagnosticsInfo, Box<dyn std::error::Error>> {
    let uptime = APP_START_TIME.elapsed().unwrap_or_default().as_secs();

    let log_path = LOG_DIR
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().map(|p| p.display().to_string()))
        .unwrap_or_else(|| "Not set".to_string());

    Ok(DiagnosticsInfo {
        timestamp: SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)?
            .as_secs(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        uptime_seconds: uptime,
        log_path,
        metrics: get_metrics(),
    })
}

/// Export diagnostics to JSON file
pub fn export_diagnostics_to_file(output_path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    let diagnostics = export_diagnostics()?;
    let json = serde_json::to_string_pretty(&diagnostics)?;
    std::fs::write(output_path, json)?;

    tracing::info!(
        output_path = %output_path.display(),
        "Diagnostics exported successfully"
    );

    Ok(())
}

/// Get log file path
#[allow(dead_code)]
pub fn get_log_path() -> Option<PathBuf> {
    LOG_DIR.lock().ok().and_then(|guard| guard.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn test_record_request_metrics() {
        // Reset metrics before test
        reset_metrics();

        // Record some successful requests
        record_request(true, 100);
        record_request(true, 200);
        record_request(true, 300);

        // Record a failed request
        record_request(false, 500);

        // Check metrics
        let metrics = get_metrics();
        assert_eq!(metrics.total_requests, 4);
        assert_eq!(metrics.successful_requests, 3);
        assert_eq!(metrics.failed_requests, 1);
        // Average should be (100+200+300+500)/4 = 275
        assert_eq!(metrics.avg_response_time_ms, 275);
    }

    #[test]
    fn test_cache_operation_metrics() {
        // Reset metrics before test
        reset_metrics();

        // Record cache operations
        record_cache_operation(true); // hit
        record_cache_operation(true); // hit
        record_cache_operation(false); // miss
        record_cache_operation(true); // hit

        // Check metrics
        let metrics = get_metrics();
        assert_eq!(metrics.cache_hits, 3);
        assert_eq!(metrics.cache_misses, 1);
    }

    #[test]
    fn test_reset_metrics() {
        // Record some data
        record_request(true, 100);
        record_cache_operation(true);

        // Verify data exists
        let metrics_before = get_metrics();
        assert!(metrics_before.total_requests > 0);
        assert!(metrics_before.cache_hits > 0);

        // Reset
        reset_metrics();

        // Verify metrics are cleared
        let metrics_after = get_metrics();
        assert_eq!(metrics_after.total_requests, 0);
        assert_eq!(metrics_after.successful_requests, 0);
        assert_eq!(metrics_after.failed_requests, 0);
        assert_eq!(metrics_after.cache_hits, 0);
        assert_eq!(metrics_after.cache_misses, 0);
    }

    #[test]
    fn test_export_diagnostics() {
        // Export diagnostics
        let diagnostics = export_diagnostics().unwrap();

        // Verify basic fields (these don't depend on global state)
        assert_eq!(diagnostics.app_version, env!("CARGO_PKG_VERSION"));
        assert_eq!(diagnostics.os, std::env::consts::OS);
        assert_eq!(diagnostics.arch, std::env::consts::ARCH);
        assert!(diagnostics.timestamp > 0);
        assert!(!diagnostics.log_path.is_empty());

        // Verify metrics structure exists (values may vary due to other tests)
        // Just check that we get a valid PerformanceMetrics struct
        let _ = diagnostics.metrics;
    }

    #[test]
    fn test_export_diagnostics_to_file() {
        // Reset and record some metrics
        reset_metrics();
        record_request(true, 100);
        record_request(false, 200);

        // Create temporary file path
        let temp_dir = std::env::temp_dir();
        let file_path = temp_dir.join("test_diagnostics.json");

        // Export to file
        export_diagnostics_to_file(&file_path).unwrap();

        // Verify file exists
        assert!(file_path.exists());

        // Read and verify content
        let content = std::fs::read_to_string(&file_path).unwrap();
        let diagnostics: DiagnosticsInfo = serde_json::from_str(&content).unwrap();

        assert_eq!(diagnostics.metrics.total_requests, 2);
        assert_eq!(diagnostics.metrics.successful_requests, 1);
        assert_eq!(diagnostics.metrics.failed_requests, 1);

        // Cleanup
        std::fs::remove_file(&file_path).ok();
    }

    #[test]
    fn test_performance_metrics_default() {
        let metrics = PerformanceMetrics::default();
        assert_eq!(metrics.total_requests, 0);
        assert_eq!(metrics.successful_requests, 0);
        assert_eq!(metrics.failed_requests, 0);
        assert_eq!(metrics.avg_response_time_ms, 0);
        assert_eq!(metrics.cache_hits, 0);
        assert_eq!(metrics.cache_misses, 0);
    }

    #[test]
    fn test_operation_timer() {
        let timer = OperationTimer::new("test_operation");
        std::thread::sleep(Duration::from_millis(10));
        let duration = timer.finish_with_result(&Ok::<(), &str>(()));
        assert!(duration.as_millis() >= 10);
    }
}
