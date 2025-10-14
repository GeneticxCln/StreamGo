/**
 * Integration Tests for StreamGo
 *
 * Tests the interaction between multiple components
 */
use app_lib::{
    Addon, CacheManager, ContentAggregator, Database, MediaItem, MediaType, UserPreferences,
};
use std::time::Duration;

#[test]
fn test_database_lifecycle() {
    // Test database initialization and basic operations
    let db = Database::new_in_memory().expect("Failed to create database");

    // Use unique ID with timestamp
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_micros();
    let test_id = format!("test_{}", timestamp);

    // Create a test media item
    let media_item = MediaItem {
        id: test_id.clone(),
        title: "Test Movie".to_string(),
        media_type: MediaType::Movie,
        year: Some(2024),
        genre: vec!["Action".to_string(), "Sci-Fi".to_string()],
        description: Some("A test movie".to_string()),
        poster_url: Some("https://example.com/poster.jpg".to_string()),
        backdrop_url: None,
        rating: Some(8.5),
        duration: Some(120),
        added_to_library: None,
        watched: false,
        progress: None,
    };

    // Add to library
    db.add_to_library(media_item.clone())
        .expect("Failed to add to library");

    // Retrieve from library
    let items = db.get_library_items().expect("Failed to get library items");
    assert!(!items.is_empty());

    // Find our test item
    let found = items.iter().find(|i| i.id == test_id);
    assert!(found.is_some());
    assert_eq!(found.unwrap().title, "Test Movie");
}

#[test]
fn test_user_preferences() {
    let db = Database::new_in_memory().expect("Failed to create database");
    let user_id = "test_user";

    // Create default preferences
    let prefs = UserPreferences {
        theme: "dark".to_string(),
        quality: "1080p".to_string(),
        ..UserPreferences::default()
    };

    // Save preferences
    let profile = app_lib::UserProfile {
        id: user_id.to_string(),
        username: "Test User".to_string(),
        email: Some("test@example.com".to_string()),
        preferences: prefs.clone(),
        library_items: vec![],
        watchlist: vec![],
        favorites: vec![],
    };

    db.save_user_profile(&profile)
        .expect("Failed to save profile");

    // Retrieve preferences
    let loaded_profile = db
        .get_user_profile(user_id)
        .expect("Failed to get profile")
        .expect("Profile not found");

    assert_eq!(loaded_profile.preferences.theme, "dark");
    assert_eq!(loaded_profile.preferences.quality, "1080p");
}

#[test]
fn test_watchlist_and_favorites() {
    let db = Database::new_in_memory().expect("Failed to create database");
    let user_id = "test_user2";
    let media_id = "movie123";

    // Add a media item first
    let media_item = MediaItem {
        id: media_id.to_string(),
        title: "Test Movie for Watchlist".to_string(),
        media_type: MediaType::Movie,
        year: Some(2024),
        genre: vec![],
        description: None,
        poster_url: None,
        backdrop_url: None,
        rating: None,
        duration: None,
        added_to_library: None,
        watched: false,
        progress: None,
    };

    db.add_to_library(media_item).expect("Failed to add item");

    // Add to watchlist
    db.add_to_watchlist(user_id, media_id)
        .expect("Failed to add to watchlist");

    // Check watchlist
    let watchlist = db.get_watchlist(user_id).expect("Failed to get watchlist");
    assert_eq!(watchlist.len(), 1);
    assert_eq!(watchlist[0].id, media_id);

    // Add to favorites
    db.add_to_favorites(user_id, media_id)
        .expect("Failed to add to favorites");

    // Check favorites
    let favorites = db.get_favorites(user_id).expect("Failed to get favorites");
    assert_eq!(favorites.len(), 1);

    // Remove from watchlist
    db.remove_from_watchlist(user_id, media_id)
        .expect("Failed to remove from watchlist");

    let watchlist = db.get_watchlist(user_id).expect("Failed to get watchlist");
    assert_eq!(watchlist.len(), 0);
}

