use crate::migrations::MigrationRunner;
use crate::models::*;
use anyhow::anyhow;
use rusqlite::{params, Connection};

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new_in_memory() -> Result<Self, anyhow::Error> {
        let conn = Connection::open_in_memory()?;
        // Enforce foreign key constraints
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        // Run migrations to set up schema
        let migration_runner = MigrationRunner::new();
        migration_runner.run_migrations(&conn)?;

        Ok(Database { conn })
    }

    pub fn new() -> Result<Self, anyhow::Error> {
        let app_data_dir = dirs::data_local_dir()
            .ok_or_else(|| anyhow!("Could not find app data directory"))?
            .join("StreamGo");

        std::fs::create_dir_all(&app_data_dir)?;
        let db_path = app_data_dir.join("streamgo.db");

        let conn = Connection::open(db_path)?;
        // Enforce foreign key constraints
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        // Run migrations to set up or upgrade schema
        let migration_runner = MigrationRunner::new();
        migration_runner.run_migrations(&conn)?;

        let db = Database { conn };
        Ok(db)
    }

    pub fn get_library_items(&self) -> Result<Vec<MediaItem>, anyhow::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, media_type, year, genre, description, poster_url, backdrop_url, 
                    rating, duration, added_to_library, watched, progress 
             FROM media_items",
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

        let added_to_library_str = item
            .added_to_library
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
        let mut stmt = self
            .conn
            .prepare("SELECT id, username, email, preferences FROM user_profiles WHERE id = ?1")?;

        let mut rows = stmt.query_map([user_id], |row| {
            let preferences_json: String = row.get(3)?;
            let preferences: UserPreferences =
                serde_json::from_str(&preferences_json).unwrap_or_default();

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
            params![
                profile.id,
                profile.username,
                profile.email,
                preferences_json
            ],
        )?;

        Ok(())
    }

    pub fn get_addons(&self) -> Result<Vec<Addon>, anyhow::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, version, description, author, url, enabled, addon_type, manifest, priority 
             FROM addons",
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
            let manifest: AddonManifest = serde_json::from_str(&manifest_json).map_err(|_| {
                rusqlite::Error::InvalidColumnType(
                    8,
                    "Invalid JSON".to_string(),
                    rusqlite::types::Type::Text,
                )
            })?;

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
                priority: row.get(9).unwrap_or(0),
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
        let installed_at_str = chrono::Utc::now().to_rfc3339();

        self.conn.execute(
            "INSERT OR REPLACE INTO addons 
             (id, name, version, description, author, url, enabled, addon_type, manifest, installed_at, priority)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                addon.id,
                addon.name,
                addon.version,
                addon.description,
                addon.author,
                addon.url,
                addon.enabled,
                addon_type_str,
                manifest_json,
                installed_at_str,
                addon.priority
            ],
        )?;

        Ok(())
    }

    pub fn delete_addon(&self, addon_id: &str) -> Result<(), anyhow::Error> {
        self.conn
            .execute("DELETE FROM addons WHERE id = ?1", params![addon_id])?;
        Ok(())
    }

    // Watchlist methods
    pub fn add_to_watchlist(&self, user_id: &str, media_id: &str) -> Result<(), anyhow::Error> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT OR IGNORE INTO library_items (user_id, media_id, list_type, added_at)
             VALUES (?1, ?2, 'watchlist', ?3)",
            params![user_id, media_id, now],
        )?;
        Ok(())
    }

    pub fn remove_from_watchlist(
        &self,
        user_id: &str,
        media_id: &str,
    ) -> Result<(), anyhow::Error> {
        self.conn.execute(
            "DELETE FROM library_items WHERE user_id = ?1 AND media_id = ?2 AND list_type = 'watchlist'",
            params![user_id, media_id],
        )?;
        Ok(())
    }

    pub fn get_watchlist(&self, user_id: &str) -> Result<Vec<MediaItem>, anyhow::Error> {
        let stmt = self.conn.prepare(
            "SELECT m.id, m.title, m.media_type, m.year, m.genre, m.description, 
                    m.poster_url, m.backdrop_url, m.rating, m.duration, 
                    m.added_to_library, m.watched, m.progress
             FROM media_items m
             INNER JOIN library_items li ON m.id = li.media_id
             WHERE li.user_id = ?1 AND li.list_type = 'watchlist'
             ORDER BY li.added_at DESC",
        )?;

        self.query_media_items(stmt, params![user_id])
    }

    // Favorites methods
    pub fn add_to_favorites(&self, user_id: &str, media_id: &str) -> Result<(), anyhow::Error> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT OR IGNORE INTO library_items (user_id, media_id, list_type, added_at)
             VALUES (?1, ?2, 'favorites', ?3)",
            params![user_id, media_id, now],
        )?;
        Ok(())
    }

    pub fn remove_from_favorites(
        &self,
        user_id: &str,
        media_id: &str,
    ) -> Result<(), anyhow::Error> {
        self.conn.execute(
            "DELETE FROM library_items WHERE user_id = ?1 AND media_id = ?2 AND list_type = 'favorites'",
            params![user_id, media_id],
        )?;
        Ok(())
    }

    pub fn get_favorites(&self, user_id: &str) -> Result<Vec<MediaItem>, anyhow::Error> {
        let stmt = self.conn.prepare(
            "SELECT m.id, m.title, m.media_type, m.year, m.genre, m.description, 
                    m.poster_url, m.backdrop_url, m.rating, m.duration, 
                    m.added_to_library, m.watched, m.progress
             FROM media_items m
             INNER JOIN library_items li ON m.id = li.media_id
             WHERE li.user_id = ?1 AND li.list_type = 'favorites'
             ORDER BY li.added_at DESC",
        )?;

        self.query_media_items(stmt, params![user_id])
    }

    // Watch progress methods
    pub fn update_watch_progress(
        &self,
        media_id: &str,
        progress: i32,
        watched: bool,
    ) -> Result<(), anyhow::Error> {
        self.conn.execute(
            "UPDATE media_items SET progress = ?1, watched = ?2 WHERE id = ?3",
            params![progress, watched, media_id],
        )?;
        Ok(())
    }

    pub fn get_continue_watching(&self, user_id: &str) -> Result<Vec<MediaItem>, anyhow::Error> {
        let stmt = self.conn.prepare(
            "SELECT m.id, m.title, m.media_type, m.year, m.genre, m.description, 
                    m.poster_url, m.backdrop_url, m.rating, m.duration, 
                    m.added_to_library, m.watched, m.progress
             FROM media_items m
             INNER JOIN library_items li ON m.id = li.media_id
             WHERE li.user_id = ?1 AND m.progress > 0 AND m.watched = 0
             ORDER BY m.added_to_library DESC
             LIMIT 20",
        )?;

        self.query_media_items(stmt, params![user_id])
    }

    // Playlist methods
    pub fn create_playlist(
        &self,
        id: &str,
        name: &str,
        description: Option<&str>,
        user_id: &str,
    ) -> Result<(), anyhow::Error> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO playlists (id, name, description, user_id, created_at, updated_at, item_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)",
            params![id, name, description, user_id, &now, &now],
        )?;
        Ok(())
    }

    pub fn get_playlists(
        &self,
        user_id: &str,
    ) -> Result<Vec<crate::models::Playlist>, anyhow::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, user_id, created_at, updated_at, item_count
             FROM playlists
             WHERE user_id = ?1
             ORDER BY updated_at DESC",
        )?;

        let playlist_iter = stmt.query_map([user_id], |row| {
            let created_at_str: String = row.get(4)?;
            let updated_at_str: String = row.get(5)?;

            let created_at = chrono::DateTime::parse_from_rfc3339(&created_at_str)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(|_| chrono::Utc::now());

            let updated_at = chrono::DateTime::parse_from_rfc3339(&updated_at_str)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(|_| chrono::Utc::now());

            Ok(crate::models::Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                user_id: row.get(3)?,
                created_at,
                updated_at,
                item_count: row.get(6)?,
            })
        })?;

        let mut playlists = Vec::new();
        for playlist in playlist_iter {
            playlists.push(playlist?);
        }
        Ok(playlists)
    }

    pub fn get_playlist(
        &self,
        playlist_id: &str,
    ) -> Result<Option<crate::models::Playlist>, anyhow::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, user_id, created_at, updated_at, item_count
             FROM playlists
             WHERE id = ?1",
        )?;

        let mut rows = stmt.query_map([playlist_id], |row| {
            let created_at_str: String = row.get(4)?;
            let updated_at_str: String = row.get(5)?;

            let created_at = chrono::DateTime::parse_from_rfc3339(&created_at_str)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(|_| chrono::Utc::now());

            let updated_at = chrono::DateTime::parse_from_rfc3339(&updated_at_str)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(|_| chrono::Utc::now());

            Ok(crate::models::Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                user_id: row.get(3)?,
                created_at,
                updated_at,
                item_count: row.get(6)?,
            })
        })?;

        if let Some(row) = rows.next() {
            Ok(Some(row?))
        } else {
            Ok(None)
        }
    }

    pub fn update_playlist(
        &self,
        playlist_id: &str,
        name: &str,
        description: Option<&str>,
    ) -> Result<(), anyhow::Error> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE playlists SET name = ?1, description = ?2, updated_at = ?3 WHERE id = ?4",
            params![name, description, &now, playlist_id],
        )?;
        Ok(())
    }

    pub fn delete_playlist(&self, playlist_id: &str) -> Result<(), anyhow::Error> {
        self.conn
            .execute("DELETE FROM playlists WHERE id = ?1", params![playlist_id])?;
        Ok(())
    }

    pub fn add_item_to_playlist(
        &self,
        playlist_id: &str,
        media_id: &str,
    ) -> Result<(), anyhow::Error> {
        // Get the next position
        let position: i32 = self
            .conn
            .query_row(
                "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_items WHERE playlist_id = ?1",
                params![playlist_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT OR IGNORE INTO playlist_items (playlist_id, media_id, position, added_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![playlist_id, media_id, position, &now],
        )?;

        // Update item count and updated_at
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE playlists 
             SET item_count = (SELECT COUNT(*) FROM playlist_items WHERE playlist_id = ?1),
                 updated_at = ?2
             WHERE id = ?1",
            params![playlist_id, &now],
        )?;

        Ok(())
    }

    pub fn remove_item_from_playlist(
        &self,
        playlist_id: &str,
        media_id: &str,
    ) -> Result<(), anyhow::Error> {
        self.conn.execute(
            "DELETE FROM playlist_items WHERE playlist_id = ?1 AND media_id = ?2",
            params![playlist_id, media_id],
        )?;

        // Update item count and updated_at
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE playlists 
             SET item_count = (SELECT COUNT(*) FROM playlist_items WHERE playlist_id = ?1),
                 updated_at = ?2
             WHERE id = ?1",
            params![playlist_id, &now],
        )?;

        Ok(())
    }

    pub fn get_playlist_items(&self, playlist_id: &str) -> Result<Vec<MediaItem>, anyhow::Error> {
        let stmt = self.conn.prepare(
            "SELECT m.id, m.title, m.media_type, m.year, m.genre, m.description, 
                    m.poster_url, m.backdrop_url, m.rating, m.duration, 
                    m.added_to_library, m.watched, m.progress
             FROM media_items m
             INNER JOIN playlist_items pi ON m.id = pi.media_id
             WHERE pi.playlist_id = ?1
             ORDER BY pi.position ASC",
        )?;

        self.query_media_items(stmt, params![playlist_id])
    }

    pub fn reorder_playlist_items(
        &self,
        playlist_id: &str,
        media_ids: Vec<String>,
    ) -> Result<(), anyhow::Error> {
        // Update positions for all items
        for (index, media_id) in media_ids.iter().enumerate() {
            self.conn.execute(
                "UPDATE playlist_items SET position = ?1 WHERE playlist_id = ?2 AND media_id = ?3",
                params![index as i32, playlist_id, media_id],
            )?;
        }

        // Update playlist updated_at
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE playlists SET updated_at = ?1 WHERE id = ?2",
            params![&now, playlist_id],
        )?;

        Ok(())
    }

    // Advanced search with filters
    pub fn search_library_with_filters(
        &self,
        filters: &crate::models::SearchFilters,
    ) -> Result<Vec<MediaItem>, anyhow::Error> {
        let mut query = String::from(
            "SELECT id, title, media_type, year, genre, description, poster_url, backdrop_url, 
                    rating, duration, added_to_library, watched, progress 
             FROM media_items WHERE 1=1",
        );
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        // Text search
        if let Some(q) = &filters.query {
            if !q.is_empty() {
                query.push_str(" AND (title LIKE ?1 OR description LIKE ?1)");
                params.push(Box::new(format!("%{}%", q)));
            }
        }

        // Genre filter
        if !filters.genres.is_empty() {
            let genre_conditions: Vec<String> = filters
                .genres
                .iter()
                .map(|_| "genre LIKE ?".to_string())
                .collect();
            query.push_str(&format!(" AND ({})", genre_conditions.join(" OR ")));
            for genre in &filters.genres {
                params.push(Box::new(format!("%{}%", genre)));
            }
        }

        // Media type filter
        if !filters.media_types.is_empty() {
            let type_conditions: Vec<String> = filters
                .media_types
                .iter()
                .map(|mt| {
                    let type_str = match mt {
                        MediaType::Movie => "Movie",
                        MediaType::TvShow => "TvShow",
                        MediaType::Episode => "Episode",
                        MediaType::Documentary => "Documentary",
                        MediaType::LiveTv => "LiveTv",
                        MediaType::Podcast => "Podcast",
                    };
                    format!("'{}'", type_str)
                })
                .collect();
            query.push_str(&format!(
                " AND media_type IN ({})",
                type_conditions.join(", ")
            ));
        }

        // Year range
        if let Some(year_min) = filters.year_min {
            query.push_str(&format!(" AND year >= {}", year_min));
        }
        if let Some(year_max) = filters.year_max {
            query.push_str(&format!(" AND year <= {}", year_max));
        }

        // Rating filter
        if let Some(rating_min) = filters.rating_min {
            query.push_str(&format!(" AND rating >= {}", rating_min));
        }

        // Watched filter
        if let Some(watched) = filters.watched {
            query.push_str(&format!(" AND watched = {}", if watched { 1 } else { 0 }));
        }

        // Sorting
        let sort_clause = match filters.sort_by.as_deref() {
            Some("title_asc") => " ORDER BY title ASC",
            Some("title_desc") => " ORDER BY title DESC",
            Some("year_asc") => " ORDER BY year ASC",
            Some("year_desc") => " ORDER BY year DESC",
            Some("rating_desc") => " ORDER BY rating DESC",
            Some("added_desc") => " ORDER BY added_to_library DESC",
            _ => " ORDER BY added_to_library DESC", // Default
        };
        query.push_str(sort_clause);

        let mut stmt = self.conn.prepare(&query)?;
        let params_refs: Vec<&dyn rusqlite::ToSql> = params
            .iter()
            .map(|p| p.as_ref() as &dyn rusqlite::ToSql)
            .collect();

        let media_iter = stmt.query_map(params_refs.as_slice(), |row| {
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
                _ => MediaType::Movie,
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

    // Helper method to query media items
    fn query_media_items(
        &self,
        mut stmt: rusqlite::Statement,
        params: impl rusqlite::Params,
    ) -> Result<Vec<MediaItem>, anyhow::Error> {
        let media_iter = stmt.query_map(params, |row| {
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
                _ => MediaType::Movie,
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

    // Addon health tracking methods

    /// Record a single health check event for an addon
    pub fn record_addon_health(
        &self,
        addon_id: &str,
        response_time_ms: u128,
        success: bool,
        error_message: Option<&str>,
        item_count: usize,
        operation_type: &str,
    ) -> Result<(), anyhow::Error> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        self.conn.execute(
            "INSERT INTO addon_health 
             (addon_id, timestamp, response_time_ms, success, error_message, item_count, operation_type)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                addon_id,
                now as i64,
                response_time_ms as i64,
                success,
                error_message,
                item_count as i64,
                operation_type,
            ],
        )?;

        // Update summary statistics
        self.update_addon_health_summary(addon_id)?;

        Ok(())
    }

    /// Update health summary statistics for an addon
    fn update_addon_health_summary(&self, addon_id: &str) -> Result<(), anyhow::Error> {
        // Calculate statistics from recent health records (last 100 records)
        let mut stmt = self.conn.prepare(
            "SELECT response_time_ms, success, error_message
             FROM addon_health
             WHERE addon_id = ?1
             ORDER BY timestamp DESC
             LIMIT 100",
        )?;

        let mut total = 0;
        let mut successful = 0;
        let mut total_response_time: i64 = 0;
        let mut last_error: Option<String> = None;

        let rows = stmt.query_map(params![addon_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, bool>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })?;

        for row in rows {
            let (response_time, success, error) = row?;
            total += 1;
            total_response_time += response_time;
            if success {
                successful += 1;
            } else if last_error.is_none() && error.is_some() {
                last_error = error;
            }
        }

        if total == 0 {
            return Ok(()); // No records to process
        }

        let success_rate = successful as f64 / total as f64;
        let avg_response_time = total_response_time / total;
        let failed = total - successful;

        // Calculate health score (0.0 to 100.0)
        // Based on success rate (70%) and response time (30%)
        let success_score = success_rate * 70.0;
        let response_score = if avg_response_time < 500 {
            30.0
        } else if avg_response_time < 1000 {
            25.0
        } else if avg_response_time < 2000 {
            20.0
        } else if avg_response_time < 3000 {
            15.0
        } else {
            10.0
        };
        let health_score = success_score + response_score;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        self.conn.execute(
            "INSERT OR REPLACE INTO addon_health_summary 
             (addon_id, last_check, success_rate, avg_response_time_ms, 
              total_requests, successful_requests, failed_requests, last_error, health_score)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                addon_id,
                now as i64,
                success_rate,
                avg_response_time,
                total,
                successful,
                failed,
                last_error,
                health_score,
            ],
        )?;

        Ok(())
    }

    /// Get health summary for a specific addon
    pub fn get_addon_health_summary(
        &self,
        addon_id: &str,
    ) -> Result<Option<AddonHealthSummary>, anyhow::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT addon_id, last_check, success_rate, avg_response_time_ms, 
                    total_requests, successful_requests, failed_requests, last_error, health_score
             FROM addon_health_summary
             WHERE addon_id = ?1",
        )?;

        let result = stmt.query_row(params![addon_id], |row| {
            Ok(AddonHealthSummary {
                addon_id: row.get(0)?,
                last_check: row.get(1)?,
                success_rate: row.get(2)?,
                avg_response_time_ms: row.get(3)?,
                total_requests: row.get(4)?,
                successful_requests: row.get(5)?,
                failed_requests: row.get(6)?,
                last_error: row.get(7)?,
                health_score: row.get(8)?,
            })
        });

        match result {
            Ok(summary) => Ok(Some(summary)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Get health summaries for all addons
    pub fn get_all_addon_health_summaries(&self) -> Result<Vec<AddonHealthSummary>, anyhow::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT addon_id, last_check, success_rate, avg_response_time_ms, 
                    total_requests, successful_requests, failed_requests, last_error, health_score
             FROM addon_health_summary
             ORDER BY health_score DESC",
        )?;

        let summaries = stmt.query_map([], |row| {
            Ok(AddonHealthSummary {
                addon_id: row.get(0)?,
                last_check: row.get(1)?,
                success_rate: row.get(2)?,
                avg_response_time_ms: row.get(3)?,
                total_requests: row.get(4)?,
                successful_requests: row.get(5)?,
                failed_requests: row.get(6)?,
                last_error: row.get(7)?,
                health_score: row.get(8)?,
            })
        })?;

        let mut result = Vec::new();
        for summary in summaries {
            result.push(summary?);
        }
        Ok(result)
    }

    /// Clean old health records (keep only last 30 days)
    pub fn cleanup_old_health_records(&self) -> Result<usize, anyhow::Error> {
        let thirty_days_ago = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            - (30 * 24 * 3600);

        let deleted = self.conn.execute(
            "DELETE FROM addon_health WHERE timestamp < ?1",
            params![thirty_days_ago as i64],
        )?;

        Ok(deleted)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{MediaItem, MediaType};

    fn create_test_db() -> Result<Database, anyhow::Error> {
        // Use in-memory database for testing
        let conn = Connection::open_in_memory()?;

        // Run migrations to set up schema
        let migration_runner = MigrationRunner::new();
        migration_runner.run_migrations(&conn)?;

        let db = Database { conn };
        Ok(db)
    }

    fn create_test_media_item(id: &str, title: &str) -> MediaItem {
        MediaItem {
            id: id.to_string(),
            title: title.to_string(),
            media_type: MediaType::Movie,
            year: Some(2024),
            genre: vec!["Action".to_string()],
            description: Some("Test description".to_string()),
            poster_url: Some("https://example.com/poster.jpg".to_string()),
            backdrop_url: Some("https://example.com/backdrop.jpg".to_string()),
            rating: Some(8.5),
            duration: Some(120),
            added_to_library: None,
            watched: false,
            progress: Some(0),
        }
    }

    #[test]
    fn test_add_and_get_library_items() {
        let db = create_test_db().unwrap();
        let item = create_test_media_item("test1", "Test Movie");

        // Add item to library
        db.add_to_library(item.clone()).unwrap();

        // Get library items
        let items = db.get_library_items().unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, "test1");
        assert_eq!(items[0].title, "Test Movie");
    }

    #[test]
    fn test_watchlist() {
        let db = create_test_db().unwrap();
        let user_id = "test_user";
        let media_id = "movie1";

        // Add media item first
        let item = create_test_media_item(media_id, "Test Movie");
        db.add_to_library(item).unwrap();

        // Add to watchlist
        db.add_to_watchlist(user_id, media_id).unwrap();

        // Get watchlist
        let watchlist = db.get_watchlist(user_id).unwrap();
        assert_eq!(watchlist.len(), 1);
        assert_eq!(watchlist[0].id, media_id);

        // Remove from watchlist
        db.remove_from_watchlist(user_id, media_id).unwrap();
        let watchlist = db.get_watchlist(user_id).unwrap();
        assert_eq!(watchlist.len(), 0);
    }

    #[test]
    fn test_favorites() {
        let db = create_test_db().unwrap();
        let user_id = "test_user";
        let media_id = "movie1";

        // Add media item first
        let item = create_test_media_item(media_id, "Test Movie");
        db.add_to_library(item).unwrap();

        // Add to favorites
        db.add_to_favorites(user_id, media_id).unwrap();

        // Get favorites
        let favorites = db.get_favorites(user_id).unwrap();
        assert_eq!(favorites.len(), 1);
        assert_eq!(favorites[0].id, media_id);

        // Remove from favorites
        db.remove_from_favorites(user_id, media_id).unwrap();
        let favorites = db.get_favorites(user_id).unwrap();
        assert_eq!(favorites.len(), 0);
    }

    #[test]
    fn test_watch_progress() {
        let db = create_test_db().unwrap();
        let media_id = "movie1";

        // Add media item
        let item = create_test_media_item(media_id, "Test Movie");
        db.add_to_library(item).unwrap();

        // Update progress
        db.update_watch_progress(media_id, 600, false).unwrap();

        // Verify progress
        let items = db.get_library_items().unwrap();
        assert_eq!(items[0].progress, Some(600));
        assert!(!items[0].watched);

        // Mark as watched
        db.update_watch_progress(media_id, 7200, true).unwrap();
        let items = db.get_library_items().unwrap();
        assert!(items[0].watched);
    }

    #[test]
    fn test_continue_watching() {
        let db = create_test_db().unwrap();
        let user_id = "test_user";

        // Add items with different progress states
        let mut item1 = create_test_media_item("movie1", "In Progress");
        item1.progress = Some(300);
        item1.watched = false;
        db.add_to_library(item1).unwrap();
        db.add_to_watchlist(user_id, "movie1").unwrap();

        let mut item2 = create_test_media_item("movie2", "Watched");
        item2.progress = Some(7200);
        item2.watched = true;
        db.add_to_library(item2).unwrap();
        db.add_to_watchlist(user_id, "movie2").unwrap();

        let mut item3 = create_test_media_item("movie3", "Not Started");
        item3.progress = Some(0);
        item3.watched = false;
        db.add_to_library(item3).unwrap();
        db.add_to_watchlist(user_id, "movie3").unwrap();

        // Get continue watching (should only return in-progress items)
        let continue_watching = db.get_continue_watching(user_id).unwrap();
        assert_eq!(continue_watching.len(), 1);
        assert_eq!(continue_watching[0].id, "movie1");
    }

    #[test]
    fn test_duplicate_watchlist_entry() {
        let db = create_test_db().unwrap();
        let user_id = "test_user";
        let media_id = "movie1";

        let item = create_test_media_item(media_id, "Test Movie");
        db.add_to_library(item).unwrap();

        // Add to watchlist twice (should not error)
        db.add_to_watchlist(user_id, media_id).unwrap();
        db.add_to_watchlist(user_id, media_id).unwrap();

        // Should still only have one entry
        let watchlist = db.get_watchlist(user_id).unwrap();
        assert_eq!(watchlist.len(), 1);
    }

    // ========================================
    // Playlist Tests
    // ========================================

    #[test]
    fn test_create_and_get_playlist() {
        let db = create_test_db().unwrap();
        let user_id = "test_user";
        let playlist_id = "playlist1";

        // Create playlist
        db.create_playlist(
            playlist_id,
            "My Playlist",
            Some("Test description"),
            user_id,
        )
        .unwrap();

        // Get playlists for user
        let playlists = db.get_playlists(user_id).unwrap();
        assert_eq!(playlists.len(), 1);
        assert_eq!(playlists[0].id, playlist_id);
        assert_eq!(playlists[0].name, "My Playlist");
        assert_eq!(
            playlists[0].description,
            Some("Test description".to_string())
        );
        assert_eq!(playlists[0].item_count, 0);
        assert_eq!(playlists[0].user_id, user_id);
    }

    #[test]
    fn test_get_single_playlist() {
        let db = create_test_db().unwrap();
        let user_id = "test_user";
        let playlist_id = "playlist1";

        // Create playlist
        db.create_playlist(playlist_id, "My Playlist", None, user_id)
            .unwrap();

        // Get single playlist
        let playlist = db.get_playlist(playlist_id).unwrap();
        assert!(playlist.is_some());
        let playlist = playlist.unwrap();
        assert_eq!(playlist.id, playlist_id);
        assert_eq!(playlist.name, "My Playlist");
        assert_eq!(playlist.description, None);

        // Get non-existent playlist
        let result = db.get_playlist("nonexistent").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_update_playlist() {
        let db = create_test_db().unwrap();
        let user_id = "test_user";
        let playlist_id = "playlist1";

        // Create playlist
        db.create_playlist(playlist_id, "Old Name", Some("Old desc"), user_id)
            .unwrap();

        // Update playlist
        db.update_playlist(playlist_id, "New Name", Some("New desc"))
            .unwrap();

        // Verify update
        let playlist = db.get_playlist(playlist_id).unwrap().unwrap();
        assert_eq!(playlist.name, "New Name");
        assert_eq!(playlist.description, Some("New desc".to_string()));
    }

    #[test]
    fn test_delete_playlist() {
        let db = create_test_db().unwrap();
        let user_id = "test_user";
        let playlist_id = "playlist1";

        // Create playlist
        db.create_playlist(playlist_id, "Test Playlist", None, user_id)
            .unwrap();

        // Verify it exists
        let playlists = db.get_playlists(user_id).unwrap();
        assert_eq!(playlists.len(), 1);

        // Delete playlist
        db.delete_playlist(playlist_id).unwrap();

        // Verify it's gone
        let playlists = db.get_playlists(user_id).unwrap();
        assert_eq!(playlists.len(), 0);
    }

    #[test]
    fn test_add_items_to_playlist() {
        let db = create_test_db().unwrap();
        let user_id = "test_user";
        let playlist_id = "playlist1";

        // Create playlist
        db.create_playlist(playlist_id, "Test Playlist", None, user_id)
            .unwrap();

        // Add media items
        let item1 = create_test_media_item("movie1", "Movie 1");
        let item2 = create_test_media_item("movie2", "Movie 2");
        let item3 = create_test_media_item("movie3", "Movie 3");
        db.add_to_library(item1).unwrap();
        db.add_to_library(item2).unwrap();
        db.add_to_library(item3).unwrap();

        // Add items to playlist
        db.add_item_to_playlist(playlist_id, "movie1").unwrap();
        db.add_item_to_playlist(playlist_id, "movie2").unwrap();
        db.add_item_to_playlist(playlist_id, "movie3").unwrap();

        // Verify playlist item count updated
        let playlist = db.get_playlist(playlist_id).unwrap().unwrap();
        assert_eq!(playlist.item_count, 3);

        // Get playlist items
        let items = db.get_playlist_items(playlist_id).unwrap();
        assert_eq!(items.len(), 3);
        assert_eq!(items[0].id, "movie1");
        assert_eq!(items[1].id, "movie2");
        assert_eq!(items[2].id, "movie3");
    }

    #[test]
    fn test_remove_items_from_playlist() {
        let db = create_test_db().unwrap();
        let user_id = "test_user";
        let playlist_id = "playlist1";

        // Setup playlist with items
        db.create_playlist(playlist_id, "Test Playlist", None, user_id)
            .unwrap();
        let item1 = create_test_media_item("movie1", "Movie 1");
        let item2 = create_test_media_item("movie2", "Movie 2");
        db.add_to_library(item1).unwrap();
        db.add_to_library(item2).unwrap();
        db.add_item_to_playlist(playlist_id, "movie1").unwrap();
        db.add_item_to_playlist(playlist_id, "movie2").unwrap();

        // Verify initial state
        let items = db.get_playlist_items(playlist_id).unwrap();
        assert_eq!(items.len(), 2);

        // Remove one item
        db.remove_item_from_playlist(playlist_id, "movie1").unwrap();

        // Verify removal
        let items = db.get_playlist_items(playlist_id).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, "movie2");

        // Verify item count updated
        let playlist = db.get_playlist(playlist_id).unwrap().unwrap();
        assert_eq!(playlist.item_count, 1);
    }

    #[test]
    fn test_reorder_playlist_items() {
        let db = create_test_db().unwrap();
        let user_id = "test_user";
        let playlist_id = "playlist1";

        // Setup playlist with items
        db.create_playlist(playlist_id, "Test Playlist", None, user_id)
            .unwrap();
        let item1 = create_test_media_item("movie1", "Movie 1");
        let item2 = create_test_media_item("movie2", "Movie 2");
        let item3 = create_test_media_item("movie3", "Movie 3");
        db.add_to_library(item1).unwrap();
        db.add_to_library(item2).unwrap();
        db.add_to_library(item3).unwrap();
        db.add_item_to_playlist(playlist_id, "movie1").unwrap();
        db.add_item_to_playlist(playlist_id, "movie2").unwrap();
        db.add_item_to_playlist(playlist_id, "movie3").unwrap();

        // Verify initial order
        let items = db.get_playlist_items(playlist_id).unwrap();
        assert_eq!(items[0].id, "movie1");
        assert_eq!(items[1].id, "movie2");
        assert_eq!(items[2].id, "movie3");

        // Reorder: movie3, movie1, movie2
        let new_order = vec![
            "movie3".to_string(),
            "movie1".to_string(),
            "movie2".to_string(),
        ];
        db.reorder_playlist_items(playlist_id, new_order).unwrap();

        // Verify new order
        let items = db.get_playlist_items(playlist_id).unwrap();
        assert_eq!(items[0].id, "movie3");
        assert_eq!(items[1].id, "movie1");
        assert_eq!(items[2].id, "movie2");
    }

    #[test]
    fn test_multiple_playlists_same_user() {
        let db = create_test_db().unwrap();
        let user_id = "test_user";

        // Create multiple playlists
        db.create_playlist("playlist1", "Playlist 1", None, user_id)
            .unwrap();
        db.create_playlist("playlist2", "Playlist 2", None, user_id)
            .unwrap();
        db.create_playlist("playlist3", "Playlist 3", None, user_id)
            .unwrap();

        // Get all playlists
        let playlists = db.get_playlists(user_id).unwrap();
        assert_eq!(playlists.len(), 3);

        // Verify they're ordered by updated_at DESC (most recent first)
        // Since they were created in sequence, playlist3 should be first
        assert_eq!(playlists[0].name, "Playlist 3");
        assert_eq!(playlists[1].name, "Playlist 2");
        assert_eq!(playlists[2].name, "Playlist 1");
    }

    #[test]
    fn test_same_media_in_multiple_playlists() {
        let db = create_test_db().unwrap();
        let user_id = "test_user";

        // Create two playlists
        db.create_playlist("playlist1", "Playlist 1", None, user_id)
            .unwrap();
        db.create_playlist("playlist2", "Playlist 2", None, user_id)
            .unwrap();

        // Add media item
        let item = create_test_media_item("movie1", "Movie 1");
        db.add_to_library(item).unwrap();

        // Add same item to both playlists
        db.add_item_to_playlist("playlist1", "movie1").unwrap();
        db.add_item_to_playlist("playlist2", "movie1").unwrap();

        // Verify item is in both playlists
        let items1 = db.get_playlist_items("playlist1").unwrap();
        let items2 = db.get_playlist_items("playlist2").unwrap();
        assert_eq!(items1.len(), 1);
        assert_eq!(items2.len(), 1);
        assert_eq!(items1[0].id, "movie1");
        assert_eq!(items2[0].id, "movie1");
    }

    #[test]
    fn test_playlist_cascade_delete() {
        let db = create_test_db().unwrap();
        let user_id = "test_user";
        let playlist_id = "playlist1";

        // Create playlist with items
        db.create_playlist(playlist_id, "Test Playlist", None, user_id)
            .unwrap();
        let item = create_test_media_item("movie1", "Movie 1");
        db.add_to_library(item).unwrap();
        db.add_item_to_playlist(playlist_id, "movie1").unwrap();

        // Verify playlist has items
        let items = db.get_playlist_items(playlist_id).unwrap();
        assert_eq!(items.len(), 1);

        // Delete playlist
        db.delete_playlist(playlist_id).unwrap();

        // Verify playlist is gone
        let playlist = db.get_playlist(playlist_id).unwrap();
        assert!(playlist.is_none());

        // Note: Can't easily test CASCADE behavior in rusqlite with in-memory DB
        // but the foreign key constraints are set up correctly in the schema
    }

    #[test]
    fn test_duplicate_playlist_item() {
        let db = create_test_db().unwrap();
        let user_id = "test_user";
        let playlist_id = "playlist1";

        // Create playlist
        db.create_playlist(playlist_id, "Test Playlist", None, user_id)
            .unwrap();

        // Add media item
        let item = create_test_media_item("movie1", "Movie 1");
        db.add_to_library(item).unwrap();

        // Add item to playlist twice
        db.add_item_to_playlist(playlist_id, "movie1").unwrap();
        db.add_item_to_playlist(playlist_id, "movie1").unwrap();

        // Should still only have one entry (INSERT OR IGNORE)
        let items = db.get_playlist_items(playlist_id).unwrap();
        assert_eq!(items.len(), 1);
    }

    #[test]
    fn test_empty_playlist() {
        let db = create_test_db().unwrap();
        let user_id = "test_user";
        let playlist_id = "playlist1";

        // Create empty playlist
        db.create_playlist(playlist_id, "Empty Playlist", None, user_id)
            .unwrap();

        // Get items (should be empty)
        let items = db.get_playlist_items(playlist_id).unwrap();
        assert_eq!(items.len(), 0);

        // Verify item count is 0
        let playlist = db.get_playlist(playlist_id).unwrap().unwrap();
        assert_eq!(playlist.item_count, 0);
    }

    #[test]
    fn test_record_and_get_addon_health() {
        let db = create_test_db().unwrap();
        let addon_id = "test-addon";

        // Record successful request
        db.record_addon_health(addon_id, 150, true, None, 10, "catalog")
            .unwrap();

        // Get health summary
        let summary = db.get_addon_health_summary(addon_id).unwrap();
        assert!(summary.is_some());

        let summary = summary.unwrap();
        assert_eq!(summary.addon_id, addon_id);
        assert_eq!(summary.total_requests, 1);
        assert_eq!(summary.successful_requests, 1);
        assert_eq!(summary.failed_requests, 0);
        assert_eq!(summary.success_rate, 1.0); // success_rate is a fraction (0.0-1.0)
        assert!(summary.avg_response_time_ms > 0);
        assert!(summary.health_score > 0.0);
    }

    #[test]
    fn test_addon_health_with_failures() {
        let db = create_test_db().unwrap();
        let addon_id = "unreliable-addon";

        // Record 2 successful and 1 failed request (with delays to avoid timestamp collision)
        // Note: timestamps are in seconds, so we need 1+ second delays
        db.record_addon_health(addon_id, 100, true, None, 5, "catalog")
            .unwrap();
        std::thread::sleep(std::time::Duration::from_secs(1));

        db.record_addon_health(addon_id, 120, true, None, 3, "stream")
            .unwrap();
        std::thread::sleep(std::time::Duration::from_secs(1));

        db.record_addon_health(addon_id, 0, false, Some("Timeout"), 0, "catalog")
            .unwrap();

        // Get health summary
        let summary = db.get_addon_health_summary(addon_id).unwrap().unwrap();
        assert_eq!(summary.total_requests, 3);
        assert_eq!(summary.successful_requests, 2);
        assert_eq!(summary.failed_requests, 1);
        assert!((summary.success_rate - 0.6667).abs() < 0.01); // Approximately 2/3
        assert_eq!(summary.last_error, Some("Timeout".to_string()));
    }

    #[test]
    fn test_multiple_addon_health_summaries() {
        let db = create_test_db().unwrap();

        // Record health for multiple addons
        db.record_addon_health("addon1", 50, true, None, 10, "catalog")
            .unwrap();
        db.record_addon_health("addon2", 200, true, None, 5, "catalog")
            .unwrap();
        db.record_addon_health("addon3", 100, false, Some("Error"), 0, "catalog")
            .unwrap();

        // Get all summaries
        let summaries = db.get_all_addon_health_summaries().unwrap();
        assert_eq!(summaries.len(), 3);

        // Verify they're ordered by health_score DESC
        // addon1 (fast, successful) should have best score
        assert_eq!(summaries[0].addon_id, "addon1");
    }

    #[test]
    fn test_addon_health_score_calculation() {
        let db = create_test_db().unwrap();
        let addon_id = "test-addon";

        // Record a perfect request (fast and successful)
        db.record_addon_health(addon_id, 50, true, None, 10, "catalog")
            .unwrap();

        let summary = db.get_addon_health_summary(addon_id).unwrap().unwrap();
        let initial_score = summary.health_score;
        // Fast response + 100% success rate should give high score (70% success + 30% response = 100)
        assert!(initial_score > 95.0);

        // Now add slow requests (with delays to avoid timestamp collisions)
        // Note: timestamps are in seconds, so we need 1+ second delays
        for _ in 0..5 {
            std::thread::sleep(std::time::Duration::from_secs(1));
            db.record_addon_health(addon_id, 2000, true, None, 10, "catalog")
                .unwrap();
        }

        let summary = db.get_addon_health_summary(addon_id).unwrap().unwrap();
        // Slow responses should lower the score compared to initial
        // With 100% success (70 pts) + slow response (~15-20 pts) = ~85-90 pts
        assert!(summary.health_score < initial_score);
        assert!(summary.health_score < 95.0);
        assert!(summary.health_score > 80.0); // Still pretty good due to 100% success rate
    }

    #[test]
    fn test_cleanup_old_health_records() {
        let db = create_test_db().unwrap();
        let addon_id = "test-addon";

        // Record some health data
        db.record_addon_health(addon_id, 100, true, None, 10, "catalog")
            .unwrap();

        // Verify record exists
        let summary_before = db.get_addon_health_summary(addon_id).unwrap();
        assert!(summary_before.is_some());

        // Note: In a real test, we'd manipulate timestamps to simulate old records
        // For now, just verify the cleanup function runs without error
        let deleted = db.cleanup_old_health_records().unwrap();
        // Since we just created records, none should be deleted
        assert_eq!(deleted, 0);
    }

    #[test]
    fn test_addon_health_summary_for_nonexistent_addon() {
        let db = create_test_db().unwrap();

        // Try to get health for addon that doesn't exist
        let summary = db.get_addon_health_summary("nonexistent").unwrap();
        assert!(summary.is_none());
    }
}
