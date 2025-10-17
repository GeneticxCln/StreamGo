# StreamGo Addon & Discovery Analysis

**Date:** 2025-10-17  
**Comparing to:** Stremio's Addon Protocol & Implementation

---

## Executive Summary

StreamGo implements a **Stremio-compatible addon protocol** with solid backend architecture, but the **frontend discovery UI is limited** compared to Stremio. The backend supports all necessary media types and features, but the UI only exposes Movies and Series.

---

## 1. Current Addon Implementation

### Backend (Rust) ✅ **SOLID**

#### Addon Protocol (`addon_protocol.rs`)
- **Fully Stremio-compatible** HTTP-based protocol
- Flexible `AddonMediaType` wrapper (supports any string type)
- Comprehensive manifest validation with security checks
- Retry logic with exponential backoff
- Proper timeout handling (3-5s configurable)
- Support for all Stremio resources:
  - ✅ `catalog` - Browse content
  - ✅ `stream` - Get playable links
  - ✅ `meta` - Detailed metadata
  - ✅ `subtitles` - Subtitle tracks
  - ✅ `addon_catalog` - Addon discovery

#### Content Aggregator (`aggregator.rs`)
- **Parallel querying** of multiple addons
- **Priority-based** addon ordering
- **Deduplication** by ID and URL
- **Health metrics** tracking per addon
- **Cache integration** for performance
- Stream and catalog aggregation

#### Models (`models.rs`)
```rust
pub enum MediaType {
    Movie,      // ✅ Implemented in UI
    TvShow,     // ✅ Implemented in UI (as "series")
    Episode,    // ✅ Backend only
    Documentary,// ❌ Not exposed in UI
    LiveTv,     // ❌ Not exposed in UI
    Podcast,    // ❌ Not exposed in UI
}
```

### Frontend (TypeScript) ⚠️ **LIMITED**

#### Discovery Section (`index.html` lines 191-194)
```html
<select id="discover-type-select">
    <option value="movie">Movies</option>
    <option value="series">Series</option>
</select>
```

**Issues:**
- Hard-coded media types (only 2 of 6 backend types)
- No dynamic loading based on available addons
- No support for `channel`, `tv`, `documentary`, `podcast`

---

## 2. Stremio Implementation Analysis

### Stremio's Supported Content Types

