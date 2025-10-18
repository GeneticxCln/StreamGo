# 🎬 Subtitle Auto-Fetch — OpenSubtitles & SubDB

StreamGo now automatically fetches subtitles from multiple providers based on video file hashing and IMDB ID matching.

## Features

### ✅ **OpenSubtitles Support** (Fully Implemented)
- **Search by IMDB ID**: Find subtitles for movies/shows using IMDB identifier
- **Search by File Hash**: Match subtitles based on video file's unique hash
- **Smart Scoring**: Ranks subtitles by download count, rating, and quality
- **Multi-language**: Support for any language code
- **Hearing Impaired**: Identifies and handles CC/SDH subtitles

### ✅ **SubDB Support** (Fully Implemented)
- **Hash-based Matching**: Fast subtitle matching using MD5 hash
- **Fallback Provider**: Automatically used when OpenSubtitles fails
- **Simple API**: No API key required

### ✅ **Intelligent Matching**
- **Automatic Hash Calculation**: OpenSubtitles and SubDB hash algorithms
- **Score-based Ranking**: Best subtitle selected automatically
- **Multi-provider Aggregation**: Combines results from all sources
- **Deduplication**: Removes duplicate results

## Architecture

### Backend (Rust)

**Module**: `src-tauri/src/subtitle_providers.rs`

Key components:
- `SubtitleManager`: Main coordinator
- `OpenSubtitlesClient`: OpenSubtitles API v1 client
- `SubDBClient`: SubDB API client
- `calculate_opensubtitles_hash()`: Video file hash (first + last 64KB)
- `calculate_subdb_hash()`: MD5 hash (first + last 64KB)

### Tauri Commands

```rust
// Auto-fetch subtitles (searches all providers)
auto_fetch_subtitles(file_path?, imdb_id?, languages) -> SubtitleResult[]

// Download best matching subtitle
download_best_subtitle(results) -> (String, SubtitleResult)

// Calculate video file hash for manual searches
calculate_video_hash(file_path) -> (String, u64)
```

## Configuration

### OpenSubtitles API Key

