# StreamGo - Modern Media Center

StreamGo is a cross-platform desktop application built with Rust and Tauri that replicates the core functionality of Stremio. It allows users to discover, watch, and organize movies, TV shows, and other content through an extensible addon system.

## Features

### Core Functionality
- **Content Discovery**: Search movies and TV shows via TMDB API
- **Library Management**: Personal library with persistent SQLite storage
- **Video Playback**: Integrated HLS video player with hls.js support
- **Real Add-on System**: Install, enable, disable, and uninstall add-ons from URLs
- **Modern UI**: Responsive interface with dark theme and smooth animations
- **Cross-Platform**: Runs on Windows, macOS, and Linux
- **Auto-Updates**: Built-in updater with signed releases

### Recent Improvements ✨
- **Production-Ready Add-ons**: URL-based installation with manifest validation
- **Toast Notifications**: Modern, non-intrusive notifications
- **Modal Dialogs**: Professional confirmation and input dialogs
- **Skeleton Loaders**: Smooth loading states for better UX
- **Error Recovery**: Retry buttons and helpful error messages
- **Comprehensive Settings**: 23 configurable settings with versioned persistence
- **Security Hardened**: Strict CSP, no inline scripts, input validation
- **CI/CD Quality Gates**: ESLint, clippy, fmt checks, and E2E tests
- **TypeScript Migration**: Full TypeScript support with Vite build system
- **HLS Streaming**: Native HLS video playback support

### Technical Features
- **Rust Backend**: Tauri 2 + tokio for async operations
- **SQLite Database**: Local storage with proper async handling
- **Type-Safe Models**: Versioned data structures with serde defaults
- **Modern Frontend**: TypeScript with Vite build system
- **Quality Tooling**: ESLint, cargo fmt, cargo clippy, Playwright E2E tests
- **Reproducible Builds**: Cargo.lock committed for consistent dependency resolution

## Technology Stack

- **Backend**: Rust with Tauri 2 framework
- **Frontend**: TypeScript, HTML5, CSS3, Vite
- **Database**: SQLite with `rusqlite`
- **HTTP Client**: reqwest for API integrations
- **Video Player**: hls.js for HLS streaming
- **Build System**: Cargo for Rust, Vite for frontend
- **Testing**: Playwright for E2E tests

## Project Structure

```
StreamGo/
├── src/                    # Frontend source files
│   ├── index.html         # Main HTML file
│   ├── styles.css         # CSS styles with theming
│   └── script.js          # JavaScript application logic
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   ├── lib.rs         # Main application logic and Tauri commands
│   │   ├── models.rs      # Data structures and types
│   │   ├── database.rs    # SQLite database operations
│   │   └── api.rs         # External API integrations
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── dist/                  # Built frontend assets (generated)
├── package.json           # Frontend build scripts
└── README.md             # This file
```

## Getting Started

### Prerequisites
- **Rust** (1.77.2 or later) - Install from https://rustup.rs
- **Node.js** (18 or later) and npm
- **TMDB API Key** - Get free key from https://www.themoviedb.org/settings/api
- System dependencies for Tauri (varies by platform, see Tauri docs)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd StreamGo
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and add your TMDB API key
   ```
   Get your free TMDB API key from https://www.themoviedb.org/settings/api

3. Install frontend dependencies:
   ```bash
   npm install
   ```

4. Install Rust dependencies:
   ```bash
   cd src-tauri
   cargo fetch
   cd ..
   ```

### Development

1. Run in development mode:
   ```bash
   npm run dev    # Starts Vite dev server on port 1420
   ```
   In another terminal:
   ```bash
   cd src-tauri
   cargo tauri dev
   ```

2. The application will:
   - Hot-reload frontend changes automatically
   - Restart backend on Rust code changes
   - Run on http://localhost:1420

### Linting & Quality Checks

```bash
# Frontend checks
npm run type-check    # TypeScript type checking
npm run lint          # ESLint
npm run lint:fix      # Fix ESLint issues
npm run ci            # Run all frontend checks

# E2E tests
npm run test:e2e      # Run Playwright E2E tests
npm run test:e2e:ui   # Run E2E tests with UI
npm run test:e2e:report  # View test report

