# StreamGo Evolution Roadmap to Stremio-Level Polish

This document outlines the complete plan to evolve StreamGo into a production-grade, polished media center application comparable to Stremio.

## Overview

**Current State**: Functional MVP with Tauri + Rust backend, vanilla JS frontend, TMDB integration, SQLite storage, basic addon structure

**Target**: Polished, production-grade media center with modern frontend, robust player, real addon protocol, comprehensive testing, multi-platform distribution

## Phase 0: Align and Stabilize (1-2 weeks) ✅ 100% Complete

### 0.1 Preferences Schema Alignment ✅
- [x] Expand Rust UserPreferences to match all frontend settings
- [x] Add versioning and serde defaults
- [x] Ensure graceful deserialization

### 0.2 Wire Add-ons to Persistence ✅
- [x] Implement real get_addons from DB
- [x] Implement install_addon with manifest validation
- [x] Add enable/disable/uninstall commands
- [x] Add DB methods for addon management

### 0.3 Security Hardening ✅
- [x] Remove inline scripts from HTML
- [x] Create external tauri-init.js module
- [x] Tighten CSP (remove 'unsafe-inline' for scripts)
- [x] Prepare for CSS extraction (Phase 1)

### 0.4 UX Fit-and-Finish ✅ 100% Complete
- [x] Create Toast notification system (CSS + JS)
- [x] Create Modal dialog system (CSS + JS)
- [x] Replace all alert() with Toast
- [x] Replace all prompt() with Modal.prompt()
- [x] Replace all confirm() with Modal.confirm()

### 0.5 Skeleton Loaders & Error States ✅
- [x] Add skeleton loaders for movie grids
- [x] Improve error state UI
- [x] Add retry buttons for failed operations
- [x] Add empty state illustrations

### 0.6 CI Hardening ✅
- [x] Fail build on clippy warnings (-D warnings flag)
- [x] Fail build on fmt check (in CI pipeline)
- [x] Add ESLint for frontend (enforced in CI)
- [x] Add frontend lint npm script (part of CI)

### 0.7 Documentation Updates ✅
- [x] Update EVOLUTION_ROADMAP.md with Phase 0 completion
- [x] Create Phase 0 completion summary
- [x] Document E2E testing improvements
- [x] Update README.md with current status

## Phase 1: Modernize Frontend & Improve Playback ✅ 100% Complete

### 1.1 Vite + TypeScript Setup ✅ COMPLETE
- [x] Initialize Vite with TypeScript template
- [x] Configure Vite for Tauri (dev server, build)
- [x] Migrate script.js to TypeScript modules
- [x] Add type definitions for Tauri commands
- [x] Setup strict tsconfig.json
- [x] Update build pipeline

### 1.2 Player Upgrades ✅ COMPLETE
- [x] Add hls.js for HLS/M3U8 support
- [x] Implement quality selection UI
- [x] Add WebVTT subtitle track support
- [x] Add subtitle size/position controls
- [x] Implement keyboard shortcuts (Space, F, M, Arrow keys, Esc, P)
- [x] Add Picture-in-Picture mode
- [x] Add "Open in external player" (VLC/mpv) - UI complete
- [x] Improve player UI/controls

### 1.3 Library Features ✅ COMPLETE
- [x] Add watchlist Tauri commands
- [x] Add favorites Tauri commands
- [x] Implement "Continue Watching" on home
- [x] Persist watch progress per item
- [x] Add resume playback functionality
- [x] Add playlist management (full CRUD)

### 1.4 Rust Tests ✅ COMPLETE
- [x] Unit tests for Database methods (28 tests)
- [x] Tests for addon validation
- [x] Integration tests for Tauri commands (7 tests)
- [x] Setup test fixtures and mocks
- [x] Add to CI pipeline (cargo fmt, clippy with -D warnings)

### 1.5 E2E Tests ✅ COMPLETE
- [x] Setup Playwright
- [x] Test: app launch
- [x] Test: search flow
- [x] Test: add to library
- [x] Test: media detail view
- [x] Test: video playback
- [x] Add to CI pipeline

## Phase 2: Real Add-on Protocol & Content Aggregation (1-2 months)

### 2.1 Add-on Protocol 📋
- [ ] Design HTTP-based addon protocol (Stremio-inspired)
- [ ] Implement manifest endpoint spec
- [ ] Implement catalog endpoint spec
- [ ] Implement stream endpoint spec
- [ ] Add addon resolver layer in Rust

### 2.2 Content Aggregation 📋
- [ ] Query multiple enabled addons for catalogs
- [ ] Merge and deduplicate results
- [ ] Implement addon health scoring
- [ ] Add request timeouts and retries
- [ ] Implement addon priority system

