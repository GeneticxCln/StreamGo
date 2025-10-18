# Migration Checklist - Svelte UI Optimizations

Follow these steps to gradually integrate the new optimizations.

## ✅ Phase 1: Virtual Scrolling (Already Complete)

- [x] Create `VirtualList.svelte`
- [x] Create `VirtualGrid.svelte`
- [x] Update `LibrarySection.svelte` to use virtual grid
- [x] Test with large libraries (100+ items)

**Test Command:**
```bash
npm run dev
# Navigate to library with 50+ items
# Scroll smoothly - should maintain 60fps
```

## 📋 Phase 2: Player Store Integration

### Step 1: Import Store in player.ts
```typescript
// At top of src/player.ts
import { playerStore } from './stores/player';
```

### Step 2: Update Quality Selector
Replace `setupQualitySelector()` method:

```typescript
private setupQualitySelector(): void {
  if (!this.hls) return;

  const levels = this.hls.levels;
  if (levels.length <= 1) return;

  const qualities = levels.map((level, index) => ({
    label: `${level.height}p`,
    index,
    height: level.height
  }));
  
  playerStore.setQualities(qualities);
}
```

### Step 3: Update Subtitle Selector
Replace `setupSubtitleSelector()` method:

```typescript
private setupSubtitleSelector(): void {
  const tracks = Array.from(this.video.textTracks).map((track, index) => ({
    label: track.label || `Track ${index + 1}`,
    index,
    language: track.language
  }));
  
  playerStore.setSubtitleTracks(tracks);
}
```

### Step 4: Update Stats
Replace `updateStats()` in stats-related methods:

```typescript
private updateStats(): void {
  if (!this.statsVisible) return;
  
  const stats = this.collectStats();
  playerStore.setStats(stats);
}
```

### Step 5: Toggle Stats
Update keyboard shortcut handler:

```typescript
case 'd':
  if (e.ctrlKey && e.shiftKey) {
    e.preventDefault();
    playerStore.toggleStats();
  }
  break;
```

**Test After Each Step:**
```bash
npm run type-check
npm run dev
# Test the updated functionality
```

## 📋 Phase 3: Add Svelte UI Components (Optional)

If you want to render these components in the player:

### Step 1: Create PlayerUI.svelte
```svelte
<script lang="ts">
  import { playerStore } from '../stores/player';
  import QualitySelector from './player/QualitySelector.svelte';
  import SubtitleControls from './player/SubtitleControls.svelte';
  import PlayerStats from './player/PlayerStats.svelte';
  
  function handleQualityChange(index: number) {
    // Call player method
    (window as any).player?.setQuality(index);
  }
  
  function handleSubtitleChange(index: number) {
    (window as any).player?.enableSubtitle(index);
  }
  
  function handleSubtitleOffsetChange(offset: number) {
    (window as any).player?.setSubtitleOffset(offset);
  }
  
  function handleLoadSubtitle() {
    document.getElementById('load-subtitle-btn')?.click();
  }
</script>

{#if $playerStore.qualities.length > 0}
  <div class="player-controls">
    <QualitySelector 
      qualities={$playerStore.qualities}
      currentQuality={$playerStore.currentQuality}
      onChange={handleQualityChange}
    />
  </div>
{/if}

{#if $playerStore.subtitleTracks.length > 0}
  <div class="player-controls">
    <SubtitleControls
      tracks={$playerStore.subtitleTracks}
      currentTrack={$playerStore.currentSubtitle}
      subtitleOffset={$playerStore.subtitleOffset}
      onTrackChange={handleSubtitleChange}
      onOffsetChange={handleSubtitleOffsetChange}
      onLoadSubtitle={handleLoadSubtitle}
    />
  </div>
{/if}

<PlayerStats 
  visible={$playerStore.showStats}
  stats={$playerStore.stats}
/>
```

### Step 2: Mount in App.svelte
```svelte
import PlayerUI from './components/player/PlayerUI.svelte';

{#if activeSection === 'player'}
  <PlayerUI />
{/if}
```

### Step 3: Update CSS
Hide old DOM elements when Svelte components are active.

## 📋 Phase 4: Performance Utilities

### Step 1: Replace Direct DOM Updates
Find places in player.ts that update DOM:

```typescript
// OLD
document.getElementById('quality-selector')!.innerHTML = '';

// NEW
import { scheduleUpdate } from './utils/batchUpdates';
scheduleUpdate(() => {
  document.getElementById('quality-selector')!.innerHTML = '';
});
```

### Step 2: Throttle Event Handlers
```typescript
import { throttle } from './utils/batchUpdates';

// Throttle timeupdate events
this.video.addEventListener('timeupdate', throttle(() => {
  this.updateProgress();
}, 250)); // Update 4x per second
```

### Step 3: Debounce Search
In search components:

```typescript
import { debounce } from './utils/batchUpdates';

const handleSearch = debounce((query: string) => {
  performSearch(query);
}, 300);
```

## 🧪 Testing Checklist

After each phase:

- [ ] Run `npm run type-check`
- [ ] Run `npm run lint`
- [ ] Test in dev mode: `npm run dev`
- [ ] Test library scrolling with 100+ items
- [ ] Test video playback with quality changes
- [ ] Test subtitle loading and syncing
- [ ] Test stats overlay (Ctrl+Shift+D)
- [ ] Profile with Chrome DevTools
  - [ ] No frame drops > 16ms
  - [ ] Memory stable
  - [ ] CPU usage reasonable

## 🎯 Performance Benchmarks

Measure before and after:

### Library Scrolling
1. Open DevTools Performance tab
2. Start recording
3. Scroll through full library
4. Stop recording
5. Check:
   - FPS (should be ~60)
   - Scripting time (should be low)
   - Rendering time (should be low)

### Player Updates
1. Start recording
2. Change quality multiple times
3. Toggle subtitles
4. Seek through video
5. Check for jank/stuttering

### Memory Usage
1. Open DevTools Memory tab
2. Take heap snapshot
3. Scroll through library
4. Take another snapshot
5. Compare - should be stable

## 📝 Rollback Plan

If issues occur:

1. **Store-related issues**: Comment out store updates
2. **Virtual scroll issues**: Set `VIRTUAL_THRESHOLD = Infinity`
3. **Component issues**: Remove component imports
4. **Git**: Each phase should be a separate commit

```bash
git log --oneline
git revert <commit-hash>
```

## 🎉 Success Criteria

You'll know it's working when:

- ✅ Smooth 60fps scrolling with 1000+ items
- ✅ No UI freezes during quality changes
- ✅ Memory usage stays constant
- ✅ Player controls feel snappy
- ✅ No console errors
- ✅ All tests pass

## 📚 References

- [UI_OPTIMIZATIONS.md](/home/quinton/StreamGo/docs/UI_OPTIMIZATIONS.md) - Full docs
- [OPTIMIZATIONS_SUMMARY.md](/home/quinton/StreamGo/OPTIMIZATIONS_SUMMARY.md) - Summary
- [Svelte Virtual Lists](https://svelte.dev/examples/virtual-list)
- [HLS.js Config](https://github.com/video-dev/hls.js/blob/master/docs/API.md)
