use rusqlite::{params, Connection, Result};
use anyhow::anyhow;
use crate::models::*;
use dirs;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new() -> Result<Self, anyhow::Error> {
        let app_data_dir = dirs::data_local_dir()
            .ok_or_else(|| anyhow!("Could not find app data directory"))?
            .join("StreamGo");
        
        std::fs::create_dir_all(&app_data_dir)?;
        let db_path = app_data_dir.join("streamgo.db");
        
        let conn = Connection::open(db_path)?;
        let db = Database { conn };
        db.initialize_tables()?;
        Ok(db)
    }

    fn initialize_tables(&self) -> Result<(), anyhow::Error> {
        // Media items table
        self.conn.execute(
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
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS user_profiles (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                email TEXT,
                preferences TEXT NOT NULL
            )",
            [],
        )?;

        // Library associations table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS library_items (
                user_id TEXT NOT NULL,
                media_id TEXT NOT NULL,
                list_type TEXT NOT NULL, -- 'library', 'watchlist', 'favorites'
                added_at TEXT NOT NULL,
                PRIMARY KEY (user_id, media_id, list_type)
            )",
            [],
        )?;

        // Addons table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS addons (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                description TEXT,
                author TEXT,
                url TEXT,
                enabled BOOLEAN DEFAULT 1,
                addon_type TEXT NOT NULL,
                manifest TEXT NOT NULL
            )",
            [],
        )?;

        Ok(())
    }

    pub fn get_library_items(&self) -> Result<Vec<MediaItem>, anyhow::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, media_type, year, genre, description, poster_url, backdrop_url, 
                    rating, duration, added_to_library, watched, progress 
             FROM media_items"
        )?;

        let media_iter = stmt.query_map([], |row| {
            let genre_str: String = row.get(4)?;
            let genres: Vec<String> = if genre_str.is_empty() {
                Vec::new()
            } else {
                genre_str.split(',').map(|s| s.to_string()).collect()
            };

            let media_type_str: String = row.get(2)?;
            let media_type = match media_type_str.as_str() {
                "Movie" => MediaType::Movie,
                "TvShow" => MediaType::TvShow,
                "Episode" => MediaType::Episode,
                "Documentary" => MediaType::Documentary,
                "LiveTv" => MediaType::LiveTv,
                "Podcast" => MediaType::Podcast,
                _ => MediaType::Movie, // Default fallback
            };

            let added_to_library = if let Ok(date_str) = row.get::<_, String>(10) {
                chrono::DateTime::parse_from_rfc3339(&date_str)
                    .ok()
                    .map(|dt| dt.with_timezone(&chrono::Utc))
            } else {
                None
            };

            Ok(MediaItem {
                id: row.get(0)?,
                title: row.get(1)?,
                media_type,
                year: row.get(3)?,
                genre: genres,
                description: row.get(5)?,
                poster_url: row.get(6)?,
                backdrop_url: row.get(7)?,
                rating: row.get(8)?,
                duration: row.get(9)?,
                added_to_library,
                watched: row.get(11)?,
                progress: row.get(12)?,
            })
        })?;

        let mut items = Vec::new();
        for item in media_iter {
            items.push(item?);
        }
        Ok(items)
    }

    pub fn add_to_library(&self, item: MediaItem) -> Result<(), anyhow::Error> {
        let genre_str = item.genre.join(",");
        let media_type_str = match item.media_type {
            MediaType::Movie => "Movie",
            MediaType::TvShow => "TvShow",
            MediaType::Episode => "Episode",
            MediaType::Documentary => "Documentary",
            MediaType::LiveTv => "LiveTv",
            MediaType::Podcast => "Podcast",
        };

        let added_to_library_str = item.added_to_library
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

        self.conn.execute(
            "INSERT OR REPLACE INTO media_items 
             (id, title, media_type, year, genre, description, poster_url, backdrop_url, 
              rating, duration, added_to_library, watched, progress)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                item.id,
                item.title,
                media_type_str,
                item.year,
                genre_str,
                item.description,
                item.poster_url,
                item.backdrop_url,
                item.rating,
                item.duration,
                added_to_library_str,
                item.watched,
                item.progress
            ],
        )?;

        Ok(())
    }

    pub fn get_user_profile(&self, user_id: &str) -> Result<Option<UserProfile>, anyhow::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT id, username, email, preferences FROM user_profiles WHERE id = ?1"
        )?;

        let mut rows = stmt.query_map([user_id], |row| {
            let preferences_json: String = row.get(3)?;
            let preferences: UserPreferences = serde_json::from_str(&preferences_json)
                .unwrap_or_default();

            Ok(UserProfile {
                id: row.get(0)?,
                username: row.get(1)?,
                email: row.get(2)?,
                preferences,
                library_items: Vec::new(), // Will be populated separately
                watchlist: Vec::new(),
                favorites: Vec::new(),
            })
        })?;

        if let Some(row) = rows.next() {
            Ok(Some(row?))
        } else {
            Ok(None)
        }
    }

    pub fn save_user_profile(&self, profile: &UserProfile) -> Result<(), anyhow::Error> {
        let preferences_json = serde_json::to_string(&profile.preferences)?;

        self.conn.execute(
            "INSERT OR REPLACE INTO user_profiles (id, username, email, preferences)
             VALUES (?1, ?2, ?3, ?4)",
            params![profile.id, profile.username, profile.email, preferences_json],
        )?;

        Ok(())
    }

    pub fn get_addons(&self) -> Result<Vec<Addon>, anyhow::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, version, description, author, url, enabled, addon_type, manifest 
             FROM addons"
        )?;

        let addon_iter = stmt.query_map([], |row| {
            let addon_type_str: String = row.get(7)?;
            let addon_type = match addon_type_str.as_str() {
                "ContentProvider" => AddonType::ContentProvider,
                "MetadataProvider" => AddonType::MetadataProvider,
                "Subtitles" => AddonType::Subtitles,
                "Player" => AddonType::Player,
                _ => AddonType::ContentProvider,
            };

            let manifest_json: String = row.get(8)?;
            let manifest: AddonManifest = serde_json::from_str(&manifest_json)
                .map_err(|_| rusqlite::Error::InvalidColumnType(8, "Invalid JSON".to_string(), rusqlite::types::Type::Text))?;

            Ok(Addon {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                description: row.get(3)?,
                author: row.get(4)?,
                url: row.get(5)?,
                enabled: row.get(6)?,
                addon_type,
                manifest,
            })
        })?;

        let mut addons = Vec::new();
        for addon in addon_iter {
            addons.push(addon?);
        }
        Ok(addons)
    }

    pub fn save_addon(&self, addon: &Addon) -> Result<(), anyhow::Error> {
        let addon_type_str = match addon.addon_type {
            AddonType::ContentProvider => "ContentProvider",
            AddonType::MetadataProvider => "MetadataProvider",
            AddonType::Subtitles => "Subtitles",
            AddonType::Player => "Player",
        };

        let manifest_json = serde_json::to_string(&addon.manifest)?;

        self.conn.execute(
            "INSERT OR REPLACE INTO addons 
             (id, name, version, description, author, url, enabled, addon_type, manifest)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                addon.id,
                addon.name,
                addon.version,
                addon.description,
                addon.author,
                addon.url,
                addon.enabled,
                addon_type_str,
                manifest_json
            ],
        )?;

        Ok(())
    }
}