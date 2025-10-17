# Auto-Disable Unhealthy Addons

## Overview
StreamGo now includes automatic health monitoring and management for addons. The system tracks addon performance and can automatically disable poorly performing addons to ensure optimal streaming experience.

## Feature Implementation (2025-10-16)

### Backend Command
**New Tauri Command**: `auto_disable_unhealthy_addons`

**Location**: `src-tauri/src/lib.rs`

**Functionality**:
- Accepts a health score threshold (0-100)
- Queries all addon health summaries from database
- Identifies enabled addons below the threshold
- Automatically disables unhealthy addons
- Returns list of disabled addon IDs
- Logs all actions with structured tracing

**Example Usage** (from frontend):
```typescript
const threshold = 30; // Disable addons with health score below 30/100
const disabledAddons = await invoke('auto_disable_unhealthy_addons', { threshold });
console.log('Disabled:', disabledAddons); // ['com.example.unreliable-addon']
```

### Health Score Calculation
Health scores are calculated based on:
- **Success Rate** (70% weight): Percentage of successful requests
- **Response Time** (20% weight): Average response time vs. baseline
- **Uptime** (10% weight): Time since last error

Score Range:
- **80-100**: Excellent - Fast and reliable
- **50-79**: Good - Acceptable performance
- **30-49**: Poor - Degraded performance
- **0-29**: Critical - Frequent failures

### UI Implementation
**Location**: `src/diagnostics.ts`

**Features**:
1. **Health Score Display**
   - Visual progress bars color-coded by health
   - Real-time metrics for each addon
   - Last error messages for failed addons

2. **Auto-Disable Controls**
   - Configurable threshold input (0-100)
   - Default threshold: 30
   - One-click auto-disable button
   - Success/failure notifications

3. **Health Warnings**
   - Automatic detection of unhealthy addons
   - Warning banner showing count of poor performers
   - Immediate visual feedback

**UI Components**:
```html
<div class="threshold-control">
  <label>Auto-disable threshold:</label>
  <input type="number" id="health-threshold" value="30" min="0" max="100" step="5">
  <span>/ 100</span>
</div>
<button id="auto-disable-btn">⚡ Auto-Disable Unhealthy</button>
```

## Usage Guide

### Manual Auto-Disable
1. Navigate to **Diagnostics** section
2. View addon health scores
3. Adjust threshold slider (default: 30)
4. Click **"⚡ Auto-Disable Unhealthy"** button
5. Review notification showing disabled addons
6. Addons list automatically refreshes

### Recommended Thresholds

| Threshold | Use Case |
|-----------|----------|
| 20 | Aggressive - Only critical failures |
| 30 | Recommended - Poor performers |
| 50 | Conservative - Anything below "Good" |
| 70 | Strict - Only excellent addons |

### Re-enabling Addons
If an addon was incorrectly disabled:
1. Go to **Addons** section
2. Find the disabled addon
3. Click **Enable** button
4. Addon will resume normal operation

## Technical Details

### Database Schema
Health data is stored in `addon_health` table:
```sql
CREATE TABLE addon_health (
    id INTEGER PRIMARY KEY,
    addon_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    response_time_ms INTEGER,
    success BOOLEAN NOT NULL,
    error_message TEXT
);
```

### Health Summary Calculation
The system maintains rolling health summaries:
- Last 100 requests per addon
- Cleanup of records older than 7 days
- Automatic health score recalculation

### Logging
All auto-disable actions are logged with:
```rust
tracing::info!(
    addon_id = %addon.id,
    health_score = %health.health_score,
    threshold = %threshold,
    "Auto-disabling unhealthy addon"
);
```

## Benefits

### Performance
- Faster stream loading by avoiding slow addons
- Reduced timeout errors
- Better user experience

### Reliability
- Automatic recovery from addon failures
- Prevents cascade failures
- Maintains system stability

### User Control
- Configurable thresholds
- Manual override capability
- Full transparency of actions

## Future Enhancements

Potential improvements identified:
1. **Automatic Re-enable**: Retry disabled addons after cooldown period
2. **Scheduled Health Checks**: Background monitoring without user action
3. **Email/Notifications**: Alert users when addons are disabled
4. **Health History**: Track performance trends over time
5. **Smart Thresholds**: AI-based threshold recommendations

## Related Files

- **Backend**: `src-tauri/src/lib.rs` (lines 1200-1252)
- **Frontend**: `src/diagnostics.ts` (auto-disable UI)
- **Database**: `src-tauri/src/database.rs` (health tracking)
- **Types**: `src/types/tauri.d.ts` (AddonHealthSummary interface)

## Testing

### Manual Testing
1. Install multiple addons
2. Simulate addon failures (network issues, wrong URLs)
3. View health scores in diagnostics
4. Test auto-disable with different thresholds
5. Verify addon list updates correctly

### Automated Testing
```bash
# Backend tests
cd src-tauri
cargo test addon_health

# Frontend tests
npm run type-check
npm run lint
```

All tests pass ✅

## Troubleshooting

**Issue**: Addon disabled unexpectedly
- **Solution**: Check health score in diagnostics, review last error message

**Issue**: Auto-disable doesn't work
- **Solution**: Ensure addons have health data (use them first), check console for errors

**Issue**: Threshold changes have no effect
- **Solution**: Click the auto-disable button after changing threshold

---

**Version**: 1.0.0  
**Last Updated**: 2025-10-16  
**Status**: ✅ Production Ready
