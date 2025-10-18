# UI Performance Optimizations

This document describes the Svelte-based UI optimizations implemented in StreamGo to improve performance with large catalogs and video playback.

## Overview

The following optimizations have been implemented:

1. **Virtual Scrolling** - Efficiently render large lists by only displaying visible items
2. **Component-Based Player UI** - Move heavy DOM manipulation to reactive Svelte components
3. **Batched DOM Updates** - Minimize reflows by batching DOM operations
4. **Worker Thread Video Decoding** - HLS.js already uses workers for efficient streaming

## Components

### Virtual List/Grid Components

#### `VirtualList.svelte`
Generic virtual scrolling component for list layouts.

```svelte
<VirtualList 
  items={myItems}
  itemHeight={250}
  overscan={3}
  let:item
>
  <MyItemComponent {item} />
</VirtualList>
```

**Props:**
- `items` - Array of items to render
- `itemHeight` - Height of each item in pixels
- `overscan` - Number of extra items to render above/below viewport

#### `VirtualGrid.svelte`
Virtual scrolling for grid layouts with automatic column calculation.

```svelte
<VirtualGrid 
  items={myItems}
  itemHeight={400}
  itemWidth={200}
  gap={16}
  minColumns={2}
  let:item
>
  <MediaCard {item} />
</VirtualGrid>
```

**Props:**
- `items` - Array of items to render
- `itemHeight` - Height of each item in pixels
- `itemWidth` - Preferred width of each item
- `gap` - Space between items
- `minColumns` - Minimum number of columns

**Performance:**
- Only renders visible rows (~10-20 items at a time)
- Automatically switches to virtual scrolling when library > 50 items
- Reduces DOM nodes from thousands to dozens
- Uses `will-change: transform` for GPU acceleration

### Player Components

#### `QualitySelector.svelte`
Manages video quality selection with reactive UI updates.

```svelte
<QualitySelector 
  {qualities}
  {currentQuality}
  onChange={handleQualityChange}
/>
```

#### `SubtitleControls.svelte`
Manages subtitle track selection and synchronization.

```svelte
<SubtitleControls 
  {tracks}
  {currentTrack}
  {subtitleOffset}
  onTrackChange={handleTrackChange}
  onOffsetChange={handleOffsetChange}
  onLoadSubtitle={handleLoadSubtitle}
/>
```

#### `PlayerStats.svelte`
Displays streaming statistics overlay.

```svelte
<PlayerStats 
  {visible}
  {stats}
/>
```

**Features:**
- Minimal DOM manipulation
- Reactive updates only when values change
- Color-coded health indicators
- No manual DOM queries

## Stores

### `playerStore`
Centralized reactive state management for player.

```typescript
import { playerStore } from './stores/player';

// Update player state
playerStore.setPlaying(true);
playerStore.setTime(currentTime);
playerStore.setQualities(qualities);

// Subscribe to changes
const unsubscribe = playerStore.subscribe($state => {
  console.log('Player state:', $state);
});
```

**Benefits:**
- Single source of truth
- Automatic UI updates via reactivity
- Reduces coupling between components
- Easier debugging and testing

## Utilities

### `batchUpdates.ts`
Functions for optimizing DOM operations.

#### `scheduleUpdate(callback)`
Batch DOM updates into animation frames.

```typescript
import { scheduleUpdate } from './utils/batchUpdates';

// Instead of:
element.style.width = '100px';
element.style.height = '100px';

// Use:
scheduleUpdate(() => {
  element.style.width = '100px';
  element.style.height = '100px';
});
```

#### `debounce(func, wait)`
Debounce expensive operations.

```typescript
const handleResize = debounce(() => {
  updateLayout();
}, 250);

window.addEventListener('resize', handleResize);
```

#### `throttle(func, limit)`
Throttle high-frequency events.

```typescript
const handleScroll = throttle(() => {
  updateVisibleItems();
}, 16); // ~60fps

element.addEventListener('scroll', handleScroll);
```

#### `createFrameScheduler()`
Spread expensive tasks across multiple frames.

```typescript
const scheduler = createFrameScheduler();

largeArray.forEach(item => {
  scheduler.schedule(() => {
    processItem(item);
  });
});
```

## Performance Guidelines

### For Large Lists/Catalogs

1. **Use Virtual Scrolling** for lists > 50 items
2. **Lazy load images** with `loading="lazy"` attribute
3. **Use `key` blocks** in `#each` loops for efficient diffing
4. **Debounce search/filter** operations

```svelte
{#each items as item (item.id)}
  <MediaCard {item} />
{/each}
```

### For Player UI

1. **Batch DOM updates** with `scheduleUpdate()`
2. **Throttle timeupdate events** to ~4 updates/second
3. **Use CSS transforms** instead of position changes
4. **Minimize inline styles** - use class toggles

```svelte
<!-- Good: CSS class toggle -->
<div class:buffering={isBuffering}></div>

<!-- Avoid: Inline style updates -->
<div style="opacity: {isBuffering ? 1 : 0}"></div>
```

### For Video Decoding

1. **HLS.js uses workers** by default - keep `enableWorker: true`
2. **Use MSE when available** for native browser decoding
3. **Set appropriate buffer sizes** based on network

```typescript
const hls = new Hls({
  enableWorker: true,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
});
```

## Migration from Vanilla JS

To migrate existing player UI to Svelte:

1. **Extract state** into `playerStore`
2. **Create Svelte component** for UI section
3. **Update player.ts** to use store instead of DOM manipulation
4. **Test thoroughly** before removing old code

Example:

```typescript
// Old: Direct DOM manipulation
document.getElementById('quality-selector').innerHTML = '...';

// New: Update store
playerStore.setQualities(qualities);
```

## Performance Metrics

Expected improvements:

- **Initial render**: 30-50% faster with virtual scrolling
- **Scroll performance**: 60fps maintained with 1000+ items
- **Memory usage**: 60-70% reduction in DOM nodes
- **Player UI updates**: 2-3x faster with reactive components

## Testing

Run performance tests:

```bash
npm run test:e2e -- performance.spec.ts
```

Profile with DevTools:
1. Open Chrome DevTools
2. Performance tab
3. Record while scrolling/playing video
4. Look for frame drops and long tasks

## Future Optimizations

Potential improvements:

1. **Web Workers** for subtitle parsing
2. **IndexedDB** for caching large catalogs
3. **Service Worker** for offline support
4. **Intersection Observer** for lazy loading
5. **CSS containment** for layout optimization

## Resources

- [Svelte Virtual Lists](https://svelte.dev/examples/virtual-list)
- [HLS.js Configuration](https://github.com/video-dev/hls.js/blob/master/docs/API.md)
- [Web Performance APIs](https://developer.mozilla.org/en-US/docs/Web/API/Performance)
- [RAIL Performance Model](https://web.dev/rail/)
