# Changelog

All notable changes to StreamGo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Cross-platform distribution with auto-updates
- GitHub Actions release workflow for Windows, macOS, and Linux
- Code signing infrastructure with Tauri updater
- Comprehensive release process documentation
- Version bump script for automated versioning

### Changed
- Migrated to official `@tauri-apps/api` package
- Unified Node.js version to 20 across all CI pipelines
- Improved E2E test reliability with proper DOM selectors

### Fixed
- Fixed E2E tests to match actual DOM structure
- Corrected Rust code formatting in src-tauri directory
- Synchronized version numbers across package.json, Cargo.toml, and tauri.conf.json

## [0.1.0] - Initial Development

### Added
- Initial Tauri-based application structure
- SQLite database for persistent storage
- TMDB API integration for media metadata
- HLS video streaming support with hls.js
- Playlist management with drag-and-drop
- Add-on system for content sources
- Watchlist and favorites functionality
- Watch progress tracking
- Responsive UI with modern design
- Content Security Policy (CSP) implementation
- E2E testing with Playwright
- Rust unit tests
- CI/CD pipelines with GitHub Actions
- Cross-platform support (Windows, macOS, Linux)

[Unreleased]: https://github.com/GeneticxCln/StreamGo/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/GeneticxCln/StreamGo/releases/tag/v0.1.0