From [Stremio's documentation](https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/content.types.md):

1. **`movie`** - Movie type with metadata
2. **`series`** - Series with episodes
3. **`channel`** - YouTube channels with videos
4. **`tv`** - Live TV with live streams

### Cinemeta Addon (Official)

**Manifest:** `https://v3-cinemeta.strem.io/manifest.json`

**Provides:**
- **Types:** `movie`, `series` only
- **Catalogs:** 
  - Popular (top)
  - New (year-based)
  - Featured (imdbRating)
  - Last videos
  - Calendar videos

**Catalog Extras:**
```json
{
  "extra": [
    { "name": "genre", "options": ["Action", "Comedy", ...] },
    { "name": "search" },
    { "name": "skip" }
  ]
}
```

**Key Features StreamGo is Missing:**
1. ❌ Genre filtering
2. ❌ Year filtering  
3. ❌ Search within catalog
4. ❌ Skip/pagination with proper UI

---

## 3. Gap Analysis

### Media Type Support

| Type | Backend | Frontend | Stremio | Priority |
|------|---------|----------|---------|----------|
| movie | ✅ | ✅ | ✅ | High |
| series | ✅ | ✅ | ✅ | High |
| channel | ❌ | ❌ | ✅ | Medium |
| tv | ❌ | ❌ | ✅ | Medium |
| documentary | ✅ | ❌ | ❌ | Low |
| podcast | ✅ | ❌ | ❌ | Low |

### Catalog Features

| Feature | Backend | Frontend | Stremio | Priority |
|---------|---------|----------|---------|----------|
| Basic browsing | ✅ | ✅ | ✅ | - |
| Genre filter | ✅ | ❌ | ✅ | **HIGH** |
| Year filter | ✅ | ❌ | ✅ | High |
| Search in catalog | ✅ | ❌ | ✅ | **HIGH** |
| Skip/pagination | ✅ | ⚠️ | ✅ | Medium |
| Dynamic type selector | ❌ | ❌ | ✅ | Medium |

⚠️ = Partially implemented (basic load more button)

### Discovery UI vs Stremio

**Stremio has:**
- Dynamic type selector based on installed addons
- Genre dropdown for each catalog
- Search box within catalogs
- Year/release filters
- Multiple sort options (popular, rating, new)

**StreamGo has:**
- Fixed type selector (2 types)
- Basic catalog dropdown
- Simple "Browse" button
- Basic "Load More" pagination

---

## 4. Recommendations

### Priority 1: High-Impact UI Improvements

#### 4.1 Add Missing Media Types
```html
<!-- Update discover-type-select -->
<select id="discover-type-select">
    <option value="movie">Movies</option>
    <option value="series">Series</option>
    <option value="channel">Channels</option>
    <option value="tv">Live TV</option>
</select>
```

#### 4.2 Implement Genre Filtering
```typescript
// Add genre dropdown that populates from catalog.extra
private renderGenreFilter(catalog: Catalog): string {
    const genres = catalog.genres || [];
    return `
        <select id="discover-genre-select">
            <option value="">All Genres</option>
            ${genres.map(g => `<option value="${g}">${g}</option>`).join('')}
        </select>
    `;
}
```

#### 4.3 Add Search Within Catalog
```html
<div class="catalog-search">
    <input 
        type="text" 
        id="catalog-search-input" 
        placeholder="Search in this catalog..."
    />
    <button id="catalog-search-btn">Search</button>
</div>
```

### Priority 2: Dynamic Type Loading

Make type selector dynamic based on available addons:

```typescript
private async loadAvailableTypes(): Promise<string[]> {
    const addons = await invoke<Addon[]>('get_addons');
    const types = new Set<string>();
    
    addons.forEach(addon => {
        if (addon.enabled) {
            addon.manifest.types.forEach(t => types.add(t));
        }
    });
    
    return Array.from(types);
}
```

### Priority 3: Better Catalog Display

#### Show catalog metadata:
```typescript
interface CatalogInfo {
    id: string;
    name: string;
    addon_name: string;
    genres?: string[];
    extra?: ExtraField[];
}
```

#### Render with more context:
```html
<select id="discover-catalog-select">
    <option value="">Select catalog...</option>
    <optgroup label="Cinemeta">
        <option value="cinemeta:top">Popular Movies (Cinemeta)</option>
        <option value="cinemeta:year">New Movies (Cinemeta)</option>
    </optgroup>
</select>
```

### Priority 4: Advanced Filters Panel

Create a collapsible filter panel:

```html
<div class="filters-panel">
    <button id="toggle-filters">Filters</button>
    <div id="filters-content" class="hidden">
        <div class="filter-group">
            <label>Genre</label>
            <select id="filter-genre"></select>
        </div>
        <div class="filter-group">
            <label>Year</label>
            <select id="filter-year"></select>
        </div>
        <div class="filter-group">
            <label>Sort By</label>
            <select id="filter-sort">
                <option value="popular">Popular</option>
                <option value="rating">Top Rated</option>
                <option value="new">Newest</option>
            </select>
        </div>
    </div>
</div>
```

---

## 5. Implementation Plan

### Phase 1: Quick Wins (1-2 hours)
1. ✅ Add `channel` and `tv` to type dropdown
2. ✅ Update `list_catalogs` to handle all types
3. ✅ Test with sample addon that provides channel/tv

### Phase 2: Catalog Extras (2-3 hours)
1. Parse `extra` fields from catalog descriptors
2. Render genre dropdown when catalog has genre extra
3. Implement search input when catalog supports search
4. Pass extra params to `aggregate_catalogs` API

### Phase 3: Dynamic Types (1-2 hours)
1. Load available types from installed addons
2. Generate type dropdown dynamically
3. Handle empty state when no addons installed

### Phase 4: Advanced Features (3-4 hours)
1. Year filtering UI
2. Sort options
3. Filter panel with collapse/expand
4. Better pagination with page numbers
5. Catalog metadata display

---

## 6. Code Changes Required

### Backend: ✅ **No changes needed**
The backend already supports everything through:
- Flexible `AddonMediaType(String)`
- `extra` parameter in `aggregate_catalogs`
- All catalog extra fields parsed correctly

### Frontend: Main Changes

#### `src/index.html`
- Update `discover-type-select` with all types
- Add genre/year filter dropdowns
- Add search input for catalog search

#### `src/app.ts`
- `loadDiscoverCatalogs()` - parse catalog extras
- `renderCatalogFilters()` - new method for genre/year UI
- `loadDiscoverItems()` - pass extra params with genre/search
- `initDiscover()` - populate filters from catalog descriptor
- `loadAvailableTypes()` - new method for dynamic types

#### Estimated LOC: ~200-300 lines

---

## 7. Testing Checklist

### Must Test
- [ ] Movie catalogs still work
- [ ] Series catalogs still work  
- [ ] Genre filtering works with Cinemeta
- [ ] Search within catalog works
- [ ] Year filtering works
- [ ] Multiple addons with same type don't duplicate
- [ ] Empty state when no catalogs available
- [ ] Pagination works with filters applied

### Nice to Test
- [ ] Channel type with YouTube addon
- [ ] TV type with live TV addon
- [ ] Podcast type if addon available
- [ ] Very large catalog (1000+ items)
- [ ] Multiple genres selected
- [ ] Search + genre combined

---

## 8. Stremio Feature Parity

### Currently Implemented ✅
- ✅ Addon installation from URL
- ✅ Multiple addon support
- ✅ Catalog aggregation
- ✅ Stream aggregation
- ✅ Subtitle support
- ✅ Addon health monitoring
- ✅ Priority-based addon ordering
- ✅ Caching

### Missing Features ⚠️
- ⚠️ Channel type support (backend ready, UI missing)
- ⚠️ Live TV type support (backend ready, UI missing)
- ⚠️ Genre filtering (backend ready, UI missing)
- ⚠️ Search within catalog (backend ready, UI missing)
- ⚠️ Year filtering (backend ready, UI missing)

### Not Planned ❌
- ❌ Addon catalogs (discover new addons from other addons)
- ❌ Configurable addons (addons with user settings)
- ❌ P2P/torrent streaming indicators
- ❌ Episode tracking for series
- ❌ Calendar/release notifications

---

## 9. Conclusion

**Verdict:** StreamGo has **excellent addon infrastructure** but a **basic discovery UI**.

**Strengths:**
- Robust backend with proper error handling
- Stremio protocol compatibility
- Health monitoring and caching
- Clean separation of concerns

**Weaknesses:**
- Limited media type exposure
- No catalog filtering UI
- Hard-coded type selector
- Missing genre/search features

**Priority Actions:**
1. Add `channel` and `tv` types to UI dropdown
2. Implement genre filtering
3. Add search within catalog
4. Make type selector dynamic

**Estimated Effort:** 6-10 hours for full Stremio feature parity in discovery section.
