# StreamGo Addon Testing Guide

**Date**: 2025-10-17  
**Status**: Ready for Production Testing  
**Version**: v0.1.0

---

## 🎯 Testing Overview

This guide covers complete testing of StreamGo's Stremio addon compatibility including:
- ✅ Addon installation
- ✅ Metadata retrieval
- ✅ Stream playback
- ✅ Subtitle loading
- ✅ Series/episode navigation
- ✅ Health monitoring

---

## 🚀 Quick Start Testing

### Step 1: Start StreamGo

```bash
cd ~/StreamGo

# Terminal 1: Frontend development server
npm run dev

# Terminal 2: Tauri backend
npm run tauri:dev
```

Wait for both to start. StreamGo should open in a window.

---

## 📦 Install Real Stremio Addons

### Addon 1: Cinemeta (Metadata)

**Purpose**: Provides rich metadata for movies and series  
**URL**: `https://v3-cinemeta.strem.io/manifest.json`

**Installation**:
1. Open StreamGo
2. Navigate to **Addons** section
3. Click **Install from URL** tab
4. Paste: `https://v3-cinemeta.strem.io/manifest.json`
5. Click **Install**
6. Verify: Should see "✓ Installed" button

**What to Test**:
```typescript
// In browser console (F12)
const meta = await invoke('get_addon_meta', {
  content_id: 'tt0111161',  // The Shawshank Redemption
  media_type: 'movie'
});

console.log(meta);
// Expected output:
// {
//   name: "The Shawshank Redemption",
//   imdbRating: 9.3,
//   director: ["Frank Darabont"],
//   cast: ["Tim Robbins", "Morgan Freeman", ...],
//   genres: ["Drama"],
//   description: "...",
//   trailers: [...],
//   poster: "https://...",
//   ...
// }
```

### Addon 2: WatchHub (Stream Aggregator)

**Purpose**: Aggregates streams from legal sources  
**URL**: `https://watchhub.strem.io/manifest.json`

**Installation**:
1. **Addons** → **Install from URL**
2. Paste: `https://watchhub.strem.io/manifest.json`
3. Click **Install**

**What to Test**:
```typescript
// Get available streams
const streams = await invoke('get_streams', {
  content_id: 'tt0111161',
  media_type: 'movie'
});

console.log(streams);
// Expected: Array of stream objects with URLs
// [
//   { url: "https://...", name: "1080p", title: "...", ... },
//   { url: "https://...", name: "720p", title: "...", ... }
// ]
```

### Addon 3: OpenSubtitles (Subtitles)

**Purpose**: Provides subtitles in multiple languages  
**URL**: `https://opensubtitles.strem.io/manifest.json`

**Installation**:
1. **Addons** → **Install from URL**
2. Paste: `https://opensubtitles.strem.io/manifest.json`
3. Click **Install**

**What to Test**:
```typescript
// Get subtitles
const subtitles = await invoke('get_subtitles', {
  content_id: 'tt0111161',
  media_type: 'movie'
});

console.log(subtitles);
// Expected: Array of subtitle tracks
// [
//   { id: "en", url: "https://...", lang: "eng" },
//   { id: "es", url: "https://...", lang: "spa" },
//   ...
// ]
```

---

## 🎬 Testing Series & Episodes

### Test Series: Game of Thrones

**Series ID**: `tt0944947`

**Test 1: Get Series Metadata**

```typescript
const meta = await invoke('get_addon_meta', {
  content_id: 'tt0944947',
  media_type: 'series'
});

console.log(meta.name);          // "Game of Thrones"
console.log(meta.videos.length); // Should be 73 (total episodes)
console.log(meta.videos[0]);     // First episode
// {
//   id: "tt0944947:1:1",
//   title: "Winter Is Coming",
//   season: 1,
//   episode: 1,
//   overview: "...",
//   ...
// }
```

**Test 2: Episode ID Parsing**

```typescript
const episodeId = "tt0944947:8:6";  // S08E06 (finale)

// Check if it's an episode ID
console.log(EpisodeId.isEpisodeId(episodeId));  // true

// Parse it
const parsed = EpisodeId.parse(episodeId);
console.log(parsed);
// { seriesId: "tt0944947", season: 8, episode: 6 }

// Get series ID
console.log(EpisodeId.getSeriesId(episodeId));  // "tt0944947"

// Build episode ID
const built = EpisodeId.build("tt0944947", 1, 1);
console.log(built);  // "tt0944947:1:1"
```

**Test 3: Episode Navigator UI**

```typescript
// Create navigator (in your app code)
const navigator = new EpisodeNavigator('episode-container');

// Load series
await navigator.loadSeries('tt0944947', (episodeId) => {
    console.log('User selected:', episodeId);
    // Play episode
});

// Get next episode
const nextEp = navigator.getNextEpisode('tt0944947:1:1');
console.log(nextEp?.title);  // "The Kingsroad" (S01E02)
```

---

## 🎥 Full Playback Testing

### Test Complete Workflow