# Rust checks (using Makefile)
make fmt              # Format code
make fmt-check        # Check formatting
make clippy           # Lint with clippy (warnings as errors)
make test             # Run Rust unit tests
make test-e2e         # Run E2E tests
make test-all         # Run all tests (Rust + E2E)
make check            # All Rust checks

# Full CI pipeline (Rust + Frontend checks)
make ci
# Note: E2E tests run separately in CI. Run 'make test-e2e' locally.
```

### CI/CD

The project includes GitHub Actions workflows that enforce:

**Continuous Integration** (runs on push/PR):
- ✅ Rust code formatting (`cargo fmt --check`)
- ✅ Clippy linting with warnings as errors (`cargo clippy -- -D warnings`)
- ✅ All Rust unit tests pass
- ✅ TypeScript type checking
- ✅ ESLint compliance
- ✅ Successful builds
- ✅ E2E tests with Playwright

**Release Workflow** (runs on version tags):
- ✅ Cross-platform builds (Windows, macOS, Linux)
- ✅ Code signing with Tauri signing keys
- ✅ Automated GitHub releases with installers
- ✅ Auto-updater JSON manifest generation

All checks must pass before merging pull requests.

### Building for Production

1. Build the application:
   ```bash
   cd src-tauri
   cargo tauri build
   ```

The built application will be available in `src-tauri/target/release/bundle/`.

## Configuration

### Environment Variables

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Required variables:
- **TMDB_API_KEY** (required): Your TMDB API key for content search
  - Backend reads from `std::env::var("TMDB_API_KEY")`
  - Get your key from https://www.themoviedb.org/settings/api

Optional frontend variables (prefix with `VITE_`):
- **VITE_TMDB_API_KEY**: If you need the API key in frontend code
  - Access via `import.meta.env.VITE_TMDB_API_KEY`
  - Note: Variables prefixed with `VITE_` are exposed to the browser

### Database
The application automatically creates a SQLite database in the user's local app data directory:
- **Windows**: `%LOCALAPPDATA%\StreamGo\streamgo.db`
- **macOS**: `~/Library/Application Support/StreamGo/streamgo.db`
- **Linux**: `~/.local/share/StreamGo/streamgo.db`

### Add-on System
Install add-ons from URLs (must provide manifest.json):

**Add-on Types**:
- **Content Providers**: Supply streaming links and catalog data
- **Metadata Providers**: Supply movie/show information, posters, etc.
- **Subtitle Providers**: Supply subtitle files
- **Player Extensions**: Custom playback functionality

**Manifest Format**:
```json
{
  "id": "addon-id",
  "name": "Add-on Name",
  "version": "1.0.0",
  "description": "Add-on description",
  "resources": ["catalog", "stream", "meta"],
  "types": ["movie", "series"],
  "catalogs": [...]
}
```

**Management Commands** (via Tauri):
- `install_addon(addonUrl)` - Install from URL
- `enable_addon(addonId)` - Enable an installed add-on
- `disable_addon(addonId)` - Disable an add-on
- `uninstall_addon(addonId)` - Remove an add-on

## Architecture

### Backend (Rust)
- **Database Layer**: SQLite operations for persistence
- **API Layer**: HTTP client for external service integration
- **Tauri Commands**: Exposed functions for frontend communication
- **Models**: Type-safe data structures with serde serialization

### Frontend (JavaScript)
- **App Class**: Main application logic and state management
- **Navigation**: Section-based routing system
- **Theme System**: Dynamic dark/light theme switching
- **Content Rendering**: Dynamic UI generation for media items
- **Search**: Real-time search with debouncing

### Communication
Frontend and backend communicate through Tauri's invoke system:
```javascript
// Frontend calls Rust function
const results = await window.__TAURI__.invoke('search_content', { query: 'movie name' });
```

```rust
// Rust function exposed to frontend
#[tauri::command]
async fn search_content(query: String) -> Result<Vec<MediaItem>, String> {
    // Implementation
}
```

## API Integration

The application is designed to integrate with various APIs:
- **TMDB**: Movie and TV show metadata
- **OpenSubtitles**: Subtitle files
- **Custom Addons**: User-installed content sources

## Auto-Updates

StreamGo includes a built-in auto-updater for seamless updates:

### How It Works
- **Automatic Checks**: App checks for updates on startup
- **Signed Updates**: All releases are cryptographically signed with Tauri's signing system
- **User Control**: Dialog prompts user before downloading/installing updates
- **Background Download**: Updates download in the background
- **Safe Installation**: Old version remains until new version successfully installs

### Update Process
1. App checks GitHub releases endpoint: `https://github.com/GeneticxCln/StreamGo/releases/latest/download/latest.json`
2. Compares current version with latest available version
3. If newer version exists, shows update dialog to user
4. User accepts → downloads signed installer in background
5. Verifies signature using embedded public key
6. Installs update and restarts application

