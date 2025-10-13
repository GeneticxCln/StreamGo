# Changelog - Major Bug Fixes and Security Improvements

## Summary
Applied production-ready fixes to StreamGo to resolve critical security vulnerabilities, build issues, and stability problems identified during code review.

## Files Modified

### Backend (Rust)
- **src-tauri/src/lib.rs**
  - Removed `unwrap()` and `expect()` calls
  - Added proper error handling with user-friendly messages
  - Changed `AppState.db` from `Mutex<Database>` to `Arc<Mutex<Database>>`
  - Wrapped all database operations in `spawn_blocking` for async safety
  - Updated `get_media_details` signature to accept `media_type` parameter

- **src-tauri/src/api.rs**
  - **CRITICAL**: Removed hardcoded TMDB API key
  - Fixed `get_media_details()` to use correct endpoint based on media type
  - Updated `parse_tmdb_movie_details()` to handle both movies and TV shows correctly

- **src-tauri/tauri.conf.json**
  - Fixed `frontendDist` path from `../src` to `../dist`
  - Added strict Content Security Policy (CSP)

### Frontend (JavaScript/HTML/CSS)
- **src/script.js**
  - Added `escapeHtml()` sanitization utility at top of file
  - Sanitized all `innerHTML` operations in:
    - `renderMediaCard()`
    - `renderMediaDetail()`
    - `loadAddons()`
  - All user/API data now properly escaped before rendering

### Build Configuration
- **package.json**
  - Replaced Unix-specific commands with cross-platform Node.js scripts
  - Updated scripts: `build` and `clean`

- **build.js** (NEW)
  - Cross-platform build script using Node.js fs module
  - Automatically excludes legacy files (`*_old.*`, `test.html`)

- **clean.js** (NEW)
  - Cross-platform clean script using Node.js fs module

### Documentation
- **SECURITY_FIXES.md** (NEW)
  - Comprehensive documentation of all security fixes
  - Instructions for setting up TMDB API key
  - Production deployment checklist

- **CHANGELOG_FIXES.md** (NEW - this file)
  - Complete list of all changes made

### Files Removed
- `src/index_old.html`
- `src/script_old.js`
- `src/styles_old.css`
- `src/test.html`

## Critical Changes Requiring Action

### 1. API Key Configuration (REQUIRED)
The TMDB API key is no longer hardcoded. You MUST set it as an environment variable:

```bash
# Before running the app:
export TMDB_API_KEY="your_actual_api_key_here"
```

Without this, search and metadata features will not work.

### 2. Build Process Change
The build now outputs to `dist/` and excludes legacy files automatically. Run:

```bash
npm run build
```

This creates a clean distribution in the `dist/` directory.

## Breaking Changes
- `get_media_details()` now requires a `media_type` parameter (Rust API change)
- TMDB API key must be set via environment variable
- Build output directory changed from src to dist

## Non-Breaking Changes
- All error handling improvements are backward compatible
- HTML sanitization is transparent to existing functionality
- Async database improvements don't affect external API

## Testing Performed
✅ `cargo check` - passes  
✅ `cargo clippy` - passes (minor warnings only)  
✅ Code compiles successfully  
✅ All Tauri commands validated

## Next Steps for Developer

1. **Set API Key**:
   ```bash
   export TMDB_API_KEY="your_key_here"
   ```

2. **Test Build**:
   ```bash
   npm run build
   cd src-tauri
   cargo tauri dev
   ```

3. **Verify Features**:
   - Search functionality
   - Movie/TV show details (both types)
   - Library operations
   - Settings persistence

4. **Optional Cleanup**:
   ```bash
   cd src-tauri
   cargo clippy --fix  # Auto-fix minor import warnings
   cargo fmt          # Format code
   ```

## Production Deployment Notes

### Environment Variables
Set `TMDB_API_KEY` in your deployment environment (not in code or .env files that get committed).

### Build Command
```bash
npm run build
cd src-tauri
cargo tauri build
```

### Security Checklist
- [x] No hardcoded secrets
- [x] CSP configured
- [x] XSS protection via HTML escaping
- [x] Proper error handling (no panics)
- [x] Non-blocking database operations

## Performance Improvements
- Database operations no longer block async runtime
- Better concurrency through `Arc<Mutex>` pattern
- Efficient error propagation without panics

## Code Quality
- Production-ready error handling
- Cross-platform compatible build scripts
- Clean codebase (legacy files removed)
- Proper async/await patterns

---

All changes follow Rust and JavaScript best practices and align with the requirement for "production-ready code."
