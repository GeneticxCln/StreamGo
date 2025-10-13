# StreamGo - Modern Media Center

StreamGo is a cross-platform desktop application built with Rust and Tauri that replicates the core functionality of Stremio. It allows users to discover, watch, and organize movies, TV shows, and other content through an extensible addon system.

## Features

### Core Functionality
- **Content Discovery**: Search movies and TV shows via TMDB API
- **Library Management**: Personal library with persistent SQLite storage
- **Video Playback**: Integrated HTML5 video player (HLS support coming in Phase 1)
- **Real Add-on System**: Install, enable, disable, and uninstall add-ons from URLs
- **Modern UI**: Responsive interface with dark theme and smooth animations
- **Cross-Platform**: Runs on Windows, macOS, and Linux

### Phase 0 Enhancements (Just Completed!) ✨
- **Production-Ready Add-ons**: URL-based installation with manifest validation
- **Toast Notifications**: Modern, non-intrusive notifications
- **Modal Dialogs**: Professional confirmation and input dialogs
- **Skeleton Loaders**: Smooth loading states for better UX
- **Error Recovery**: Retry buttons and helpful error messages
- **Comprehensive Settings**: 23 configurable settings with versioned persistence
- **Security Hardened**: Strict CSP, no inline scripts, input validation
- **CI/CD Quality Gates**: ESLint, clippy, and fmt checks

### Technical Features
- **Rust Backend**: Tauri 2 + tokio for async operations
- **SQLite Database**: Local storage with proper async handling
- **Type-Safe Models**: Versioned data structures with serde defaults
- **Modern Frontend**: Vanilla JS (TypeScript migration in Phase 1)
- **Quality Tooling**: ESLint, cargo fmt, cargo clippy

## Technology Stack

- **Backend**: Rust with Tauri framework
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Database**: SQLite with rusqlite
- **HTTP Client**: reqwest for API integrations
- **Build System**: Cargo for Rust, npm for frontend assets

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

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Install Rust dependencies:
   ```bash
   cd src-tauri
   cargo fetch
   cd ..
   ```

### Development

1. **Set TMDB API Key** (required):
   ```bash
   export TMDB_API_KEY="your_api_key_here"
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Build the frontend:
   ```bash
   npm run build
   ```

4. Run in development mode:
   ```bash
   cd src-tauri
   cargo tauri dev
   ```

### Linting & Quality Checks

```bash
# Frontend checks
npm run type-check    # TypeScript type checking
npm run lint          # ESLint
npm run lint:fix      # Fix ESLint issues
npm run ci            # Run all frontend checks

# Rust checks (using Makefile)
make fmt              # Format code
make fmt-check        # Check formatting
make clippy           # Lint with clippy (warnings as errors)
make test             # Run tests
make check            # All Rust checks

# Full CI pipeline (both Rust and Frontend)
make ci
```

### CI/CD

The project includes GitHub Actions workflows that enforce:
- ✅ Rust code formatting (`cargo fmt --check`)
- ✅ Clippy linting with warnings as errors (`cargo clippy -- -D warnings`)
- ✅ All Rust tests pass
- ✅ TypeScript type checking
- ✅ ESLint compliance
- ✅ Successful builds

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
- **TMDB_API_KEY** (required): Your TMDB API key for content search

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

## Security

### Phase 0 Security Hardening
- **No Inline Scripts**: All JavaScript loaded from external files
- **Strict CSP**: Content Security Policy enforced (no `'unsafe-inline'` for scripts)
- **Input Validation**: Add-on manifests validated before installation
- **XSS Protection**: All user/API data escaped via `escapeHtml()`
- **Environment Secrets**: API keys via environment variables, never hardcoded
- **Add-on Validation**: URL format, manifest structure, and required fields checked
- **Data Privacy**: All data stored locally in SQLite, no telemetry

### Security Best Practices
- Set TMDB_API_KEY as environment variable (never commit to code)
- Only install add-ons from trusted sources
- Review add-on manifests before installation
- Keep Rust and npm dependencies up to date

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