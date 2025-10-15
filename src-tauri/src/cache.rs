/**
 * Cache Module
 *
 * Provides caching for metadata and addon responses with TTL support
 */
use anyhow::Result;
use rusqlite::{params, Connection};
use serde::{de::DeserializeOwned, Serialize};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub struct CacheManager {
    conn: Connection,
}

impl CacheManager {
    /// Create a new cache manager with in-memory or file-based storage
    pub fn new(cache_path: Option<&str>) -> Result<Self> {
        let conn = if let Some(path) = cache_path {
            Connection::open(path)?
        } else {
            Connection::open_in_memory()?
        };

        let cache = Self { conn };
        cache.init_tables()?;
        Ok(cache)
    }

    fn init_tables(&self) -> Result<()> {
        // Metadata cache table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS metadata_cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;

        // Addon response cache table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS addon_response_cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                addon_id TEXT NOT NULL
            )",
            [],
        )?;

        // Create index for faster expiration cleanup
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_metadata_expires 
             ON metadata_cache(expires_at)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_addon_expires 
             ON addon_response_cache(expires_at)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_addon_id 
             ON addon_response_cache(addon_id)",
            [],
        )?;

        Ok(())
    }

    /// Get current Unix timestamp in seconds
    fn now() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or_else(|_| {
                tracing::error!("System time is before UNIX_EPOCH, using 0");
                0
            })
    }

    /// Get metadata from cache
    pub fn get_metadata<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        let now = Self::now();

        let mut stmt = self.conn.prepare(
            "SELECT value FROM metadata_cache 
             WHERE key = ?1 AND expires_at > ?2",
        )?;

        let result = stmt.query_row(params![key, now], |row| {
            let value: String = row.get(0)?;
            Ok(value)
        });

        match result {
            Ok(value) => {
                let deserialized: T = serde_json::from_str(&value)?;
                Ok(Some(deserialized))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Set metadata in cache with TTL
    pub fn set_metadata<T: Serialize>(&self, key: &str, value: &T, ttl: Duration) -> Result<()> {
        let now = Self::now();
        let expires_at = now + ttl.as_secs();
        let value_json = serde_json::to_string(value)?;

        self.conn.execute(
            "INSERT OR REPLACE INTO metadata_cache (key, value, expires_at, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![key, value_json, expires_at, now],
        )?;

        Ok(())
    }

    /// Get addon response from cache
    pub fn get_addon_response<T: DeserializeOwned>(
        &self,
        key: &str,
        addon_id: &str,
    ) -> Result<Option<T>> {
        let now = Self::now();

        let mut stmt = self.conn.prepare(
            "SELECT value FROM addon_response_cache 
             WHERE key = ?1 AND addon_id = ?2 AND expires_at > ?3",
        )?;

        let result = stmt.query_row(params![key, addon_id, now], |row| {
            let value: String = row.get(0)?;
            Ok(value)
        });

        match result {
            Ok(value) => {
                let deserialized: T = serde_json::from_str(&value)?;
                Ok(Some(deserialized))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Set addon response in cache with TTL
    pub fn set_addon_response<T: Serialize>(
        &self,
        key: &str,
        addon_id: &str,
        value: &T,
        ttl: Duration,
    ) -> Result<()> {
        let now = Self::now();
        let expires_at = now + ttl.as_secs();
        let value_json = serde_json::to_string(value)?;

        self.conn.execute(
            "INSERT OR REPLACE INTO addon_response_cache 
             (key, value, expires_at, created_at, addon_id)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![key, value_json, expires_at, now, addon_id],
        )?;

        Ok(())
    }

    /// Clear all expired entries
    pub fn clear_expired(&self) -> Result<usize> {
        let now = Self::now();

        let metadata_deleted = self.conn.execute(
            "DELETE FROM metadata_cache WHERE expires_at <= ?1",
            params![now],
        )?;

        let addon_deleted = self.conn.execute(
            "DELETE FROM addon_response_cache WHERE expires_at <= ?1",
            params![now],
        )?;

        Ok(metadata_deleted + addon_deleted)
    }

    /// Clear all cache entries
    pub fn clear_all(&self) -> Result<()> {
        self.conn.execute("DELETE FROM metadata_cache", [])?;
        self.conn.execute("DELETE FROM addon_response_cache", [])?;
        Ok(())
    }

    /// Clear cache for specific addon
    pub fn clear_addon_cache(&self, addon_id: &str) -> Result<usize> {
        let deleted = self.conn.execute(
            "DELETE FROM addon_response_cache WHERE addon_id = ?1",
            params![addon_id],
        )?;
        Ok(deleted)
    }

    /// Get cache statistics
    pub fn get_stats(&self) -> Result<CacheStats> {
        let now = Self::now();

        let metadata_total: i64 =
            self.conn
                .query_row("SELECT COUNT(*) FROM metadata_cache", [], |row| row.get(0))?;

        let metadata_expired: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM metadata_cache WHERE expires_at <= ?1",
            params![now],
            |row| row.get(0),
        )?;

        let addon_total: i64 =
            self.conn
                .query_row("SELECT COUNT(*) FROM addon_response_cache", [], |row| {
                    row.get(0)
                })?;

        let addon_expired: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM addon_response_cache WHERE expires_at <= ?1",
            params![now],
            |row| row.get(0),
        )?;

        Ok(CacheStats {
            metadata_total: metadata_total as usize,
            metadata_valid: (metadata_total - metadata_expired) as usize,
            metadata_expired: metadata_expired as usize,
            addon_total: addon_total as usize,
            addon_valid: (addon_total - addon_expired) as usize,
            addon_expired: addon_expired as usize,
        })
    }
}

/// Cache statistics
#[derive(Debug, Clone, serde::Serialize)]
pub struct CacheStats {
    pub metadata_total: usize,
    pub metadata_valid: usize,
    pub metadata_expired: usize,
    pub addon_total: usize,
    pub addon_valid: usize,
    pub addon_expired: usize,
}

/// Default cache TTL values
#[allow(dead_code)]
pub mod ttl {
    use std::time::Duration;

    /// TMDB metadata: 24 hours
    pub const METADATA: Duration = Duration::from_secs(24 * 3600);

    /// Catalog responses: 1 hour
    pub const CATALOG: Duration = Duration::from_secs(3600);

    /// Stream responses: 5 minutes (streams change frequently)
    pub const STREAM: Duration = Duration::from_secs(5 * 60);

    /// Addon manifests: 1 week
    pub const MANIFEST: Duration = Duration::from_secs(7 * 24 * 3600);

    /// Addon catalog responses: 1 hour
    pub const ADDON_CATALOG_TTL: Duration = Duration::from_secs(3600);

    /// Addon stream responses: 5 minutes
    pub const ADDON_STREAM_TTL: Duration = Duration::from_secs(5 * 60);
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize, PartialEq)]
    struct TestData {
        id: String,
        value: i32,
    }

    #[test]
    fn test_metadata_cache() {
        let cache = CacheManager::new(None).unwrap();
        let data = TestData {
            id: "test".to_string(),
            value: 42,
        };

        // Set and get
        cache
            .set_metadata("key1", &data, Duration::from_secs(60))
            .unwrap();
        let retrieved: Option<TestData> = cache.get_metadata("key1").unwrap();
        assert_eq!(retrieved, Some(data));

        // Non-existent key
        let missing: Option<TestData> = cache.get_metadata("missing").unwrap();
        assert_eq!(missing, None);
    }

    #[test]
    fn test_addon_cache() {
        let cache = CacheManager::new(None).unwrap();
        let data = TestData {
            id: "test".to_string(),
            value: 100,
        };

        cache
            .set_addon_response("key1", "addon1", &data, Duration::from_secs(60))
            .unwrap();

        let retrieved: Option<TestData> = cache.get_addon_response("key1", "addon1").unwrap();
        assert_eq!(retrieved, Some(data));

        // Different addon
        let missing: Option<TestData> = cache.get_addon_response("key1", "addon2").unwrap();
        assert_eq!(missing, None);
    }

    #[test]
    fn test_clear_operations() {
        let cache = CacheManager::new(None).unwrap();
        let data = TestData {
            id: "test".to_string(),
            value: 42,
        };

        cache
            .set_addon_response("key1", "addon1", &data, Duration::from_secs(60))
            .unwrap();
        cache
            .set_addon_response("key2", "addon2", &data, Duration::from_secs(60))
            .unwrap();

        // Clear specific addon
        let deleted = cache.clear_addon_cache("addon1").unwrap();
        assert_eq!(deleted, 1);

        // Clear all
        cache.clear_all().unwrap();
        let stats = cache.get_stats().unwrap();
        assert_eq!(stats.addon_total, 0);
    }

    #[test]
    fn test_cache_stats() {
        let cache = CacheManager::new(None).unwrap();
        let data = TestData {
            id: "test".to_string(),
            value: 42,
        };

        // Initially empty
        let stats = cache.get_stats().unwrap();
        assert_eq!(stats.metadata_total, 0);
        assert_eq!(stats.addon_total, 0);

        // Add some cache entries
        cache
            .set_metadata("key1", &data, Duration::from_secs(60))
            .unwrap();
        cache
            .set_metadata("key2", &data, Duration::from_secs(60))
            .unwrap();
        cache
            .set_addon_response("key1", "addon1", &data, Duration::from_secs(60))
            .unwrap();

        // Check stats
        let stats = cache.get_stats().unwrap();
        assert_eq!(stats.metadata_total, 2);
        assert_eq!(stats.metadata_valid, 2);
        assert_eq!(stats.metadata_expired, 0);
        assert_eq!(stats.addon_total, 1);
        assert_eq!(stats.addon_valid, 1);
        assert_eq!(stats.addon_expired, 0);
    }

    #[test]
    fn test_expired_cache_cleanup() {
        let cache = CacheManager::new(None).unwrap();
        let data = TestData {
            id: "test".to_string(),
            value: 42,
        };

        // Add entries with very short TTL (1 nanosecond to ensure immediate expiration)
        cache
            .set_metadata("expired1", &data, Duration::from_nanos(1))
            .unwrap();
        cache
            .set_metadata("expired2", &data, Duration::from_nanos(1))
            .unwrap();

        // Add entry with long TTL
        cache
            .set_metadata("valid", &data, Duration::from_secs(3600))
            .unwrap();

        // Give expired entries time to actually expire
        std::thread::sleep(Duration::from_millis(10));

        // Check that some are expired
        let stats = cache.get_stats().unwrap();
        assert_eq!(stats.metadata_total, 3);
        assert_eq!(stats.metadata_expired, 2);
        assert_eq!(stats.metadata_valid, 1);

        // Clear expired
        let deleted = cache.clear_expired().unwrap();
        assert_eq!(deleted, 2);

        // Check stats after cleanup
        let stats = cache.get_stats().unwrap();
        assert_eq!(stats.metadata_total, 1);
        assert_eq!(stats.metadata_expired, 0);
    }
}