Get a free API key from [OpenSubtitles.com](https://www.opensubtitles.com/api):

1. Create account at OpenSubtitles
2. Navigate to API section
3. Generate API key
4. Add to `.env` file:

```bash
OPENSUBTITLES_API_KEY=your_key_here
```

**Note**: SubDB doesn't require an API key.

## Usage Examples

### Backend Usage

```rust
use subtitle_providers::SubtitleManager;

// Initialize manager
let api_key = Some("your_opensubtitles_key".to_string());
let manager = SubtitleManager::new(api_key);

// Auto-fetch subtitles
let results = manager.auto_fetch(
    Some("/path/to/movie.mp4"),
    Some("tt0111161"),  // Shawshank Redemption
    &["en", "es", "fr"],
).await?;

// Download best subtitle
let (content, subtitle_info) = manager.download_best(&results).await?;

// Save to file
std::fs::write("subtitle.srt", content)?;
```

### Frontend Usage (TypeScript)

```typescript
import { invoke } from '@tauri-apps/api/core';

// Auto-fetch subtitles
const results = await invoke('auto_fetch_subtitles', {
  filePath: '/path/to/movie.mp4',
  imdbId: 'tt0111161',
  languages: ['en', 'es', 'fr'],
});

console.log(`Found ${results.length} subtitles`);

// Display results to user
results.forEach((sub) => {
  console.log(`${sub.language}: ${sub.file_name} (score: ${sub.score})`);
});

// Download best subtitle
const [content, info] = await invoke('download_best_subtitle', {
  results,
});

// Use the subtitle content
console.log(`Downloaded: ${info.file_name} from ${info.provider}`);
```

## Data Types

### SubtitleResult
```typescript
interface SubtitleResult {
  id: string;                    // Unique ID
  language: string;              // Language name (e.g., "English")
  language_code: string;         // ISO code (e.g., "en")
  file_name: string;             // Original filename
  download_url: string;          // Download URL
  score: number;                 // Quality score (0-100)
  provider: 'opensubtitles' | 'subdb';
  format: string;                // Usually "srt"
  hearing_impaired: boolean;     // CC/SDH indicator
  download_count?: number;       // Popularity (OpenSubtitles only)
  rating?: number;               // User rating (OpenSubtitles only)
}
```

## Hash Algorithms

### OpenSubtitles Hash
```rust
// Algorithm: Sum of uint64 values + file size
// Input: First 64KB + Last 64KB of video file
// Output: 16-character hex string

let (hash, file_size) = calculate_opensubtitles_hash("movie.mp4")?;
// hash = "8e245d9679d31e12"
// file_size = 734003200
```

### SubDB Hash
```rust
// Algorithm: MD5 of concatenated chunks
// Input: First 64KB + Last 64KB of video file
// Output: 32-character MD5 hex string

let hash = calculate_subdb_hash("movie.mp4")?;
// hash = "ffd8d4aa68033dc03d1c8ef373b9028c"
```

## Scoring System

Subtitles are scored based on multiple factors:

```rust
score = 0.0;

// Download count (0-50 points)
score += min(download_count, 10000) / 200;

// Rating (0-30 points)
score += rating * 6.0;  // rating is 0-5

// Penalty for hearing impaired
if hearing_impaired {
    score -= 5.0;
}

score = max(score, 0.0);
```

**Example Scores:**
- **High quality**: 5000 downloads + 4.5 rating = ~52 points
- **Medium quality**: 100 downloads + 3.0 rating = ~18.5 points
- **Low quality**: 10 downloads + 2.0 rating + HI = ~12 points

## Search Strategies

The auto-fetch function uses multiple strategies in parallel:

1. **IMDB ID Search** (OpenSubtitles only)
   - Most reliable for known content
   - Returns subtitles for specific movie/show
   - Language filtered

2. **File Hash Search** (Both providers)
   - OpenSubtitles hash → OpenSubtitles API
   - SubDB hash → SubDB API
   - Exact file match
   - Works even without IMDB ID

3. **Aggregation & Scoring**
   - Combines all results
   - Deduplicates by language + filename
   - Sorts by score (descending)
   - Returns sorted list

## Error Handling

All methods gracefully handle failures:

```typescript
// If OpenSubtitles fails, SubDB is still tried
// If no API key, OpenSubtitles is skipped
// If file hash fails, IMDB search is still attempted
// Empty results returned instead of errors (when possible)
```

**Backend logging**:
```rust
// Errors are logged as warnings
warn!(error = %e, "OpenSubtitles IMDB search failed");
warn!(error = %e, "SubDB hash search failed");

// Successes are logged as info
info!("Found {} subtitles on OpenSubtitles", results.len());
info!("Found {} subtitles on SubDB", results.len());
```

## Integration with Player

### Automatic Subtitle Loading

```typescript
// When video starts playing
async function onVideoLoad(videoPath: string, imdbId?: string) {
  // Fetch subtitles in background
  const subtitles = await invoke('auto_fetch_subtitles', {
    filePath: videoPath,
    imdbId,
    languages: ['en'], // User's preferred languages
  });

  if (subtitles.length > 0) {
    // Download best subtitle
    const [content, info] = await invoke('download_best_subtitle', {
      results: subtitles,
    });

    // Convert SRT to VTT if needed
    const vtt = await invoke('convert_srt_to_vtt', {
      srtContent: content,
    });

    // Load into video player
    loadSubtitleTrack(vtt, info.language);
  }
}
```

### Manual Subtitle Selection

```svelte
<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';

  let subtitles = [];
  let selectedSubtitle = null;

  async function searchSubtitles() {
    subtitles = await invoke('auto_fetch_subtitles', {
      filePath: currentVideoPath,
      imdbId: currentImdbId,
      languages: ['en', 'es', 'fr', 'de'],
    });
  }

  async function selectSubtitle(subtitle) {
    const [content, info] = await invoke('download_best_subtitle', {
      results: [subtitle], // Download specific subtitle
    });
    selectedSubtitle = { content, info };
    loadIntoPlayer(content);
  }
</script>

<button on:click={searchSubtitles}>
  Find Subtitles
</button>

{#if subtitles.length > 0}
  <div class="subtitle-list">
    {#each subtitles as sub}
      <button on:click={() => selectSubtitle(sub)}>
        {sub.language} - {sub.file_name}
        <span class="score">Score: {sub.score.toFixed(1)}</span>
        {#if sub.hearing_impaired}
          <span class="tag">CC</span>
        {/if}
      </button>
    {/each}
  </div>
{/if}
```

## Performance Considerations

### File Hash Calculation
- **Fast**: Only reads first + last 64KB of file
- **Efficient**: No need to read entire video file
- **Cached**: Calculate once, reuse for multiple searches
- **Network**: Minimal bandwidth (2 hash values)

### Parallel Searches
```rust
// All searches run concurrently
let (os_imdb, os_hash, subdb_hash) = tokio::join!(
    opensubtitles.search_by_imdb(...),
    opensubtitles.search_by_hash(...),
    subdb.search_by_hash(...),
);
```

### Caching Strategy
```typescript
// Cache subtitle results for 24 hours
const cacheKey = `subtitles:${imdbId}:${fileHash}:${languages.join(',')}`;
const cached = await cache.get(cacheKey);

if (cached && !isExpired(cached)) {
  return cached.results;
}

// Fetch fresh results
const results = await autoFetchSubtitles(...);

// Cache for future use
await cache.set(cacheKey, results, { ttl: 86400 });
```

## Troubleshooting

### No Subtitles Found
- **Check IMDB ID**: Verify it's correct (tt + digits)
- **Check File Size**: Must be >64KB for hash calculation
- **Check API Key**: Ensure OpenSubtitles key is valid
- **Check Languages**: Use correct ISO codes (en, es, fr, etc.)
- **Try Different Languages**: Some content may only have specific languages

### API Rate Limits
- **OpenSubtitles**: 200 downloads/day (free tier)
- **Solution**: Implement request caching
- **Solution**: Use SubDB as fallback
- **Upgrade**: Consider OpenSubtitles VIP for higher limits

### Download Failures
- **Network Issues**: Check internet connection
- **API Errors**: Check logs for specific error messages
- **File Access**: Ensure read permissions on video file
- **Corrupted File**: Try different video file

## Dependencies

```toml
[dependencies]
md5 = "0.7"                # MD5 hashing for SubDB
reqwest = "0.11"           # HTTP client
serde = "1.0"              # Serialization
serde_json = "1.0"         # JSON parsing
anyhow = "1.0"             # Error handling
```

## API Endpoints

### OpenSubtitles API v1
- **Base URL**: `https://api.opensubtitles.com/api/v1`
- **Auth**: API-Key header
- **Search by IMDB**: `GET /subtitles?imdb_id={id}&languages={langs}`
- **Search by Hash**: `GET /subtitles?moviehash={hash}&moviebytesize={size}&languages={langs}`
- **Download**: `POST /download` with `file_id`
- **Docs**: https://api.opensubtitles.com/

### SubDB API
- **Base URL**: `http://api.thesubdb.com`
- **Auth**: User-Agent header
- **Search**: `GET /?action=search&hash={hash}&language={langs}`
- **Download**: `GET /?action=download&hash={hash}&language={lang}`
- **Docs**: http://thesubdb.com/api/

## Future Enhancements

- [ ] Subtitle upload/contribution to OpenSubtitles
- [ ] More providers (Addic7ed, Subscene scrapers)
- [ ] Manual offset adjustment persistence
- [ ] Subtitle history/favorites
- [ ] Automatic language detection from filename
- [ ] Fuzzy filename matching
- [ ] Support for ASS/SSA styled subtitles from OpenSubtitles
- [ ] Batch subtitle fetching for series
- [ ] Integration with local subtitle files cache
- [ ] OCR for image-based subtitles (SUB/IDX)

## References

- [OpenSubtitles API Documentation](https://api.opensubtitles.com/)
- [SubDB API Documentation](http://thesubdb.com/api/)
- [OpenSubtitles Hash Algorithm](https://trac.opensubtitles.org/projects/opensubtitles/wiki/HashSourceCodes)
- [SubTitle File Format Specifications](https://en.wikipedia.org/wiki/SubRip)

---

**Status**: Phase 1 (Subtitle Auto-Fetch) — 100% Complete  
**Last Updated**: 2025-10-18
