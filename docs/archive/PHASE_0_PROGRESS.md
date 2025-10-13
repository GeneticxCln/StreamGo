# Phase 0 Implementation Progress

## ✅ Completed (Phase 0.1 - 0.3)

### Phase 0.1: Preferences Schema Alignment
- **Status**: COMPLETE
- **Changes**:
  - Expanded `UserPreferences` struct in `src-tauri/src/models.rs` to include all frontend settings
  - Added versioning (v1) with serde defaults for all fields
  - Covers: theme, video (codec, bitrate, hardware accel), audio (codec, channels, normalize), playback (autoplay, skip intro, resume), subtitles (language, size), network (buffer, preload, torrent, cache), advanced (player engine, logging, analytics)
  - All fields have `#[serde(default)]` attributes for graceful deserialization

### Phase 0.2: Add-on Persistence
- **Status**: COMPLETE
- **Changes**:
  - Implemented real `install_addon()` in `src-tauri/src/api.rs`:
    - Downloads and validates addon manifest from URL
    - Validates manifest structure (id, name, version, resources, types required)
    - Determines addon type based on resources
    - Returns validated `Addon` struct
  - Updated `get_addons()` in `src-tauri/src/lib.rs`:
    - Reads from SQLite database
    - Auto-initializes with built-in addons on first run
  - Added new Tauri commands:
    - `enable_addon(addon_id, state)` - enables an installed addon
    - `disable_addon(addon_id, state)` - disables an addon
    - `uninstall_addon(addon_id, state)` - removes addon from DB
  - Added `delete_addon()` method to `Database` struct
  - All operations are async-safe with `spawn_blocking` for DB access

### Phase 0.3: Security - Remove Inline Scripts & Tighten CSP
- **Status**: COMPLETE
- **Changes**:
  - Created `src/tauri-init.js` - external module for Tauri API bootstrap
  - Removed inline `<script type="module">` from `src/index.html`
  - Updated CSP in `src-tauri/tauri.conf.json`:
    - Removed `'unsafe-inline'` from `script-src` (now just `'self'`)
    - Kept `'unsafe-inline'` for `style-src` temporarily (will remove in Phase 1 with CSS extraction)
  - All scripts now loaded externally for better security

## 🚧 In Progress

### Phase 0.4: Toast & Modal System
- **Status**: PARTIALLY COMPLETE
- **Completed**:
  - Created `src/ui-utils.js` with `Toast` and `Modal` utilities
  - Added comprehensive CSS for toasts and modals in `src/styles.css`
  - Includes animations, multiple types (success, error, warning, info)
  - Modal system with confirm, alert, and prompt methods
  - Added ui-utils.js to index.html
- **Remaining**:
  - Replace all `alert()` calls in `script.js` with `Toast.success()` / `Toast.error()`
  - Replace all `prompt()` calls with `Modal.prompt()`
  - Replace all `confirm()` calls with `Modal.confirm()`
  - Update addon installation flow to use modals

## 📋 TODO (Phase 0.5 - 0.7 + Phase 1)

### Phase 0.5: Skeleton Loaders & Error States
- Add skeleton loaders for movie grids while loading
- Improve error state UI throughout
- Add retry buttons for failed operations

### Phase 0.6: CI Hardening
- Update `.github/workflows/build.yml`:
  - Fail on `cargo clippy` warnings
  - Fail on `cargo fmt` check
  - Add ESLint for frontend
  - Add npm script for lint

### Phase 0.7: Documentation Updates
- Update `USAGE.md` to remove hardcoded API key references
- Update `README.md` with current features and Phase 0 improvements
- Add "Setting up TMDB API Key" section
- Document new addon commands (enable, disable, uninstall)

### Phase 1.1: Vite + TypeScript
- Initialize Vite with TypeScript
- Configure Vite for Tauri (assets, HMR, build output to dist/)
- Migrate `script.js` to TypeScript modules
- Add type definitions for Tauri commands
- Setup tsconfig.json with strict mode

### Phase 1.2: HLS Player Upgrade
- Add `hls.js` dependency
- Implement HLS stream detection and playback
- Add quality selection UI
- Add subtitle track support (WebVTT)
- Add player keyboard shortcuts
- Add "Open in external player" option

### Phase 1.3: Watchlist & Favorites
- Add Tauri commands for watchlist/favorites operations
- Update UI to show watchlist and favorites tabs
- Add "Continue Watching" section on home page
- Persist watch progress and resume position

### Phase 1.4: Rust Tests
- Add unit tests for database operations
- Add tests for addon validation logic
- Add integration tests for Tauri commands
- Setup test fixtures and mocks

### Phase 1.5: E2E Tests
- Setup Playwright
- Write smoke tests:
  - App launches successfully
  - Search returns results
  - Add to library works
  - Media detail view loads
  - Video player opens

## How to Build & Test Current State

```bash
# Backend (Rust)
cd src-tauri
cargo check
cargo clippy
cargo fmt --check

# Frontend (build)
cd ..
npm run build

# Run in dev mode
cd src-tauri
export TMDB_API_KEY="your_api_key_here"
cargo tauri dev
```

## New Features Available

1. **Comprehensive Preferences**: All frontend settings now persist to database
2. **Real Addon System**: Install addons from URL, enable/disable/uninstall
3. **Security Improvements**: No inline scripts, tighter CSP
4. **Toast Notifications** (UI ready, integration pending)
5. **Modal Dialogs** (UI ready, integration pending)

## Next Immediate Steps

1. Complete Phase 0.4 by replacing all alert/prompt/confirm in script.js
2. Implement Phase 0.5 (skeleton loaders)
3. Harden CI (Phase 0.6)
4. Update docs (Phase 0.7)
5. Then proceed to Phase 1 (Vite + TS, HLS, etc.)

## Notes

- All Rust changes compile without errors (only 2 warnings about glob re-exports)
- Database schema supports all new features
- CSP is production-ready for scripts
- Frontend architecture is ready for Vite migration
