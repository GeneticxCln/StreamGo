// Tauri TypeScript Definitions for StreamGo

export interface MediaItem {
  id: string;
  title: string;
  media_type: MediaType;
  year?: number;
  genre: string[];
  description?: string;
  poster_url?: string;
  backdrop_url?: string;
  rating?: number;
  duration?: number;
  added_to_library?: string;
  watched: boolean;
  progress?: number;
}

export type MediaType = 
  | { Movie: null }
  | { TvShow: null }
  | { Episode: null }
  | { Documentary: null }
  | { LiveTv: null }
  | { Podcast: null };

export interface UserPreferences {
  version: number;
  // General
  theme: string;
  language: string;
  notifications_enabled: boolean;
  auto_update: boolean;
  
  // Integrations / API keys
  tmdb_api_key?: string;
  // Playback
  autoplay: boolean;
  quality: string;
  playback_speed: number;
  volume: number;
  subtitle_language: string;
  // Advanced
  telemetry_enabled: boolean;
  // Extended settings used in app.ts
  default_quality?: string;
  video_codec?: string;
  max_bitrate?: string;
  hardware_accel?: boolean;
  audio_codec?: string;
  audio_channels?: string;
  volume_normalize?: boolean;
  autoplay_next?: boolean;
  skip_intro?: boolean;
  resume_playback?: boolean;
  subtitles_enabled?: boolean;
  subtitle_size?: string;
  buffer_size?: string;
  preload_next?: boolean;
  torrent_connections?: string;
  cache_size?: string;
  player_engine?: string;
  debug_logging?: boolean;
  analytics?: boolean;
}

export interface CacheStats {
  metadata_total: number;
  metadata_valid: number;
  metadata_expired: number;
  addon_total: number;
  addon_valid: number;
  addon_expired: number;
}

export interface Addon {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  url: string;
  enabled: boolean;
  addon_type: AddonType;
  manifest: AddonManifest;
}

export type AddonType =
  | { ContentProvider: null }
  | { MetadataProvider: null }
  | { Subtitles: null }
  | { Player: null };

export interface AddonManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  resources: string[];
  types: string[];
  catalogs: Catalog[];
}

export interface Stream {
  url: string;
  title?: string;
  name?: string; // quality label like 1080p
  description?: string;
}

export interface Subtitle {
  id: string;
  url: string;
  lang: string;
}

// Series and Episode Support
export interface Episode {
  id: string;           // Format: "series_id:season:episode" (e.g., "tt1234567:1:5")
  title: string;
  season: number;
  episode: number;
  thumbnail?: string;
  overview?: string;
  released?: string;    // Release date
  runtime?: string;     // Duration in minutes
}

export interface MetaItem {
  id: string;
  type: string;         // "movie", "series", "channel", "tv"
  name: string;
  poster?: string;
  posterShape?: string; // "poster" | "landscape" | "square"
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  runtime?: string;
  genres?: string[];
  director?: string[];
  cast?: string[];
  writer?: string[];
  imdbRating?: number;
  country?: string;
  language?: string;
  awards?: string;
  website?: string;
  trailers?: Trailer[];
  videos?: Episode[];   // Episodes for series
  links?: MetaLink[];
}

export interface Trailer {
  source: string;       // e.g., "youtube:dQw4w9WgXcQ"
  type: string;         // "Trailer", "Clip", etc.
}

export interface MetaLink {
  name: string;
  category: string;
  url: string;
}

export interface SeriesMeta extends MetaItem {
  episodes?: Episode[];
  seasons?: number;
}

// Episode ID utilities (client-side)
export const EpisodeId = {
  parse(id: string): { seriesId: string; season: number; episode: number } | null {
    const parts = id.split(':');
    if (parts.length < 3) return null;
    return {
      seriesId: parts[0],
      season: parseInt(parts[1]),
      episode: parseInt(parts[2])
    };
  },
  
  build(seriesId: string, season: number, episode: number): string {
    return `${seriesId}:${season}:${episode}`;
  },
  
  isEpisodeId(id: string): boolean {
    return id.split(':').length >= 3;
  },
  
  getSeriesId(id: string): string | null {
    return id.split(':')[0] || null;
  }
};

export interface Catalog {
  catalog_type: string;
  id: string;
  name: string;
  genres?: string[];
}

export interface CatalogInfo {
  addon_id: string;
  addon_name: string;
  id: string;
  name: string;
  media_type: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  item_count: number;
}

export interface PlaylistItem {
  playlist_id: string;
  media_id: string;
  position: number;
  added_at: string;
}

export interface PlaylistWithItems {
  playlist: Playlist;
  items: MediaItem[];
}

export interface SearchFilters {
  query?: string;
  genres: string[];
  media_types: MediaType[];
  year_min?: number;
  year_max?: number;
  rating_min?: number;
  watched?: boolean;
  sort_by?: string;
}

export interface AddonHealthSummary {
  addon_id: string;
  last_check: number;
  success_rate: number;
  avg_response_time_ms: number;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  last_error: string | null;
  health_score: number;
}

