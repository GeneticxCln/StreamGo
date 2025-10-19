# Local Media Scanning and Folder Watcher

This document explains how StreamGo discovers and tracks local media, how to enable automatic folder watching, and how to import Live TV playlists and EPG data.

## Overview

Local media is discovered by scanning one or more directories on your filesystem. For each supported video file found (mp4, mkv, avi, mov, wmv, flv, webm, m4v, mpg, mpeg, 3gp, ogv, ts, m2ts, vob, divx, xvid), StreamGo attempts to:

- Parse metadata from the filename (title, year, season, episode)
- Optionally probe the file with ffprobe to read duration, resolution, codecs
- Optionally enrich metadata using TMDB if an API key is configured
- Store a normalized LocalMediaFile record in the database

A folder watcher can monitor configured directories and react to file changes (create/modify/delete), keeping the local media database up-to-date automatically.

## Prerequisites

- FFmpeg (ffprobe) installed and available in PATH for richer metadata (optional, but recommended)
- Optional TMDB API key to enrich local matches: set `TMDB_API_KEY` in your environment or `.env` file

## Supported Commands (Tauri)

The backend exposes the following commands callable from the frontend:

Local media scanning:
- `scan_local_folder(path: string): LocalMediaFile[]`
  - Scans a single folder recursively, returns the discovered files, and persists them into the database. Also records the folder as a scanned directory.
- `get_local_media_files(): LocalMediaFile[]`
  - Returns all local media files from the database.
- `probe_video_file(path: string): VideoMetadata`
  - Runs a metadata probe for a single file (duration, resolution, codecs, etc.).

Folder watcher:
- `start_folder_watcher(paths: string[]): void`
  - Starts watching the given directories (recursive). Also persists them as scanned directories.
- `stop_folder_watcher(): void`
  - Stops the folder watcher.
- `get_watched_paths(): string[]`
  - Returns the list of currently watched directories.

Live TV (M3U + XMLTV):
- `live_tv_import_m3u(url: string): number`
  - Downloads an M3U playlist and imports channels into the `live_tv_channels` table. Returns the number of channels parsed.
- `live_tv_get_channels(): LiveTvChannel[]`
  - Returns saved Live TV channels from the database.
- `live_tv_import_xmltv(url: string): number`
  - Downloads an XMLTV feed, parses EPG programs and saves them into the `epg_programs` table. Returns the number of programs parsed.
- `live_tv_get_epg(channel_id: string, since?: number, until?: number): EpgProgram[]`
  - Returns EPG programs for a channel id, filtered by optional time range (unix timestamp seconds).

## App Lifecycle Integration

At startup, StreamGo will automatically try to start the folder watcher for any directories previously saved in the database (via `scan_local_folder` or `start_folder_watcher`). Only directories marked `enabled = 1` are watched.

Internally, this is managed in the Tauri `setup()` of `src-tauri/src/lib.rs`. The watcher reacts to file system events using debounced notifications and updates the `local_media_files` table accordingly.

## Database Schema (v9 additions)

Migration v9 adds the following tables (if not present):
- `live_tv_channels (id, name, logo, channel_group, tvg_id, stream_url)`
- `epg_programs (id, channel_id, start, end, title, description, category, season, episode)`

The local media schema was added previously in v8 (`local_media_files`, `scanned_directories`, `local_scan_history`). The code now uses `last_scan` in `scanned_directories` and maintains `last_scanned` in `local_media_files` on upsert.

## Enabling TMDB Enrichment (optional)

If you provide a TMDB API key, local media titles may be enriched (title normalization, poster, IDs). Set the environment variable before running the app:

```
TMDB_API_KEY=your_api_key_here
```

You can put this into a `.env` file at the project root or configure it through the app settings if supported.

## Typical Workflows

1) One-off scan of a folder and start watching it:
- Call `scan_local_folder("/path/to/Media")` to index existing files
- Call `start_folder_watcher(["/path/to/Media"])` to keep it in sync

2) Query local files for UI:
- Call `get_local_media_files()` and render as a local library view

3) Live TV:
- Call `live_tv_import_m3u("https://example.com/playlist.m3u")`
- Call `live_tv_get_channels()` to list channels
- Call `live_tv_import_xmltv("https://example.com/epg.xml")`
- Call `live_tv_get_epg(channelId, since, until)` to render EPG grid

## Notes

- The folder watcher is debounced (2 seconds). Rapid file changes are consolidated.
- Only recognized video file extensions are processed.
- File delete events remove entries from the `local_media_files` table.
- For large libraries, the initial scan may take time; consider chunked UX.

## Troubleshooting

- If you don't see updates, ensure the watcher started: call `get_watched_paths()`
- On Linux/Wayland, ensure filesystem notifications are permitted
- Ensure `ffprobe` is installed and available in PATH to get rich metadata
- Check logs in the app data directory for details (see diagnostics and logs menu)
