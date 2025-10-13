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
  theme: string;
  default_quality: string;
  video_codec: string;
  max_bitrate: string;
  hardware_accel: boolean;
  audio_codec: string;
  audio_channels: string;
  volume_normalize: boolean;
  autoplay_next: boolean;
  skip_intro: boolean;
  resume_playback: boolean;
  subtitles_enabled: boolean;
  subtitle_language: string;
  subtitle_size: string;
  buffer_size: string;
  preload_next: boolean;
  torrent_connections: string;
  cache_size: string;
  player_engine: string;
  debug_logging: boolean;
  analytics: boolean;
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

export interface Catalog {
  catalog_type: string;
  id: string;
  name: string;
  genres?: string[];
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

// Tauri Command Definitions
export interface TauriCommands {
  // Library
  get_library_items: { args: {}; return: MediaItem[] };
  add_to_library: { args: { item: MediaItem }; return: void };
  
  // Search
  search_content: { args: { query: string }; return: MediaItem[] };
  search_library_advanced: { args: { filters: SearchFilters }; return: MediaItem[] };
  
  // Media
  get_media_details: { args: { content_id: string; media_type: MediaType }; return: MediaItem };
  get_stream_url: { args: { content_id: string }; return: string };
  
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