### For Maintainers: Creating Signed Releases

To enable signed releases, configure these GitHub secrets:

**Required Secrets** (in repository Settings → Secrets and variables → Actions):
- `TAURI_SIGNING_PRIVATE_KEY`: Generated signing key for Tauri updater
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Password for the signing key
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

**Optional Secrets** (for macOS code signing):
- `APPLE_CERTIFICATE`: Base64-encoded .p12 certificate
- `APPLE_CERTIFICATE_PASSWORD`: Certificate password
- `APPLE_SIGNING_IDENTITY`: Developer ID Application identity
- `APPLE_ID`: Apple ID email
- `APPLE_PASSWORD`: App-specific password
- `APPLE_TEAM_ID`: Apple Developer Team ID

**Generate Tauri Signing Keys**:
```bash
# Install Tauri CLI if not already installed
cargo install tauri-cli

# Generate key pair
cargo tauri signer generate -w ~/.tauri/streamgo.key

# This creates:
# - Private key: ~/.tauri/streamgo.key (add to TAURI_SIGNING_PRIVATE_KEY secret)
# - Public key: printed to console (already in src-tauri/tauri.conf.json)
```

**Creating a Release**:
1. Update version in `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`
2. Commit changes: `git commit -am "chore: bump version to v1.2.3"`
3. Create and push tag: `git tag v1.2.3 && git push origin v1.2.3`
4. GitHub Actions automatically builds and signs releases for all platforms
5. Draft release is created with installers and `latest.json` manifest
6. Review and publish the release

**Disabling Updates** (for development/testing):
Set `"active": false` in `src-tauri/tauri.conf.json` under `plugins.updater`.

## Security

### Security Hardening
- **No Inline Scripts**: All JavaScript loaded from external files
- **Strict CSP**: Content Security Policy enforced (no `'unsafe-inline'` for scripts)
- **Input Validation**: Add-on manifests validated before installation
- **XSS Protection**: All user/API data escaped via `escapeHtml()`
- **Environment Secrets**: API keys via environment variables, never hardcoded
- **Add-on Validation**: URL format, manifest structure, and required fields checked
- **Data Privacy**: All data stored locally in SQLite, no telemetry
- **Signed Updates**: Cryptographic verification of all auto-updates
- **Reproducible Builds**: Cargo.lock committed for supply chain security

### Security Best Practices
- Use `.env` file for TMDB_API_KEY (never commit secrets to code)
- Only install add-ons from trusted sources
- Review add-on manifests before installation
- Keep Rust and npm dependencies up to date
- Verify update signatures (handled automatically by Tauri)
- Review release notes before accepting updates

## Development Roadmap

StreamGo is actively evolving to Stremio-level quality. See `EVOLUTION_ROADMAP.md` for the complete plan.

- **Phase 0** (✅ COMPLETE): Align & Stabilize
  - Preferences schema alignment
  - Real add-on persistence
  - Security hardening
  - Toast/Modal system
  - Skeleton loaders
  - CI hardening
  - Documentation updates

- **Phase 1** (🔄 Up Next): Modernize Frontend & Player
  - Vite + TypeScript setup
  - HLS player support
  - Watchlist & favorites
  - Rust unit tests
  - E2E tests with Playwright

- **Phase 2** (📋 Planned): Real Add-on Protocol
- **Phase 3** (📋 Planned): Distribution & Polish

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following our quality standards:
   - Run `npm run lint` and fix any issues
   - Run `cargo fmt` and `cargo clippy -- -D warnings`
   - Add tests if applicable
4. Submit a pull request

See `PHASE_0_PROGRESS.md` for detailed status and `CONTRIBUTING.md` for guidelines.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by Stremio's architecture and user experience
- Built with the amazing Tauri framework
- Uses various open-source libraries and APIs