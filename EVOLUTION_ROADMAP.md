# StreamGo Evolution Roadmap to Stremio-Level Polish

This document outlines the complete plan to evolve StreamGo into a production-grade, polished media center application comparable to Stremio.

## Overview

**Current State**: Functional MVP with Tauri + Rust backend, vanilla JS frontend, TMDB integration, SQLite storage, basic addon structure

**Target**: Polished, production-grade media center with modern frontend, robust player, real addon protocol, comprehensive testing, multi-platform distribution

## Phase 0: Align and Stabilize (1-2 weeks) ✅ 75% Complete

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

### 0.4 UX Fit-and-Finish 🚧 50% Complete
- [x] Create Toast notification system (CSS + JS)
- [x] Create Modal dialog system (CSS + JS)
- [ ] Replace all alert() with Toast
- [ ] Replace all prompt() with Modal.prompt()
- [ ] Replace all confirm() with Modal.confirm()

### 0.5 Skeleton Loaders & Error States 📋
- [ ] Add skeleton loaders for movie grids
- [ ] Improve error state UI
- [ ] Add retry buttons for failed operations
- [ ] Add empty state illustrations

### 0.6 CI Hardening 📋
- [ ] Fail build on clippy warnings
- [ ] Fail build on fmt check
- [ ] Add ESLint for frontend
- [ ] Add frontend lint npm script

### 0.7 Documentation Updates 📋
- [ ] Update USAGE.md (remove hardcoded key refs)
- [ ] Update README.md with Phase 0 features
- [ ] Add "Setting up TMDB API Key" guide
- [ ] Document addon commands

## Phase 1: Modernize Frontend & Improve Playback (2-6 weeks)

### 1.1 Vite + TypeScript Setup 📋
- [ ] Initialize Vite with TypeScript template
- [ ] Configure Vite for Tauri (dev server, build)
- [ ] Migrate script.js to TypeScript modules
- [ ] Add type definitions for Tauri commands
- [ ] Setup strict tsconfig.json
- [ ] Update build pipeline

### 1.2 Player Upgrades 📋
- [ ] Add hls.js for HLS/M3U8 support
- [ ] Implement quality selection UI
- [ ] Add WebVTT subtitle track support
- [ ] Add subtitle size/position controls
- [ ] Implement keyboard shortcuts (Space, F, M, Arrow keys)
- [ ] Add "Open in external player" (VLC/mpv)
- [ ] Improve player UI/controls

### 1.3 Library Features 📋
- [ ] Add watchlist Tauri commands
- [ ] Add favorites Tauri commands
- [ ] Implement "Continue Watching" on home
- [ ] Persist watch progress per item
- [ ] Add resume playback functionality

### 1.4 Rust Tests 📋
- [ ] Unit tests for Database methods
- [ ] Tests for addon validation
- [ ] Integration tests for Tauri commands
- [ ] Setup test fixtures and mocks
- [ ] Add to CI pipeline

### 1.5 E2E Tests 📋
- [ ] Setup Playwright
- [ ] Test: app launch
- [ ] Test: search flow
- [ ] Test: add to library
- [ ] Test: media detail view
- [ ] Test: video playback
- [ ] Add to CI pipeline

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

- **Phase 0**: 1-2 weeks (75% complete)
- **Phase 1**: 2-6 weeks
- **Phase 2**: 1-2 months
- **Phase 3**: 2-3 months

**Total estimated time to Stremio-quality**: 4-6 months of focused development

## Current Progress: Phase 0 (75% Complete)

See `PHASE_0_PROGRESS.md` for detailed status.

## Next Actions (Immediate)

1. Complete Phase 0.4: Replace alert/prompt/confirm with Toast/Modal
2. Implement Phase 0.5: Skeleton loaders
3. Harden CI (Phase 0.6)
4. Update docs (Phase 0.7)
5. Begin Phase 1.1: Vite + TypeScript migration

---

**Last Updated**: Phase 0 implementation, 2025-10-13
