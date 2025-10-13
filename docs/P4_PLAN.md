# P4: Addon Protocol & Content Aggregation

**Status**: 🚧 In Progress  
**Priority**: P4 - Feature Expansion & Content Sources  
**Timeline**: 2-3 weeks  

---

## Overview

Phase 4 transforms StreamGo from a single-source media app to a powerful content aggregator with a real addon protocol, similar to Stremio. This enables users to add custom content sources while maintaining security and reliability.

---

## Objectives

### Primary Goals
1. **Addon Protocol**: HTTP-based protocol for third-party content sources
2. **Content Aggregation**: Query multiple addons and merge results
3. **Caching Layer**: Performance optimization with TTL-based caching
4. **Advanced Player**: Subtitles, quality selection, external players
5. **Library Features**: Watchlist, favorites, continue watching
6. **Testing**: Comprehensive unit and integration tests

### Success Metrics
- ✅ Addon protocol spec implemented
- ✅ 3+ working example addons
- ✅ <500ms aggregated search results
- ✅ 90%+ test coverage for new code
- ✅ Subtitle support working
- ✅ Continue watching functional

---

## Task Breakdown

### 1. Addon Protocol Implementation (High Priority)

**Goal**: Create a standard HTTP-based protocol for content sources

**Endpoints**:
```
GET /manifest.json
GET /catalog/{type}/{id}.json
GET /stream/{type}/{id}.json
```

**Manifest Schema**:
```json
{
  "id": "addon-id",
  "name": "Addon Name",
  "version": "1.0.0",
  "description": "...",
  "types": ["movie", "series"],
  "catalogs": [{
    "type": "movie",
    "id": "popular",
    "name": "Popular Movies"
  }],
  "resources": ["catalog", "stream"]
}
```

**Implementation**:
- Create `src-tauri/src/addon_protocol.rs`
- Define manifest, catalog, stream types
- HTTP client with timeout handling
- Validation and security checks

**Effort**: 4-6 hours

---

### 2. Content Aggregation (High Priority)

**Goal**: Query multiple addons and merge results intelligently

**Features**:
- Parallel addon queries with tokio
- Result deduplication by ID
- Health scoring (response time, success rate)
- Priority-based ordering
- Timeout handling (3s per addon)

**Implementation**:
- Create `src-tauri/src/aggregator.rs`
- Addon query orchestration
- Result merging logic
- Health tracking

**Effort**: 4-5 hours

---

### 3. Caching Layer (Medium Priority)

**Goal**: Cache metadata and addon responses for performance

**Cache Types**:
- TMDB metadata (7 day TTL)
- Addon catalog responses (1 hour TTL)
- Addon stream URLs (5 minute TTL)
- Poster/backdrop images (30 day TTL)

**Implementation**:
- Add cache tables to SQLite schema
- TTL-based expiration
- Cache invalidation on addon disable
- Cache statistics endpoint

**Effort**: 3-4 hours

---

### 4. Advanced Player Features (Medium Priority)

**Subtitles**:
- WebVTT subtitle track loading
- Subtitle file selection UI
- Style customization (size, position)
- Multiple language support

**Quality Selection**:
- Quality levels from stream metadata
- UI dropdown for quality switching
- Auto quality based on connection
- Remember user preference

**External Players**:
- VLC integration (open m3u8 URL)
- mpv integration
- Platform-specific command building
- Fallback to built-in player

**Implementation**:
- Update `src/player.ts`
- Add subtitle controls to UI
- Create external player launcher
- Quality selection dropdown

**Effort**: 5-6 hours

---

### 5. Watchlist & Favorites (Medium Priority)

**Features**:
- Add/remove from watchlist
- Add/remove from favorites
- Continue watching section
- Watch progress tracking (% complete)
- Resume playback from last position
- Sort by recently watched

**Database**:
```sql
-- Already exists: library_items table with list_type
-- Add watch_progress table
CREATE TABLE watch_progress (
  media_id TEXT PRIMARY KEY,
  progress_seconds INTEGER,
  duration_seconds INTEGER,
  last_watched TEXT,
  completed BOOLEAN
);
```

**Implementation**:
- Add Tauri commands for watchlist/favorites
- Add watch progress tracking
- Update UI with continue watching section
- Show progress indicators on items

**Effort**: 4-5 hours

---

### 6. Comprehensive Test Suite (High Priority)

**Rust Tests**:
- Database CRUD operations
- Addon protocol parsing
- Aggregation logic
- Cache expiration
- Command handlers

**E2E Tests** (Playwright):
- Search and browse content
- Add to library/watchlist/favorites
- Play video with progress tracking
- Subtitle loading
- Addon management

