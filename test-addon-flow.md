# 🧪 Testing Addon Installation & Browsing Flow

**Objective**: Verify that Stremio addons now install and their content is browsable.

---

## ✅ Pre-Test Checklist

All fixes have been applied:
- [x] TypeScript manifest interface accepts string resources
- [x] Manifest validation handles string arrays
- [x] Stream URL validation accepts magnet://, acestream://, rtmp://
- [x] HTTP timeout increased to 15s
- [x] Aggregator timeout increased to 10s
- [x] Code compiles (TypeScript, ESLint, Rust)

---

## 🚀 Test Flow

### Step 1: Install a Working Addon

1. **Start the app**:
   ```bash
   # Terminal 1
   cd /home/quinton/StreamGo
   npm run dev
   
   # Terminal 2 (wait for Vite to finish)
   npm run tauri:dev
   ```

2. **Navigate to Addons**:
   - Click "Add-ons" in left sidebar
   - Click "Discover Store" tab (top right)

3. **Install Cinemeta (Official TMDB addon)**:
   - Click **"TMDB Metadata"** quick install button
   - OR manually paste: `https://v3-cinemeta.strem.io/manifest.json`
   - Click "Install"

4. **Expected Result**:
   ```
   ✅ Toast: "Addon 'Cinemeta' installed successfully!"
   ✅ Automatically switches to "Installed" tab
   ✅ Cinemeta appears in addon list
   ✅ No console errors
   ```

---

### Step 2: Browse Addon Catalogs

1. **Navigate to Discover**:
   - Click "Discover" in left sidebar
   - App should **auto-load** first available catalog

2. **Check Media Type selector**:
   - Select "Movies" (should be default)
   - Verify catalog dropdown populates with options
   - Should see: "Cinemeta Movies", "Top", etc.

3. **Browse Catalog**:
   - Select a catalog (e.g., "Top")
   - Click "Refresh" button
   - **Wait 5-10 seconds** (addons can be slow)

4. **Expected Result**:
   ```
   ✅ Loading skeleton appears briefly
   ✅ Grid fills with movie posters
   ✅ 20+ items displayed
   ✅ "Load More" button visible if more content
   ✅ No timeout errors
   ```

---

### Step 3: View Item Details

1. **Click on any movie poster**
2. **Expected Result**:
   ```
   ✅ Detail page opens
   ✅ Movie title, poster, description visible
   ✅ "Play Now" button enabled
   ✅ "Streams" section shows loading spinner
   ```

---

### Step 4: Check Stream Sources

1. **Wait for streams to load** (5-10 seconds)
2. **Expected Result**:
   ```
   ✅ Stream buttons appear
   ✅ Shows quality labels (1080p, 720p, etc.)
   ✅ Can select a stream (button highlights)
   ```

---

### Step 5: Test Playback

1. **Click "Play Now"**
2. **Expected Result**:
   ```
   ✅ Player opens in fullscreen
   ✅ Video starts buffering/playing
   ✅ Player controls visible
   ✅ OR: External player launches (if configured)
   ```

---

## 🐛 Known Issues & Workarounds

### Issue 1: "No streams available"
**Cause**: Cinemeta is metadata-only, doesn't provide streams  
**Fix**: Install WatchHub addon:
```
URL: https://watchhub.strem.io/manifest.json
```

### Issue 2: Streams won't play
**Cause**: Browser can't play magnet:/acestream: links  
**Fix**: 
- Use HTTP stream addons (USA TV, StreamAsia)
- OR configure external player (VLC)

### Issue 3: Catalog times out
**Cause**: Slow addon or network issue  
**Fix**: 
- Wait 15 seconds before retrying
- Check console for timeout errors
- Try a different catalog

### Issue 4: No catalogs appear
**Cause**: No addons with catalog resource installed  
**Fix**:
- Install Cinemeta (metadata + catalogs)
- Restart app
- Check console for errors

---

## 📊 Success Criteria

### ✅ Minimum Viable Test
- [ ] Cinemeta installs without errors
- [ ] Discover section loads catalogs
- [ ] At least 10 movies visible
- [ ] Detail page opens with movie info

### ✅ Full Working Test
- [ ] All of above +
- [ ] WatchHub installs (stream provider)
- [ ] Stream selection shows options
- [ ] Video playback works

---

## 🔍 Debugging Commands

### Check installed addons (from browser console):
```javascript
await window.app.loadAddons();
```

### Manually list catalogs:
```javascript
const catalogs = await window.invoke('list_catalogs', { media_type: 'movie' });
console.log('Catalogs:', catalogs);
```

### Manually fetch catalog items:
```javascript
const result = await window.invoke('aggregate_catalogs', {
  media_type: 'movie',
  catalog_id: 'top', 
  extra: { skip: '0', limit: '20' }
});
console.log('Items:', result.items);
```

### Check for errors:
```javascript
// Open DevTools (F12) and check:
// 1. Console tab for red errors
// 2. Network tab for failed requests
// 3. Application > Local Storage for cached data
```

---

## 📝 Test Results Log

### Run 1: [Date/Time]
- [ ] Addon installation: _______________
- [ ] Catalog loading: _______________
- [ ] Item display: _______________
- [ ] Stream loading: _______________
- [ ] Playback: _______________
- **Notes**: 

---

## 🎯 Next Steps After Testing

### If All Tests Pass ✅
The addon system is fully functional! Consider:
1. Adding more community addons to store UI
2. Implementing torrent player integration
3. Adding addon configuration UI

### If Tests Fail ❌
1. Check browser console for errors
2. Check terminal logs for Rust errors
3. Verify addon URL is correct
4. Try different addon (USA TV for HTTP streams)
5. Report issue with error messages

---

## 🔗 Quick Reference

**Working Addon URLs**:
```
Cinemeta:      https://v3-cinemeta.strem.io/manifest.json
WatchHub:      https://watchhub.strem.io/manifest.json
OpenSubtitles: https://opensubtitles.strem.io/manifest.json
USA TV:        https://usatv.strem.io/manifest.json (HTTP streams)
```

**Important Files**:
```
Frontend: src/app.ts (lines 208-323 = Discover section)
Backend:  src-tauri/src/lib.rs (list_catalogs, aggregate_catalogs, get_streams)
Protocol: src-tauri/src/addon_protocol.rs (validation)
```

**Console Commands**:
```bash
# TypeScript check
npm run type-check

# ESLint
npm run lint

# Rust check
cd src-tauri && cargo check --lib

# Full dev server
npm run dev  # Terminal 1
npm run tauri:dev  # Terminal 2
```

---

**Status**: Ready for testing 🚀
**Estimated Test Time**: 10-15 minutes
**Required**: Network connection to fetch addon manifests
