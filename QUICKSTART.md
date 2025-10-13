# StreamGo Quick Start Guide

## 🚀 Get Up and Running in 5 Minutes

### Prerequisites
- Rust 1.77.2+ installed
- Node.js 18+ and npm
- TMDB API key (free from https://www.themoviedb.org/settings/api)

### Installation

```bash
# 1. Navigate to project
cd /home/quinton/StreamGo

# 2. Install frontend dependencies
npm install

# 3. Build frontend
npm run build

# 4. Set TMDB API key (REQUIRED!)
export TMDB_API_KEY="your_api_key_here"

# 5. Run the app
cd src-tauri
cargo tauri dev
```

## ✅ What Works Right Now

### Search & Library
- Search movies and TV shows (powered by TMDB)
- Add items to your personal library
- View library with poster images
- Skeleton loaders while content loads

### Add-ons
- Install add-ons from URL (with manifest validation)
- Enable/disable installed add-ons
- Uninstall add-ons
- Built-in add-ons: TMDB Provider, YouTube Addon, Local Files

### Settings
- 23 configurable settings across all categories
- Settings persist to SQLite database
- Theme, video quality, audio, playback, subtitles, network, advanced options

### UX Improvements
- Toast notifications (success, error, warning, info)
- Modal dialogs for confirmations
- Skeleton loaders during loading
- Error states with retry buttons
- Empty states for better UX

### Video Playback
- Basic HTML5 video player
- Demo video (Big Buck Bunny) for testing
- HLS support coming in Phase 1

## 📖 Key Documentation

- `README.md` - Complete project overview
- `USAGE.md` - Detailed usage instructions
- `PHASE_0_COMPLETE.md` - What was just completed
- `EVOLUTION_ROADMAP.md` - Full roadmap to Stremio-quality
- `IMPLEMENTATION_SUMMARY.md` - Technical implementation details

## 🧪 Testing the Features

### Test Search
1. Click "Search" in sidebar
2. Enter "Inception" and click Search
3. You'll see skeleton loaders, then results
4. Hover over a movie card to see "Add to Library" button
5. Click to add, toast notification will appear

### Test Library
1. Click "Library" in sidebar
2. Should show items you added
3. Empty state if no items yet
4. Click on item to see details

### Test Add-ons
1. Click "Add-ons" in sidebar
2. See 3 built-in add-ons
3. Click "Install Add-on" to add from URL
4. Modal dialog will appear for URL input

### Test Settings
1. Click "Settings" in sidebar
2. Change any setting (e.g., theme to "dark")
3. Click "Save Settings"
4. Toast notification confirms save
5. Settings persist after restart

## 🛠️ Development Commands

```bash
# Frontend linting
npm run lint          # Check for errors
npm run lint:fix      # Auto-fix errors

# Rust quality checks
cd src-tauri
cargo fmt --check     # Check formatting
cargo fmt             # Auto-format
cargo clippy -- -D warnings  # Lint with warnings as errors

# Build for production
npm run build
cd src-tauri
cargo tauri build
```

## 🐛 Troubleshooting

### "Tauri API not available" error
- Make sure you're running `cargo tauri dev` from `src-tauri/` directory
- Frontend should be built with `npm run build` first

### Search returns no results
- Check TMDB_API_KEY is set: `echo $TMDB_API_KEY`
- Ensure you have internet connection
- TMDB API may have rate limits

### Library is empty
- You need to search and add items first
- Database is at `~/.local/share/StreamGo/streamgo.db`

### Add-on installation fails
- URL must be valid http/https
- Must have valid manifest.json at the URL
- Check browser console for detailed error

## 🎯 What's Next?

Phase 0 is complete! The project is now ready for Phase 1:

### Phase 1 Coming Soon
- Vite + TypeScript for better DX
- HLS player support (adaptive streaming)
- Quality selection UI
- Subtitle track support
- Watchlist and favorites
- Comprehensive testing

See `EVOLUTION_ROADMAP.md` for the complete plan.

## 📝 Notes

- All data stored locally (no cloud sync yet)
- API key is never sent anywhere except TMDB
- Add-ons are sandboxed with validation
- No telemetry or analytics (unless you enable in settings)

## 🎉 Enjoy StreamGo!

You now have a production-ready media center with:
- ✅ Real add-on system
- ✅ Modern UX (toasts, modals, skeletons)
- ✅ 23 configurable settings
- ✅ Security hardened
- ✅ Quality gates in CI

Happy streaming! 🍿