**Implementation**:
- Create `src-tauri/src/tests/` directory
- Add test fixtures
- Mock addon responses
- Add to CI pipeline
- Target 90%+ coverage

**Effort**: 6-8 hours

---

### 7. Image Optimization (Low Priority)

**Features**:
- Lazy loading with Intersection Observer
- Loading skeletons for grids
- Progressive image loading
- Image caching in browser
- Retry on failed loads

**Implementation**:
- Create `src/image-loader.ts`
- Add skeleton CSS
- Update grid rendering
- Placeholder images

**Effort**: 2-3 hours

---

### 8. Documentation (Ongoing)

**Documents to Create**:
- `ADDON_PROTOCOL.md` - Spec and examples
- `ADDON_DEVELOPMENT.md` - How to create addons
- `TESTING.md` - Testing strategy and guide
- `P4_COMPLETE.md` - Final summary

**Effort**: 2-3 hours

---

## Priority Order

### Week 1: Core Infrastructure
1. **Addon Protocol** (Day 1-2)
2. **Content Aggregation** (Day 2-3)
3. **Caching Layer** (Day 4)
4. **Testing Suite** (Day 5)

### Week 2: Features
5. **Watchlist & Favorites** (Day 1-2)
6. **Advanced Player** (Day 3-4)
7. **Image Optimization** (Day 5)

### Week 3: Polish & Testing
8. **E2E Test Expansion** (Day 1-2)
9. **Documentation** (Day 3)
10. **Bug Fixes & Polish** (Day 4-5)

---

## Example Addons to Create

### 1. Demo Movies Addon
- Static JSON responses
- 10-20 popular movies
- Test stream URLs
- Perfect for testing

### 2. Public Domain Addon
- Archive.org integration
- Legal content only
- Real streaming URLs
- Educational value

### 3. Podcast Addon
- RSS feed parsing
- Audio streams
- Episode management
- Different media type

---

## Technical Decisions

### Addon Protocol
- **HTTP-only** (no custom protocols)
- **JSON responses** (standard REST)
- **Stateless** (no session management)
- **CORS-enabled** (for web addons)

### Security
- URL validation (https:// only)
- Manifest signing (future)
- Rate limiting per addon
- Timeout enforcement
- Sandbox addon execution (future)

### Performance
- Parallel queries with tokio
- Connection pooling
- Response caching
- Background refresh
- Lazy result loading

---

## Success Criteria

### Must Have
- ✅ Addon protocol working end-to-end
- ✅ At least 2 working addons
- ✅ Aggregation from multiple sources
- ✅ Watchlist and favorites functional
- ✅ Basic caching implemented
- ✅ Test coverage >70%

### Should Have
- Subtitle support
- Quality selection
- External player integration
- Continue watching
- Image lazy loading
- >80% test coverage

### Nice to Have
- DASH support
- Advanced subtitle styling
- Casting support
- >90% test coverage

---

## Risk Mitigation

### Addon Reliability
**Risk**: Addons may be slow or unavailable  
**Mitigation**: Timeouts, health scoring, fallbacks

### Content Quality
**Risk**: Poor quality or illegal content  
**Mitigation**: Curated addon catalog, user disclaimer

### Performance
**Risk**: Aggregation too slow  
**Mitigation**: Caching, parallel queries, pagination

### Testing Complexity
**Risk**: Hard to mock addons  
**Mitigation**: Test fixtures, local addon server

---

## Dependencies

### New Rust Crates
```toml
# HTTP addon client (already have reqwest)
tokio = { version = "1.0", features = ["time"] }

# For addon health tracking
serde_json = "1.0" # already have

# For caching with TTL
# (use SQLite, no new deps needed)
```

### Frontend
```json
// Intersection Observer for lazy loading
// (built-in, no package needed)

// Subtitle rendering
// (use native <track> elements)
```

---

## Migration Path

### From Current State
1. Keep existing TMDB search working
2. Add addon layer alongside
3. Gradually shift to addon-first
4. Keep TMDB as fallback

### User Experience
- No breaking changes
- New features opt-in
- Progressive enhancement
- Backwards compatible

---

## Monitoring & Metrics

### Track
- Addon response times
- Aggregation duration
- Cache hit rates
- Failed addon requests
- User addon preferences

### Log
- Addon query timing
- Cache operations
- Aggregation decisions
- Error conditions

---

## Next Steps After P4

### P5: Distribution & Deployment
- Multi-platform builds
- Auto-update testing
- Release automation
- User onboarding

### P6: Advanced Features
- Chromecast support
- Multi-profile support
- Cloud sync
- Advanced search

---

**P4 Status**: Ready to start  
**Estimated Completion**: 2-3 weeks  
**Current Focus**: Addon protocol implementation