### 2.3 Caching & Performance 📋
- [ ] Cache TMDB metadata in SQLite with TTLs
- [ ] Cache addon responses
- [ ] Implement image lazy loading
- [ ] Add list virtualization for large grids
- [ ] Optimize SQLite queries

### 2.4 Database Migrations 📋
- [ ] Integrate rusqlite_migration or refinery
- [ ] Create migration 001: initial schema
- [ ] Create migration 002: addon tables (if needed)
- [ ] Add version tracking

### 2.5 Preferences & i18n 📋
- [ ] Finalize end-to-end preferences coverage
- [ ] Add i18n JSON catalog structure
- [ ] Implement language selector
- [ ] Translate UI strings (English + 1-2 languages)

### 2.6 Observability 📋
- [ ] Enable tauri-plugin-log in release mode
- [ ] Add file rotation for logs
- [ ] Add "Send Diagnostics" user option
- [ ] Structured logging with context

## Phase 3: Distribution-Grade Polish & Ecosystem (2-3 months)

### 3.1 Packaging & Updates 📋
- [ ] Expand CI to macOS and Windows
- [ ] Sign builds for all platforms
- [ ] Create GitHub Release workflow
- [ ] Integrate Tauri updater with signatures
- [ ] Test update flow

### 3.2 Player Depth 📋
- [ ] Add DASH support (dash.js)
- [ ] Local subtitle file loading (.srt, .vtt)
- [ ] Subtitle styling customization
- [ ] Episode auto-next for TV shows
- [ ] Intro/outro skip detection (future)

### 3.3 Casting & Devices (Optional) 📋
- [ ] Evaluate Chromecast SDK integration
- [ ] Implement device discovery
- [ ] Implement sender session
- [ ] DLNA support (optional)
- [ ] Gate behind settings

### 3.4 Add-on Catalog & Store 📋
- [ ] Build "Add-on Catalog" UI
- [ ] Curate legal, community add-ons
- [ ] Add star ratings and reviews
- [ ] Add search and filtering
- [ ] Health indicators per addon

### 3.5 Multi-Profile & Sync (Optional) 📋
- [ ] Add multi-profile support in DB
- [ ] Profile switcher UI
- [ ] Per-profile library/watchlist/favorites
- [ ] Export/import library JSON for backup

## Technology Choices (Confirmed)

- **Backend**: Rust, Tauri 2, tokio, reqwest, rusqlite
- **Frontend**: Vite, TypeScript (migrating from vanilla JS)
- **Database**: SQLite with migrations framework
- **Player**: HTML5 Video + hls.js + dash.js (future)
- **Testing**: Rust unit tests, Playwright E2E
- **CI/CD**: GitHub Actions (Linux, macOS, Windows)
- **Distribution**: GitHub Releases, Tauri updater

## Success Metrics

- **Performance**: <2s cold start, <500ms search response
- **Quality**: Zero clippy warnings, 100% fmt compliance
- **Coverage**: >70% Rust code coverage, E2E tests for all user flows
- **Accessibility**: WCAG 2.1 AA compliance (keyboard nav, contrast)
- **Security**: No inline scripts, strict CSP, signed releases
- **UX**: Toast-based notifications, smooth animations, responsive on 1080p+ displays

## Legal & Compliance

- Only legal content sources in curated addon catalog
- User-installed addons disclaimer
- Respect DMCA and content rights
- Clear terms of service
- Privacy policy (no telemetry without opt-in)

## Timeline Summary

- **Phase 0**: 1-2 weeks ✅ **100% COMPLETE**
- **Phase 1**: 2-6 weeks ✅ **100% COMPLETE**
- **Phase 2**: 1-2 months 📋 In Progress
- **Phase 3**: 2-3 months 📋 Planned

**Total estimated time to Stremio-quality**: 4-6 months of focused development

## Current Progress

### Phase 0 ✅ 100% Complete
See `docs/archive/PHASE_0_COMPLETE.md` for full summary.

### Phase 1 ✅ 100% Complete
- ✅ TypeScript migration complete (Vite + strict typing)
- ✅ Advanced HLS player (quality selection, PiP, subtitles, keyboard shortcuts)
- ✅ Full library features (watchlist, favorites, continue watching, playlists)
- ✅ Comprehensive testing (28 unit tests, 7 integration tests, 8 E2E test files)
- ✅ External player integration (VLC/MPV support with UI)

## Next Actions (Immediate)

1. **✅ Phase 1 Complete!**

2. **Begin Phase 2**: Addon protocol & content aggregation
   - Expand addon protocol implementation
   - Improve content aggregation and health scoring
   - Implement caching layer for TMDB and addon responses
   - Add database migration system

3. **Phase 3**: Distribution & polish
   - Multi-platform builds and code signing
   - Auto-updater integration
   - DASH support and advanced player features

---

**Last Updated**: Phase 1 complete, 2025-10-15
