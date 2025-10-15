# Health Monitoring & Diagnostics

**Version**: 1.0  
**Added in**: StreamGo v0.2  
**Status**: ✅ Complete

---

## Overview

StreamGo includes a comprehensive health monitoring and diagnostics system that tracks addon performance, application metrics, and system health in real-time. This enables users to identify problematic addons, optimize performance, and export diagnostic data for troubleshooting.

---

## Features

### 1. Addon Health Tracking

The system continuously monitors all installed addons and tracks:

- **Success Rate**: Percentage of successful requests vs. failed requests
- **Response Time**: Average response time in milliseconds
- **Request Count**: Total number of requests made to each addon
- **Error Messages**: Last error message when a request fails
- **Health Score**: Calculated score (0-100) based on performance

#### Health Score Calculation

The health score is calculated using:
- **70% weight**: Success rate (% of successful requests)
- **30% weight**: Response time performance
  - < 500ms: 30 points
  - 500-1000ms: 25 points
  - 1000-2000ms: 20 points
  - 2000-3000ms: 15 points
  - \> 3000ms: 10 points

#### Health Status Badges

- **Excellent** (80-100): Green - Fast and reliable
- **Good** (60-79): Light Green - Acceptable performance
- **Fair** (40-59): Orange - Some issues
- **Poor** (0-39): Red - Frequent failures or slow

---

### 2. Performance Metrics

Global application metrics tracked include:

- **Total Requests**: All API/addon requests made
- **Successful Requests**: Requests that completed successfully
- **Failed Requests**: Requests that encountered errors
- **Average Response Time**: Mean response time across all requests
- **Cache Hits**: Number of times data was served from cache
- **Cache Misses**: Number of times data needed to be fetched

---

### 3. Cache Statistics

Track cache efficiency:

- **Metadata Cache**:
  - Total entries
  - Valid entries (not expired)
  - Expired entries
- **Addon Cache**:
  - Total entries
  - Valid entries
  - Expired entries

---

### 4. Diagnostics Export

Export comprehensive diagnostics for troubleshooting:

```json
{
  "timestamp": 1697XXX,
  "app_version": "0.2.0",
  "os": "Linux",
  "arch": "x86_64",
  "uptime_seconds": 3600,
  "log_path": "/home/user/.local/share/StreamGo/logs",
  "metrics": {
    "total_requests": 150,
    "successful_requests": 142,
    "failed_requests": 8,
    "avg_response_time_ms": 245,
    "cache_hits": 89,
    "cache_misses": 61
  }
}
```

---

## Backend API

### Tauri Commands

#### Get Addon Health Summaries

```rust
#[tauri::command]
async fn get_addon_health_summaries(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<AddonHealthSummary>, String>
```

Returns health summaries for all addons, sorted by health score (best first).

**Example Response**:
```json
[
  {
    "addon_id": "tmdb-metadata",
    "last_check": 1697XXX,
    "success_rate": 0.98,
    "avg_response_time_ms": 150,
    "total_requests": 100,
    "successful_requests": 98,
    "failed_requests": 2,
    "last_error": null,
    "health_score": 98.5
  }
]
```

#### Get Addon Health

```rust
#[tauri::command]
async fn get_addon_health(
    addon_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<AddonHealthSummary>, String>
```

Returns health summary for a specific addon.

#### Get Performance Metrics

```rust
#[tauri::command]
async fn get_performance_metrics() -> Result<PerformanceMetrics, String>
```

Returns current global performance metrics.

#### Export Diagnostics

```rust
#[tauri::command]
async fn export_diagnostics() -> Result<DiagnosticsInfo, String>
```

Exports complete diagnostics information as JSON.

#### Export Diagnostics to File

```rust
#[tauri::command]
async fn export_diagnostics_file() -> Result<String, String>
```

Exports diagnostics to a timestamped JSON file and returns the file path.

#### Reset Performance Metrics

```rust
#[tauri::command]
async fn reset_performance_metrics() -> Result<(), String>
```

Resets all performance metrics to zero.

#### Get Cache Stats

```rust
#[tauri::command]
async fn get_cache_stats(
    state: tauri::State<'_, AppState>,
) -> Result<CacheStats, String>
```

Returns current cache statistics.

#### Clear Cache

```rust
#[tauri::command]
async fn clear_cache(
    state: tauri::State<'_, AppState>,
) -> Result<String, String>
```

Clears all cache entries.

#### Clear Expired Cache

```rust
#[tauri::command]
async fn clear_expired_cache(
    state: tauri::State<'_, AppState>,
) -> Result<usize, String>
```

Clears only expired cache entries and returns count of deleted entries.

---

## Frontend API

### TypeScript API Wrapper