export interface PerformanceMetrics {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_response_time_ms: number;
  cache_hits: number;
  cache_misses: number;
}

export interface DiagnosticsInfo {
  timestamp: number;
  app_version: string;
  os: string;
  arch: string;
  uptime_seconds: number;
  log_path: string;
  metrics: PerformanceMetrics;
}

// Tauri Command Definitions
export interface TauriCommands {
  // Library
  get_library_items: { args: {}; return: MediaItem[] };
  add_to_library: { args: { item: MediaItem }; return: void };
  
  // Search
  search_content: { args: { query: string }; return: MediaItem[] };
  search_library_advanced: { args: { filters: SearchFilters }; return: MediaItem[] };
  
  // Media & Catalogs
  get_media_details: { args: { content_id: string; media_type: MediaType }; return: MediaItem };
  get_stream_url: { args: { content_id: string; media_type?: string }; return: string };
  get_streams: { args: { content_id: string; media_type?: string }; return: Stream[] };
  get_subtitles: { args: { content_id: string; media_type?: string }; return: Subtitle[] };
  get_addon_meta: { args: { content_id: string; media_type?: string }; return: MetaItem };
  list_catalogs: { args: { media_type: string }; return: CatalogInfo[] };
  aggregate_catalogs: { args: { media_type: string; catalog_id: string; extra?: { [key: string]: string } }; return: { items: any[]; sources: any[]; total_time_ms: number } };
  
  // Addons
  get_addons: { args: {}; return: Addon[] };
  install_addon: { args: { addon_url: string }; return: string };
  enable_addon: { args: { addon_id: string }; return: void };
  disable_addon: { args: { addon_id: string }; return: void };
  uninstall_addon: { args: { addon_id: string }; return: void };
  
  // Settings
  get_settings: { args: {}; return: UserPreferences };
  save_settings: { args: { settings: UserPreferences }; return: void };
  
  // Watchlist  
  add_to_watchlist: { args: { media_id: string }; return: void };
  remove_from_watchlist: { args: { media_id: string }; return: void };
  get_watchlist: { args: {}; return: MediaItem[] };
  
  // Favorites
  add_to_favorites: { args: { media_id: string }; return: void };
  remove_from_favorites: { args: { media_id: string }; return: void };
  get_favorites: { args: {}; return: MediaItem[] };
  
  // Watch Progress
  update_watch_progress: { args: { media_id: string; progress: number; watched: boolean }; return: void };
  get_continue_watching: { args: {}; return: MediaItem[] };
  
  // Playlists
  create_playlist: { args: { name: string; description?: string }; return: string };
  get_playlists: { args: {}; return: Playlist[] };
  get_playlist: { args: { playlist_id: string }; return: Playlist | null };
  update_playlist: { args: { playlist_id: string; name: string; description?: string }; return: void };
  delete_playlist: { args: { playlist_id: string }; return: void };
  add_to_playlist: { args: { playlist_id: string; media_id: string }; return: void };
  remove_from_playlist: { args: { playlist_id: string; media_id: string }; return: void };
  get_playlist_items: { args: { playlist_id: string }; return: MediaItem[] };
  reorder_playlist: { args: { playlist_id: string; media_ids: string[] }; return: void };
  
  // Cache
  get_cache_stats: { args: {}; return: CacheStats };
  clear_cache: { args: {}; return: void };
  clear_expired_cache: { args: {}; return: number };
  
  // Health & Diagnostics
  get_addon_health_summaries: { args: {}; return: AddonHealthSummary[] };
  get_addon_health: { args: { addon_id: string }; return: AddonHealthSummary | null };
  get_performance_metrics: { args: {}; return: PerformanceMetrics };
  export_diagnostics: { args: {}; return: DiagnosticsInfo };
  export_diagnostics_file: { args: {}; return: string };
  reset_performance_metrics: { args: {}; return: void };
}

// Global Tauri API
declare global {
  interface Window {
    Toast: {
      show(_message: string, _type?: 'info' | 'success' | 'error' | 'warning', _duration?: number): HTMLElement;
      success(_message: string, _duration?: number): HTMLElement;
      error(_message: string, _duration?: number): HTMLElement;
      warning(_message: string, _duration?: number): HTMLElement;
      info(_message: string, _duration?: number): HTMLElement;
    };
    Modal: {
      show(_options: {
        title?: string;
        message?: string;
        input?: boolean;
        placeholder?: string;
        defaultValue?: string;
        showCancel?: boolean;
        confirmText?: string;
      }): Promise<string | boolean | null>;
      confirm(_message: string, _title?: string): Promise<boolean | null>;
      alert(_message: string, _title?: string): Promise<boolean | null>;
      prompt(_message: string, _title?: string, _placeholder?: string, _defaultValue?: string): Promise<string | null>;
    };
    playlistManager?: import('../playlists').PlaylistManager;
  }
}

export {};
