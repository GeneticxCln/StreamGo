# StreamGo - Usage Instructions

## What's Been Implemented

StreamGo is now a fully functional MVP with:

### ✅ Features
- **Real TMDB Integration**: Search for movies and TV shows using The Movie Database API
- **Library Management**: Add items to your personal library stored in SQLite
- **Multiple Views**: Home, Search, Library, and Add-ons sections
- **Add-on System**: View installed add-ons (mock data for now)
- **Modern UI**: Clean, responsive interface with dark theme

### 🔧 Backend (Rust/Tauri)
- SQLite database for persistent storage
- TMDB API integration for content discovery
- Tauri commands exposed to frontend:
  - `search_content` - Search movies/TV shows
  - `get_library_items` - Fetch user library
  - `add_to_library` - Add items to library
  - `get_addons` - List installed add-ons
  - `install_addon` - Install new add-on
  - `get_media_details` - Get detailed info about a media item

### 🎨 Frontend (HTML/CSS/JS)
- Multi-section navigation
- Real-time search with loading indicators
- Movie/TV show cards with posters
- "Add to Library" functionality
- Library counter and management

## Running the App

### Prerequisites
- Rust (already installed)
- Python 3 (for dev server)

### Development Mode

1. Make sure you're in the project directory:
   ```bash
   cd /home/quinton/StreamGo
   ```

2. **Set up TMDB API Key** (required for search functionality):
   
   The app requires a TMDB API key to search for movies and TV shows. Get your free API key from:
   https://www.themoviedb.org/settings/api
   
   Then set it as an environment variable:
   ```bash
   # Linux/macOS
   export TMDB_API_KEY="your_api_key_here"
   
   # Or add to your ~/.zshrc or ~/.bashrc for persistence:
   echo 'export TMDB_API_KEY="your_api_key_here"' >> ~/.zshrc
   ```

3. Run the app in development mode:
   ```bash
   cd src-tauri
   cargo tauri dev
   ```

   This will:
   - Start a Python HTTP server on port 3000 (serving the frontend)
   - Build and launch the Tauri app
   - Open a desktop window

### Using the App

1. **Home Section**: 
   - Welcome screen
   - Shows recently added library items (if any)

2. **Search Section**:
   - Enter a movie or TV show name
   - Click "Search" or press Enter
   - Browse results with poster images
   - Hover over cards to see "Add to Library" button
   - Click to add items to your library

3. **Library Section**:
   - View all items you've added
   - See item count
   - Items persist in SQLite database

4. **Add-ons Section**:
   - View installed add-ons
   - Currently shows 3 built-in mock add-ons

### Example Searches to Try

- "Inception"
- "Breaking Bad"
- "The Matrix"
- "Game of Thrones"
- "Interstellar"

### Database Location

Your library is stored in:
- **Linux**: `~/.local/share/StreamGo/streamgo.db`

### Building for Production

To create a release build:
```bash
cd src-tauri
cargo tauri build
```

The built application will be in `src-tauri/target/release/bundle/`

## Troubleshooting

### If the app window doesn't open
- Check that Python 3 is installed: `python3 --version`
- Make sure port 3000 is not in use

### If search doesn't work
- Check your internet connection (TMDB API requires network access)
- The API key is hardcoded in the code, but TMDB may have rate limits

### If library doesn't save
- Check file permissions for `~/.local/share/StreamGo/`
- The database is created automatically on first run

## Recent Enhancements (Phase 0 Complete!)

### ✅ What's New

- **Real Add-on System**: Install add-ons from URLs with manifest validation
- **Enable/Disable/Uninstall**: Full add-on management
- **Toast Notifications**: Modern notification system instead of browser alerts
- **Modal Dialogs**: Professional modals for confirmations and prompts
- **Skeleton Loaders**: Smooth loading states for better UX
- **Improved Error Handling**: Retry buttons and helpful error messages
- **Comprehensive Settings**: 23 settings with database persistence
- **Security Hardened**: No inline scripts, strict CSP
- **CI/CD Improvements**: Linting and format checks

### 🚀 Coming Next (Phase 1)

- Vite + TypeScript migration for type safety
- HLS player support for adaptive streaming
- Quality selection and subtitle tracks
- Watchlist and favorites functionality
- Continue watching feature
- Comprehensive test coverage

## Notes

- **TMDB API Key**: Always set via environment variable `TMDB_API_KEY`
- **Add-ons**: Install from URLs - the app validates manifests and stores in SQLite
- **Streaming**: Uses sample video URL for demo (Big Buck Bunny)
- **Database**: Located at `~/.local/share/StreamGo/streamgo.db`

## New Commands Available

### Add-on Management
```javascript
// Install addon from URL
await window.__TAURI__.invoke('install_addon', { addonUrl: 'https://...' });

// Enable/disable addon
await window.__TAURI__.invoke('enable_addon', { addonId: 'addon_id' });
await window.__TAURI__.invoke('disable_addon', { addonId: 'addon_id' });

// Uninstall addon
await window.__TAURI__.invoke('uninstall_addon', { addonId: 'addon_id' });
```

### Settings
```javascript
// Get user settings
const settings = await window.__TAURI__.invoke('get_settings');

// Save settings
await window.__TAURI__.invoke('save_settings', { settings: {...} });
```
