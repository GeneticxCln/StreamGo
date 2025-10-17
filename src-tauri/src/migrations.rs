/**
 * Database Migration System
 *
 * Manages schema versioning and stepwise migrations for StreamGo database
 */
use anyhow::{anyhow, Result};
use rusqlite::Connection;

/// Current schema version
pub const CURRENT_SCHEMA_VERSION: u32 = 6;

/// Migration trait for implementing version upgrades
pub trait Migration {
    fn version(&self) -> u32;
    fn up(&self, conn: &Connection) -> Result<()>;
    fn description(&self) -> &str;
}

/// Initial schema migration (v1)
struct Migration001InitialSchema;

impl Migration for Migration001InitialSchema {
    fn version(&self) -> u32 {
        1
    }

    fn description(&self) -> &str {
        "Initial schema with all tables and indexes"
    }

    fn up(&self, conn: &Connection) -> Result<()> {
        // Media items table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS media_items (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                media_type TEXT NOT NULL,
                year INTEGER,
                genre TEXT,
                description TEXT,
                poster_url TEXT,
                backdrop_url TEXT,
                rating REAL,
                duration INTEGER,
                added_to_library TEXT,
                watched BOOLEAN DEFAULT 0,
                progress INTEGER DEFAULT 0
            )",
            [],
        )?;

        // User profiles table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS user_profiles (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                email TEXT,
                preferences TEXT NOT NULL
            )",
            [],
        )?;

        // Library associations table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS library_items (
                user_id TEXT NOT NULL,
                media_id TEXT NOT NULL,
                list_type TEXT NOT NULL,
                added_at TEXT NOT NULL,
                PRIMARY KEY (user_id, media_id, list_type)
            )",
            [],
        )?;

        // Addons table with security improvements
        conn.execute(
            "CREATE TABLE IF NOT EXISTS addons (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                description TEXT,
                author TEXT,
                url TEXT,
                enabled BOOLEAN DEFAULT 0,
                addon_type TEXT NOT NULL,
                manifest TEXT NOT NULL,
                installed_at TEXT NOT NULL,
                priority INTEGER DEFAULT 0
            )",
            [],
        )?;

        // Playlists table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                item_count INTEGER DEFAULT 0
            )",
            [],
        )?;

        // Playlist items table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS playlist_items (
                playlist_id TEXT NOT NULL,
                media_id TEXT NOT NULL,
                position INTEGER NOT NULL,
                added_at TEXT NOT NULL,
                PRIMARY KEY (playlist_id, media_id),
                FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
                FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Cache tables
        conn.execute(
            "CREATE TABLE IF NOT EXISTS metadata_cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS addon_response_cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                addon_id TEXT NOT NULL
            )",
            [],
        )?;

        // Create indexes
        self.create_indexes(conn)?;

        Ok(())
    }
}

impl Migration001InitialSchema {
    fn create_indexes(&self, conn: &Connection) -> Result<()> {
        // Playlist items ordering
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_playlist_items_position 
             ON playlist_items(playlist_id, position)",
            [],
        )?;

        // Media items - frequently queried fields
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_media_items_type 
             ON media_items(media_type)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_media_items_watched 
             ON media_items(watched)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_media_items_added 
             ON media_items(added_to_library)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_media_items_title 
             ON media_items(title COLLATE NOCASE)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_media_items_rating 
             ON media_items(rating DESC)",
            [],
        )?;

        // Library items - list type filtering
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_library_items_user_type 
             ON library_items(user_id, list_type)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_library_items_media 
             ON library_items(media_id)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_library_items_added 
             ON library_items(added_at DESC)",
            [],
        )?;

        // Addons - enabled filter and priority
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_addons_enabled 
             ON addons(enabled)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_addons_priority 
             ON addons(priority DESC, enabled)",
            [],
        )?;

        // Playlists - user lookups
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_playlists_user 
             ON playlists(user_id)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_playlists_updated 
             ON playlists(updated_at DESC)",
            [],
        )?;

        // Cache indexes for cleanup
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_metadata_cache_expires 
             ON metadata_cache(expires_at)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_addon_cache_expires 
             ON addon_response_cache(expires_at)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_addon_cache_addon 
             ON addon_response_cache(addon_id)",
            [],
        )?;

        Ok(())
    }
}

/// Migration v3: Ensure addons table has installed_at and priority columns for legacy DBs
struct Migration003AddonColumns;

