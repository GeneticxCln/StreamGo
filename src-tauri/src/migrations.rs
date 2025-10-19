/**
 * Database Migration System
 *
 * Manages schema versioning and stepwise migrations for StreamGo database
 */
use anyhow::{anyhow, Result};
use rusqlite::Connection;

/// Current schema version
pub const CURRENT_SCHEMA_VERSION: u32 = 10;

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

/// Migration v7: Add FTS5 full-text search for library items
struct Migration007FTS5Search;

impl Migration for Migration007FTS5Search {
    fn version(&self) -> u32 {
        7
    }

    fn description(&self) -> &str {
        "Add FTS5 virtual table for fast full-text search of library items"
    }

    fn up(&self, conn: &Connection) -> Result<()> {
        // Create FTS5 virtual table for full-text search
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS media_items_fts USING fts5(
                title, 
                description, 
                genre,
                content='media_items',
                content_rowid='rowid'
            )",
            [],
        )?;

        // Populate FTS table from existing data
        conn.execute(
            "INSERT INTO media_items_fts(rowid, title, description, genre)
             SELECT rowid, title, COALESCE(description, ''), genre
             FROM media_items",
            [],
        )?;

        // Create triggers to keep FTS in sync
        // Trigger for INSERT
        conn.execute(
            "CREATE TRIGGER IF NOT EXISTS media_items_fts_insert AFTER INSERT ON media_items BEGIN
                INSERT INTO media_items_fts(rowid, title, description, genre)
                VALUES (NEW.rowid, NEW.title, COALESCE(NEW.description, ''), NEW.genre);
             END",
            [],
        )?;

        // Trigger for UPDATE
        conn.execute(
            "CREATE TRIGGER IF NOT EXISTS media_items_fts_update AFTER UPDATE ON media_items BEGIN
                UPDATE media_items_fts
                SET title = NEW.title,
                    description = COALESCE(NEW.description, ''),
                    genre = NEW.genre
                WHERE rowid = NEW.rowid;
             END",
            [],
        )?;

        // Trigger for DELETE
        conn.execute(
            "CREATE TRIGGER IF NOT EXISTS media_items_fts_delete AFTER DELETE ON media_items BEGIN
                DELETE FROM media_items_fts WHERE rowid = OLD.rowid;
             END",
            [],
        )?;

        tracing::info!("Created FTS5 virtual table for library search");
        Ok(())
    }
}

/// Migration v8: Add local media scanning and storage tables
struct Migration008LocalMedia;

impl Migration for Migration008LocalMedia {
    fn version(&self) -> u32 {
        8
    }

    fn description(&self) -> &str {
        "Add local media scanning tables for local file management"
    }

    fn up(&self, conn: &Connection) -> Result<()> {
        // Local media files table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS local_media_files (
                id TEXT PRIMARY KEY,
                file_path TEXT NOT NULL UNIQUE,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                title TEXT NOT NULL,
                year INTEGER,
                season INTEGER,
                episode INTEGER,
                duration REAL,
                resolution TEXT,
                video_codec TEXT,
                audio_codec TEXT,
                tmdb_id TEXT,
                imdb_id TEXT,
                poster_url TEXT,
                added_at TEXT NOT NULL,
                last_modified TEXT NOT NULL,
                last_scanned TEXT NOT NULL
            )",
            [],
        )?;

        // Scanned directories table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS scanned_directories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL UNIQUE,
                enabled BOOLEAN DEFAULT 1,
                recursive BOOLEAN DEFAULT 1,
                last_scan TEXT,
                file_count INTEGER DEFAULT 0,
                added_at TEXT NOT NULL
            )",
            [],
        )?;

        // Local media scan history
        conn.execute(
            "CREATE TABLE IF NOT EXISTS local_scan_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                directory_path TEXT NOT NULL,
                scan_started TEXT NOT NULL,
                scan_completed TEXT,
                files_found INTEGER DEFAULT 0,
                files_added INTEGER DEFAULT 0,
                files_updated INTEGER DEFAULT 0,
                files_removed INTEGER DEFAULT 0,
                success BOOLEAN DEFAULT 0,
                error_message TEXT
            )",
            [],
        )?;

        // Create indexes for local media
        self.create_local_media_indexes(conn)?;

        tracing::info!("Created local media scanning tables");
        Ok(())
    }
}