// Addon management test removed - tested via unit tests in database module

#[test]
fn test_cache_integration() {
    let cache = CacheManager::new(None).expect("Failed to create cache");

    // Test metadata caching
    #[derive(serde::Serialize, serde::Deserialize, PartialEq, Debug)]
    struct TestMetadata {
        title: String,
        year: i32,
    }

    let metadata = TestMetadata {
        title: "Test Movie".to_string(),
        year: 2024,
    };

    cache
        .set_metadata("movie:123", &metadata, Duration::from_secs(60))
        .expect("Failed to set metadata");

    let retrieved: Option<TestMetadata> = cache
        .get_metadata("movie:123")
        .expect("Failed to get metadata");
    assert_eq!(retrieved, Some(metadata));

    // Test stats
    let stats = cache.get_stats().expect("Failed to get stats");
    assert_eq!(stats.metadata_valid, 1);
}

#[test]
fn test_watch_progress_tracking() {
    let db = Database::new_in_memory().expect("Failed to create database");
    let user_id = "test_user3";
    let media_id = "show123";

    // Add media item
    let media_item = MediaItem {
        id: media_id.to_string(),
        title: "Test Show".to_string(),
        media_type: MediaType::TvShow,
        year: Some(2024),
        genre: vec![],
        description: None,
        poster_url: None,
        backdrop_url: None,
        rating: None,
        duration: Some(45),
        added_to_library: None,
        watched: false,
        progress: None,
    };

    db.add_to_library(media_item).expect("Failed to add item");

    // Add to user's library first
    db.add_to_watchlist(user_id, media_id)
        .expect("Failed to add to watchlist");

    // Update watch progress
    db.update_watch_progress(media_id, 600, false)
        .expect("Failed to update progress");

    // Verify progress
    let continue_watching = db
        .get_continue_watching(user_id)
        .expect("Failed to get continue watching");

    assert_eq!(continue_watching.len(), 1);
    assert_eq!(continue_watching[0].progress, Some(600));
}

#[test]
fn test_playlist_management() {
    let db = Database::new_in_memory().expect("Failed to create database");
    let user_id = "test_user4";
    let playlist_id = "test_playlist_123";

    // Create playlist
    db.create_playlist(playlist_id, "My Test Playlist", Some("Testing"), user_id)
        .expect("Failed to create playlist");

    // Get playlists
    let playlists = db.get_playlists(user_id).expect("Failed to get playlists");
    assert_eq!(playlists.len(), 1);
    assert_eq!(playlists[0].name, "My Test Playlist");

    // Add media to playlist
    let media_item = MediaItem {
        id: "playlist_movie".to_string(),
        title: "Playlist Movie".to_string(),
        media_type: MediaType::Movie,
        year: Some(2024),
        genre: vec![],
        description: None,
        poster_url: None,
        backdrop_url: None,
        rating: None,
        duration: None,
        added_to_library: None,
        watched: false,
        progress: None,
    };

    db.add_to_library(media_item).expect("Failed to add item");
    db.add_item_to_playlist(playlist_id, "playlist_movie")
        .expect("Failed to add to playlist");

    // Get playlist items
    let items = db
        .get_playlist_items(playlist_id)
        .expect("Failed to get playlist items");
    assert_eq!(items.len(), 1);

    // Delete playlist
    db.delete_playlist(playlist_id)
        .expect("Failed to delete playlist");

    let playlists = db.get_playlists(user_id).expect("Failed to get playlists");
    assert_eq!(playlists.len(), 0);
}

#[test]
fn test_aggregator_with_empty_addons() {
    let aggregator = ContentAggregator::new();
    let addons: Vec<Addon> = vec![];

    // This should return empty results without panicking
    let rt = tokio::runtime::Runtime::new().unwrap();
    let result = rt.block_on(async {
        aggregator
            .query_catalogs(&addons, "movie", "top", &None)
            .await
    });

    assert_eq!(result.items.len(), 0);
    assert_eq!(result.sources.len(), 0);
}