Located in `src/health-api.ts`:

```typescript
// Get all addon health summaries
const summaries = await getAddonHealthSummaries();

// Get specific addon health
const health = await getAddonHealth('addon-id');

// Get performance metrics
const metrics = await getPerformanceMetrics();

// Export diagnostics
const diagnostics = await exportDiagnostics();

// Export to file
const filePath = await exportDiagnosticsFile();

// Reset metrics
await resetPerformanceMetrics();

// Cache management
const stats = await getCacheStats();
await clearCache();
const deletedCount = await clearExpiredCache();
```

### Helper Functions

```typescript
// Get health badge color class
const color = getHealthBadgeColor(score); // 'success', 'warning', 'poor', 'critical'

// Get health status text
const status = getHealthStatusText(score); // 'Excellent', 'Good', 'Fair', 'Poor'

// Format uptime
const uptime = formatUptime(seconds); // '2d 5h 30m'

// Calculate cache hit rate
const hitRate = getCacheHitRate(metrics); // percentage

// Calculate success rate
const successRate = getSuccessRate(metrics); // percentage
```

---

## UI Components

### Diagnostics Dashboard

Located at: **Navigation → Diagnostics**

Features:
- Real-time health overview
- Performance metrics display
- Cache statistics
- Addon health list
- Export diagnostics button
- Reset metrics button
- Refresh data button

### Addon Health Display

Enhanced addon cards show:
- Health status badge with color coding
- Success rate percentage
- Average response time
- Total request count

---

## Database Schema

### addon_health Table

```sql
CREATE TABLE addon_health (
    addon_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    item_count INTEGER DEFAULT 0,
    operation_type TEXT NOT NULL,
    PRIMARY KEY (addon_id, timestamp)
);
```

### addon_health_summary Table

```sql
CREATE TABLE addon_health_summary (
    addon_id TEXT PRIMARY KEY,
    last_check INTEGER NOT NULL,
    success_rate REAL NOT NULL,
    avg_response_time_ms INTEGER NOT NULL,
    total_requests INTEGER NOT NULL,
    successful_requests INTEGER NOT NULL,
    failed_requests INTEGER NOT NULL,
    last_error TEXT,
    health_score REAL NOT NULL
);
```

---

## Usage Examples

### Track an Addon Request

```rust
use crate::database::Database;

let db = Database::new()?;

// Record a successful request
db.record_addon_health(
    "addon-id",
    150, // response time in ms
    true, // success
    None, // no error
    10, // items returned
    "catalog" // operation type
)?;

// Record a failed request
db.record_addon_health(
    "addon-id",
    0,
    false,
    Some("Connection timeout"),
    0,
    "stream"
)?;
```

### Display Health in UI

```typescript
// In your component
import { getAddonHealthSummaries, getHealthBadgeColor, getHealthStatusText } from './health-api';

async function loadAddonHealth() {
  const summaries = await getAddonHealthSummaries();
  
  summaries.forEach(summary => {
    const badgeColor = getHealthBadgeColor(summary.health_score);
    const statusText = getHealthStatusText(summary.health_score);
    
    console.log(`${summary.addon_id}: ${statusText} (${summary.health_score})`);
  });
}
```

---

## Performance Considerations

### Data Retention

- Health records are automatically cleaned up after 30 days
- Summaries are kept indefinitely but updated as new data comes in
- Only the last 100 health records per addon are used for calculations

### Optimization

- Health summaries are materialized (pre-calculated) for fast access
- Indexes on timestamp and addon_id ensure quick queries
- Cache statistics use COUNT queries which are optimized

---

## Troubleshooting

### High Failed Request Rate

1. Check the addon's `last_error` field
2. Verify network connectivity
3. Check if the addon server is responding
4. Review addon logs for details

### Slow Response Times

1. Check addon server load
2. Verify network latency
3. Consider disabling slow addons
4. Increase timeout values if needed

### Cache Not Working

1. Check cache statistics for hit rate
2. Verify TTL settings are appropriate
3. Clear expired cache entries
4. Check disk space for cache database

---

## Future Enhancements

Planned improvements:
- [ ] Alerting system for failing addons
- [ ] Historical performance graphs
- [ ] Automatic addon disable on poor health
- [ ] Configurable health thresholds
- [ ] Email/notification when issues detected
- [ ] Comparative addon performance analysis

---

## Related Documentation

- [ADDON_PROTOCOL.md](../ADDON_PROTOCOL.md) - Addon protocol specification
- [PHASE_2_PROGRESS.md](PHASE_2_PROGRESS.md) - Implementation details
- [README.md](../README.md) - Main project documentation

---

**Last Updated**: 2025-10-15  
**Maintained by**: StreamGo Team
