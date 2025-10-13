use std::path::PathBuf;
use tracing::Level;
use tracing_appender::{non_blocking, rolling};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Layer};

/// Initialize the logging system with structured logging support
pub fn init_logging(log_dir: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    // Ensure log directory exists
    std::fs::create_dir_all(&log_dir)?;

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
pub struct OperationTimer {
    operation: String,
    start: std::time::Instant,
}

impl OperationTimer {
    pub fn new(operation: impl Into<String>) -> Self {
        let operation = operation.into();
        tracing::debug!(operation = %operation, "Operation started");
        Self {
            operation,
            start: std::time::Instant::now(),
        }
    }

    pub fn finish(self) {
        let duration = self.start.elapsed();
        tracing::info!(
            operation = %self.operation,
            duration_ms = duration.as_millis(),
            "Operation completed"
        );
    }

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
pub mod db {
    use super::*;

    pub fn log_query(query: &str, params_count: usize) {
        tracing::debug!(
            query = query,
            params_count = params_count,
            "Executing database query"
        );
    }

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

    pub fn log_transaction(operation: &str) {
        tracing::info!(
            transaction = operation,
            "Database transaction"
        );
    }
}

/// Log API operations
pub mod api {
    use super::*;

    pub fn log_request(url: &str, method: &str) {
        tracing::info!(
            url = url,
            method = method,
            "API request"
        );
    }

    pub fn log_response(url: &str, status: u16, duration_ms: u128) {
        if status >= 200 && status < 300 {
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
    use super::*;

    pub fn log_action(action: &str, details: Option<&str>) {
        if let Some(details) = details {
            tracing::info!(
                action = action,
                details = details,
                "User action"
            );
        } else {
            tracing::info!(
                action = action,
                "User action"
            );
        }
    }

    pub fn log_preference_change(key: &str, value: &str) {
        tracing::info!(
            preference = key,
            value = value,
            "User preference changed"
        );
    }
}