impl Migration for Migration003AddonColumns {
    fn version(&self) -> u32 {
        3
    }
    fn description(&self) -> &str {
        "Ensure addons table has installed_at and priority columns (legacy upgrades)"
    }
    fn up(&self, conn: &Connection) -> Result<()> {
        // Inspect existing columns
        let mut stmt = conn.prepare("PRAGMA table_info(addons)")?;
        let mut rows = stmt.query([])?;
        let mut has_installed_at = false;
        let mut has_priority = false;
        while let Some(row) = rows.next()? {
            // PRAGMA table_info columns: cid, name, type, notnull, dflt_value, pk
            let col_name: String = row.get(1)?;
            if col_name == "installed_at" {
                has_installed_at = true;
            }
            if col_name == "priority" {
                has_priority = true;
            }
        }
        if !has_installed_at {
            conn.execute("ALTER TABLE addons ADD COLUMN installed_at TEXT", [])?;
            // Backfill with current timestamp for existing rows
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "UPDATE addons SET installed_at = ?1 WHERE installed_at IS NULL",
                [now],
            )?;
        }
        if !has_priority {
            conn.execute(
                "ALTER TABLE addons ADD COLUMN priority INTEGER DEFAULT 0",
                [],
            )?;
            conn.execute("UPDATE addons SET priority = 0 WHERE priority IS NULL", [])?;
        }
        // Ensure index exists for priority
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_addons_priority ON addons(priority DESC, enabled)",
            [],
        )?;
        Ok(())
    }
}

/// Migration v2: Add addon health tracking
struct Migration002AddonHealth;

impl Migration for Migration002AddonHealth {
    fn version(&self) -> u32 {
        2
    }

    fn description(&self) -> &str {
        "Add addon health metrics tracking table"
    }

    fn up(&self, conn: &Connection) -> Result<()> {
        // Addon health metrics table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS addon_health (
                addon_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                response_time_ms INTEGER NOT NULL,
                success BOOLEAN NOT NULL,
                error_message TEXT,
                item_count INTEGER DEFAULT 0,
                operation_type TEXT NOT NULL,
                PRIMARY KEY (addon_id, timestamp)
            )",
            [],
        )?;

        // Addon health summary (rolling statistics)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS addon_health_summary (
                addon_id TEXT PRIMARY KEY,
                last_check INTEGER NOT NULL,
                success_rate REAL NOT NULL,
                avg_response_time_ms INTEGER NOT NULL,
                total_requests INTEGER NOT NULL,
                successful_requests INTEGER NOT NULL,
                failed_requests INTEGER NOT NULL,
                last_error TEXT,
                health_score REAL NOT NULL
            )",
            [],
        )?;

        // Indexes for health metrics
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_addon_health_timestamp 
             ON addon_health(timestamp DESC)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_addon_health_addon 
             ON addon_health(addon_id, timestamp DESC)",
            [],
        )?;

        Ok(())
    }
}

/// Migration v4: Ensure addon URLs are not null and validate existing addons
struct Migration004ValidateAddonUrls;

impl Migration for Migration004ValidateAddonUrls {
    fn version(&self) -> u32 {
        4
    }
    fn description(&self) -> &str {
        "Validate addon URLs are not null and remove invalid addons"
    }
    fn up(&self, conn: &Connection) -> Result<()> {
        // Delete any addons with NULL, empty, or invalid URLs
        // This includes placeholder "built-in" URLs and non-HTTP URLs
        conn.execute(
            "DELETE FROM addons WHERE url IS NULL OR url = '' OR url = 'built-in' OR url NOT LIKE 'http%'",
            [],
        )?;
        
        tracing::info!("Cleaned up addons with invalid URLs");
        Ok(())
    }
}

/// Migration v5: Add episodes table for series/TV show support
struct Migration005Episodes;

impl Migration for Migration005Episodes {
    fn version(&self) -> u32 {
        5
    }

    fn description(&self) -> &str {
        "Add episodes table for series and TV show episode tracking"
    }

    fn up(&self, conn: &Connection) -> Result<()> {
        // Episodes table for caching series episodes
        conn.execute(
            "CREATE TABLE IF NOT EXISTS episodes (
                id TEXT PRIMARY KEY,
                series_id TEXT NOT NULL,
                season INTEGER NOT NULL,
                episode INTEGER NOT NULL,
                title TEXT NOT NULL,
                overview TEXT,
                thumbnail TEXT,
                released TEXT,
                runtime TEXT,
                watched BOOLEAN DEFAULT 0,
                progress INTEGER DEFAULT 0,
                added_at TEXT NOT NULL,
                FOREIGN KEY (series_id) REFERENCES media_items(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create indexes for efficient episode queries
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_episodes_series 
             ON episodes(series_id, season, episode)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_episodes_watched 
             ON episodes(series_id, watched)",
            [],
        )?;

        tracing::info!("Created episodes table for series support");
        Ok(())
    }
}

/// Migration v6: Add addon configuration table
struct Migration006AddonConfig;

impl Migration for Migration006AddonConfig {
    fn version(&self) -> u32 {
        6
    }