impl Migration008LocalMedia {
    fn create_local_media_indexes(&self, conn: &Connection) -> Result<()> {
        // Local media files indexes
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_local_media_title 
             ON local_media_files(title COLLATE NOCASE)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_local_media_year 
             ON local_media_files(year)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_local_media_season_episode 
             ON local_media_files(season, episode)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_local_media_tmdb 
             ON local_media_files(tmdb_id)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_local_media_imdb 
             ON local_media_files(imdb_id)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_local_media_added 
             ON local_media_files(added_at DESC)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_local_media_modified 
             ON local_media_files(last_modified DESC)",
            [],
        )?;

        // Scanned directories indexes
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_scanned_dirs_enabled 
             ON scanned_directories(enabled)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_scanned_dirs_scan 
             ON scanned_directories(last_scan DESC)",
            [],
        )?;

        // Scan history indexes
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_scan_history_started 
             ON local_scan_history(scan_started DESC)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_scan_history_directory 
             ON local_scan_history(directory_path, scan_started DESC)",
            [],
        )?;

        Ok(())
    }
}

/// Migration v9: Live TV channels and EPG tables
struct Migration009LiveTv;

/// Migration v10: Add addon ratings and skip segments tables
struct Migration010RatingsAndSkips;

impl Migration for Migration009LiveTv {
    fn version(&self) -> u32 { 9 }
    fn description(&self) -> &str { "Add live TV channels and EPG tables" }
    fn up(&self, conn: &Connection) -> Result<()> {
        // Channels table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS live_tv_channels (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                logo TEXT,
                channel_group TEXT,
                tvg_id TEXT,
                stream_url TEXT NOT NULL
            )",
            [],
        )?;

        // EPG programs table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS epg_programs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                channel_id TEXT NOT NULL,
                start INTEGER NOT NULL,
                end INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT,
                season INTEGER,
                episode INTEGER,
                FOREIGN KEY(channel_id) REFERENCES live_tv_channels(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Indexes
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_live_tv_channels_group ON live_tv_channels(channel_group)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_epg_channel_time ON epg_programs(channel_id, start)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_epg_time ON epg_programs(start, end)",
            [],
        )?;

        Ok(())
    }
}

impl Migration for Migration010RatingsAndSkips {
    fn version(&self) -> u32 { 10 }
    fn description(&self) -> &str { "Add addon ratings and skip segments tables" }
    fn up(&self, conn: &Connection) -> Result<()> {
        // Addon ratings (per-user)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS addon_ratings (
                addon_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
                rated_at TEXT NOT NULL,
                PRIMARY KEY (addon_id, user_id),
                FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Addon rating summary (aggregated + weighted)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS addon_rating_summary (
                addon_id TEXT PRIMARY KEY,
                rating_avg REAL NOT NULL DEFAULT 0,
                rating_count INTEGER NOT NULL DEFAULT 0,
                weighted_rating REAL NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE CASCADE
            )",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_addon_ratings_addon ON addon_ratings(addon_id)",
            [],
        )?;

        // Skip segments per media item
        conn.execute(
            "CREATE TABLE IF NOT EXISTS skip_segments (
                media_id TEXT PRIMARY KEY,
                intro_start REAL,
                intro_end REAL,
                outro_start REAL,
                outro_end REAL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

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
            Box::new(Migration007FTS5Search),
            Box::new(Migration008LocalMedia),
            Box::new(Migration009LiveTv),
            Box::new(Migration010RatingsAndSkips),
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
