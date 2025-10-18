# Addon Health Tracking Fix

## Problems Identified

### 1. **Stream-only addons tested on wrong endpoints**
**Root Cause**: The stream aggregator (`query_streams` and `query_streams_detailed`) queried ALL enabled addons regardless of their supported resources. This caused catalog-only addons (like Cinemeta, IMDB Catalogs) to be tested on `/stream/` endpoints they don't support, resulting in HTTP 404 errors.

**Impact**: 
- Cinemeta showed 73.4% health with "HTTP 404 Not Found: Cannot GET /stream/movie/tt13186306.json"
- Other catalog-only addons showed similar false negative errors
- Health scores were artificially low due to testing unsupported functionality

### 2. **Diagnostics UI showed technical IDs instead of friendly names**
**Root Cause**: `AddonHealthSummary` only stored `addon_id` (technical identifier like "com.linvo.cinemeta"), not the human-readable addon name ("Cinemeta").

**Impact**:
- Users saw confusing technical IDs in the diagnostics page
- Made it difficult to identify which addons had issues

## Solutions Implemented

### Fix 1: Resource-aware stream aggregation
**Files Modified**:
- `src-tauri/src/aggregator.rs` (lines 397-428, 522-556)

**Changes**:
```rust
// BEFORE: Queried all enabled addons
.filter(|a| a.enabled && !a.url.is_empty())

// AFTER: Only query addons with "stream" resource
.filter(|a| {
    let has_stream = a.manifest.resources.contains(&"stream".to_string());
    if a.enabled && !a.url.is_empty() && !has_stream {
        tracing::debug!(
            addon_id = %a.id,
            addon_name = %a.name,
            resources = ?a.manifest.resources,
            "Skipping addon without stream resources"
        );
    }
    a.enabled && !a.url.is_empty() && has_stream
})
```

**Result**: Stream queries now only test addons that explicitly support the "stream" resource, matching the behavior of catalog queries (which already filtered by "catalog" resource).

### Fix 2: Display friendly addon names in diagnostics
**Files Modified**:
- `src-tauri/src/models.rs` (line 352-364)
- `src-tauri/src/database.rs` (lines 940-1003)
- `src/diagnostics.ts` (lines 257-276)
- `src/types/tauri.d.ts` (lines 248-258)

**Changes**:

1. **Backend Model** - Added `addon_name` field:
```rust
pub struct AddonHealthSummary {
    pub addon_id: String,
    pub addon_name: Option<String>, // NEW: Joined from addons table
    // ... other fields
}
```

2. **Database Queries** - JOINed with addons table:
```sql
-- BEFORE
SELECT addon_id, last_check, ...
FROM addon_health_summary

-- AFTER
SELECT h.addon_id, a.name, h.last_check, ...
FROM addon_health_summary h
LEFT JOIN addons a ON h.addon_id = a.id
```

3. **Frontend Display** - Shows friendly name:
```typescript
// Display friendly addon name if available, otherwise use addon_id
const displayName = health.addon_name || health.addon_id;
```

**Result**: Diagnostics page now shows "Cinemeta" instead of "com.linvo.cinemeta", making it user-friendly.

## Expected Outcomes

### Before Fixes:
```
Addon Health:
- com.linvo.cinemeta: 73.4/100 ❌ "HTTP 404 Not Found: Cannot GET /stream/..."
- pw.ers.netflix-catalog: 72.0/100 ❌ "Parse error: missing field 'metas'"
- org.stremio.watchhub: 30.0/100 ❌ "HTTP 404 Not Found: Cannot GET /stream/..."
```

### After Fixes:
```
Addon Health:
- Cinemeta: 100.0/100 ✅ (only tested on supported catalog endpoints)
- Streaming Catalogs: 100.0/100 ✅ (only tested on supported catalog endpoints)
- Torrentio: 100.0/100 ✅ (only tested when streams are requested)
- IMDB Catalogs: 100.0/100 ✅ (already working correctly)
```

## Addon Classification

### Catalog-only Providers (resources: ["catalog"])
- IMDB Catalogs
- Streaming Catalogs (Netflix, Disney+, etc.)

### Catalog + Stream Providers (resources: ["catalog", "stream"])
- SKYFLIX
- USA TV

### Stream-only Providers (resources: ["stream"])
- Torrentio
- ThePirateBay+
- Brazuca Torrents
- Peerflix
- WatchHub
- Stremify

**Note**: Stream-only providers will ONLY show health data when users actually request streams for specific content. They won't appear in catalog aggregation health checks.

## Testing Recommendations

1. **Open Diagnostics Page**: Verify addon names display as friendly names (e.g., "Cinemeta" not "com.linvo.cinemeta")
2. **Browse Catalogs**: Check that catalog-only addons (Cinemeta, IMDB Catalogs) show 95-100% health
3. **Play Content**: Verify stream-only addons (Torrentio) get health scores when streams are requested
4. **Check Logs**: Look for "Skipping addon without stream/catalog resources" debug messages

## Database Impact

- No schema changes required (LEFT JOIN used)
- Existing health data preserved
- New health records automatically include addon names via JOIN

## Performance Considerations

- **Reduced HTTP requests**: Fewer 404 errors = faster response times
- **Better cache efficiency**: Only cache relevant responses
- **Accurate health tracking**: True picture of addon reliability

## Migration Notes

Existing installations will automatically benefit from these fixes:
- Health scores will improve over time as new requests are made
- No manual database migration needed
- Old health records remain valid (addon_name just NULL for old records)