    fn description(&self) -> &str {
        "Add addon configuration table for storing user settings per addon"
    }

    fn up(&self, conn: &Connection) -> Result<()> {
        // Addon configuration table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS addon_config (
                addon_id TEXT NOT NULL,
                config_key TEXT NOT NULL,
                config_value TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (addon_id, config_key),
                FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Index for quick addon config lookup
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_addon_config_addon 
             ON addon_config(addon_id)",
            [],
        )?;

        tracing::info!("Created addon_config table for addon settings");
        Ok(())
    }
}

/// Migration runner
pub struct MigrationRunner {
    migrations: Vec<Box<dyn Migration>>,
}

impl MigrationRunner {
    pub fn new() -> Self {
        let migrations: Vec<Box<dyn Migration>> = vec![
            Box::new(Migration001InitialSchema),
            Box::new(Migration002AddonHealth),
            Box::new(Migration003AddonColumns),
            Box::new(Migration004ValidateAddonUrls),
            Box::new(Migration005Episodes),
            Box::new(Migration006AddonConfig),
        ];
        Self { migrations }
    }

    /// Get current schema version from database
    pub fn get_current_version(conn: &Connection) -> Result<u32> {
        let version: u32 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap_or(0);
        Ok(version)
    }

    /// Set schema version in database
    fn set_version(conn: &Connection, version: u32) -> Result<()> {
        conn.execute(&format!("PRAGMA user_version = {}", version), [])?;
        Ok(())
    }

    /// Run all pending migrations
    pub fn run_migrations(&self, conn: &Connection) -> Result<()> {
        let current_version = Self::get_current_version(conn)?;

        tracing::info!(
            current_version = current_version,
            target_version = CURRENT_SCHEMA_VERSION,
            "Checking for database migrations"
        );

        if current_version == CURRENT_SCHEMA_VERSION {
            tracing::info!("Database schema is up to date");
            return Ok(());
        }

        if current_version > CURRENT_SCHEMA_VERSION {
            return Err(anyhow!(
                "Database schema version {} is newer than application version {}. Please update the application.",
                current_version,
                CURRENT_SCHEMA_VERSION
            ));
        }

        // Run migrations in order
        for migration in &self.migrations {
            if migration.version() > current_version {
                tracing::info!(
                    version = migration.version(),
                    description = migration.description(),
                    "Running migration"
                );

                // Run migration in a transaction
                let tx = conn.unchecked_transaction()?;
                migration.up(conn)?;
                Self::set_version(conn, migration.version())?;
                tx.commit()?;

                tracing::info!(
                    version = migration.version(),
                    "Migration completed successfully"
                );
            }
        }

        let final_version = Self::get_current_version(conn)?;
        tracing::info!(final_version = final_version, "All migrations completed");

        Ok(())
    }
}

impl Default for MigrationRunner {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_migration_runner() {
        let conn = Connection::open_in_memory().unwrap();
        let runner = MigrationRunner::new();

        // Initial version should be 0
        assert_eq!(MigrationRunner::get_current_version(&conn).unwrap(), 0);

        // Run migrations
        runner.run_migrations(&conn).unwrap();

        // Version should be updated
        assert_eq!(
            MigrationRunner::get_current_version(&conn).unwrap(),
            CURRENT_SCHEMA_VERSION
        );

        // Running again should be a no-op
        runner.run_migrations(&conn).unwrap();
        assert_eq!(
            MigrationRunner::get_current_version(&conn).unwrap(),
            CURRENT_SCHEMA_VERSION
        );
    }

    #[test]
    fn test_migration_creates_tables() {
        let conn = Connection::open_in_memory().unwrap();
        let runner = MigrationRunner::new();

        runner.run_migrations(&conn).unwrap();

        // Check that tables exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert!(tables.contains(&"media_items".to_string()));
        assert!(tables.contains(&"user_profiles".to_string()));
        assert!(tables.contains(&"library_items".to_string()));
        assert!(tables.contains(&"addons".to_string()));
        assert!(tables.contains(&"playlists".to_string()));
        assert!(tables.contains(&"metadata_cache".to_string()));
    }
}