```typescript
// 1. Search for content
const results = await invoke('search_content', {
    query: 'Inception'
});
console.log(results[0]);  // First result

// 2. Get detailed metadata
const meta = await invoke('get_addon_meta', {
    content_id: results[0].id,
    media_type: 'movie'
});
console.log('Title:', meta.name);
console.log('Director:', meta.director);
console.log('Cast:', meta.cast);

// 3. Get streams
const streams = await invoke('get_streams', {
    content_id: results[0].id,
    media_type: 'movie'
});
console.log('Available streams:', streams.length);

// 4. Get subtitles
const subtitles = await invoke('get_subtitles', {
    content_id: results[0].id,
    media_type: 'movie'
});
console.log('Available subtitles:', subtitles.length);

// 5. Play (assuming you have a player instance)
if (streams.length > 0) {
    player.loadStream(streams[0].url);
}
```

---

## 🔍 Health Monitoring Testing

### Check Addon Health

```typescript
// Get health summaries for all addons
const health = await invoke('get_addon_health_summaries');

health.forEach(addon => {
    console.log(`
Addon: ${addon.addon_id}
Health Score: ${addon.health_score}%
Success Rate: ${(addon.success_rate * 100).toFixed(1)}%
Avg Response: ${addon.avg_response_time_ms}ms
Total Requests: ${addon.total_requests}
Successful: ${addon.successful_requests}
Failed: ${addon.failed_requests}
Last Error: ${addon.last_error || 'None'}
    `);
});
```

### Expected Health Scores

| Addon | Expected Score | Notes |
|-------|---------------|-------|
| Cinemeta | 95-100% | Official addon, very reliable |
| WatchHub | 85-95% | Aggregator, depends on sources |
| OpenSubtitles | 90-98% | Large database, usually fast |

---

## ⚠️ Common Issues & Solutions

### Issue 1: "No addons with metadata support available"

**Cause**: No addons with `meta` resource installed  
**Solution**: Install Cinemeta addon

### Issue 2: "No valid streams found"

**Cause**: Content not available from installed addons  
**Solution**: 
- Try different content
- Install more stream provider addons
- Check if content is geo-blocked

### Issue 3: Addon installation fails

**Possible causes**:
1. Invalid manifest URL
2. Network connectivity issues
3. Addon server down

**Debug steps**:
```bash
# Test manifest URL directly
curl https://v3-cinemeta.strem.io/manifest.json

# Check Rust logs
tail -f ~/path/to/streamgo/logs/streamgo.log

# Check browser console (F12) for errors
```

### Issue 4: Episode navigation doesn't work

**Cause**: Series metadata doesn't include episodes  
**Solution**: Ensure addon supports series metadata (Cinemeta does)

---

## 📊 Performance Benchmarks

### Expected Performance

| Operation | Target | Acceptable |
|-----------|--------|------------|
| Addon installation | <3s | <5s |
| Get metadata | <500ms | <1s |
| Get streams | <1s | <2s |
| Get subtitles | <800ms | <1.5s |
| Health check | <200ms | <500ms |

### Measure Performance

```typescript
// Measure metadata fetch time
console.time('metadata');
await invoke('get_addon_meta', {
    content_id: 'tt0111161',
    media_type: 'movie'
});
console.timeEnd('metadata');
// Expected: metadata: 300-800ms
```

---

## ✅ Testing Checklist

### Phase 1: Installation
- [ ] Install Cinemeta addon
- [ ] Install WatchHub addon
- [ ] Install OpenSubtitles addon
- [ ] Verify all show "✓ Installed"
- [ ] Check addons list shows 3 addons

### Phase 2: Metadata
- [ ] Get movie metadata (The Shawshank Redemption)
- [ ] Verify cast, director, genres present
- [ ] Get series metadata (Game of Thrones)
- [ ] Verify episodes list (73 episodes)

### Phase 3: Streams
- [ ] Get streams for movie
- [ ] Verify multiple quality options
- [ ] Test stream URL validity
- [ ] Play stream in player

### Phase 4: Subtitles
- [ ] Get subtitles for movie
- [ ] Verify multiple languages
- [ ] Test subtitle file download
- [ ] Load subtitle in player

### Phase 5: Episodes
- [ ] Parse episode ID
- [ ] Get next episode
- [ ] Load episode navigator
- [ ] Select different seasons
- [ ] Click episode to play

### Phase 6: Health
- [ ] Check addon health scores
- [ ] Verify success rates >90%
- [ ] Monitor response times
- [ ] Check for error messages

---

## 🎉 Success Criteria

StreamGo is **production-ready** when:

✅ **All 3 addons installed successfully**  
✅ **Metadata retrieved within 1 second**  
✅ **Streams available for test movies**  
✅ **Subtitles load for test movies**  
✅ **Series episodes display correctly**  
✅ **Health scores above 90%**  
✅ **Video playback works smoothly**

---

## 📝 Reporting Issues

If you encounter bugs:

1. **Check browser console** (F12 → Console)
2. **Check Rust logs** (`~/path/to/streamgo/logs/`)
3. **Take screenshots** of errors
4. **Note the exact steps** to reproduce
5. **Report on GitHub Issues**

Include:
- StreamGo version
- Addon being tested
- Full error message
- Steps to reproduce

---

## 🔄 Continuous Testing

### Daily Testing
- Check addon health scores
- Verify playback still works
- Monitor response times

### Weekly Testing
- Test new addon installations
- Verify series navigation
- Check for addon updates

### Before Releases
- Run all test scenarios
- Verify on clean installation
- Test on multiple platforms

---

**Happy Testing! 🎬**

For questions or help, see: `STREMIO_COMPATIBILITY_COMPLETE.md`
