# Bundle Optimization Guide

This document describes the bundle optimization strategies implemented in StreamGo to minimize initial load time and improve overall performance.

## Overview

StreamGo uses several advanced optimization techniques to ensure fast startup times while maintaining full functionality:

### 1. **Lazy Loading of Heavy Dependencies** ⚡

All large media player libraries are loaded dynamically only when needed:

#### HLS.js (523 KB → lazy loaded)
```typescript
// player.ts - Only loaded when HLS stream is detected
if (!this.hlsModule) {
  const hlsImport = await import('hls.js');
  this.hlsModule = hlsImport.default;
}
```

#### Dash.js (846 KB → lazy loaded)
```typescript
// dash-player.ts - Only loaded when DASH stream is detected
if (!dashJs) {
  dashJs = await import('dashjs');
}
```

#### WebTorrent (218 KB → lazy loaded)
```typescript
// torrent-player.ts - Only loaded when magnet/torrent link is detected
await this.ensureWebTorrent();
```

### 2. **Smart Code Splitting** 📦

Vite configuration uses intelligent chunk splitting:

```typescript
manualChunks(id) {
  if (id.includes('node_modules')) {
    // Separate chunks for each major library
    if (id.includes('@tauri-apps')) return 'vendor-tauri';
    if (id.includes('hls.js')) return 'vendor-hls';
    if (id.includes('dashjs')) return 'vendor-dash';
    if (id.includes('webtorrent')) return 'vendor-webtorrent';
    if (id.includes('svelte')) return 'vendor-svelte';
    return 'vendor'; // Other dependencies
  }
  
  // Logical grouping of source code
  if (id.includes('/src/player.ts')) return 'players';
  if (id.includes('/src/addon-')) return 'addons';
  if (id.includes('/src/diagnostics')) return 'diagnostics';
}
```

### 3. **Stream Format Detection** 🎯

The player intelligently detects stream formats and loads only the necessary library:

```typescript
const format = detectStreamFormat(url);
switch (format) {
  case 'torrent': // Load WebTorrent
  case 'dash':    // Load dash.js
  case 'hls':     // Load hls.js (or use native)
  case 'direct':  // No extra library needed
}
```

### 4. **Build Optimizations** ⚙️

#### Tree-Shaking
- `modulePreload.polyfill = false` - No polyfills needed in Tauri
- CommonJS transformation for mixed ESM/CJS modules
- Dead code elimination

#### Minification
- esbuild minification (fast and effective)
- Gzip compression in production

#### Target Browsers
- Chrome 105+ on Windows (Chromium-based Tauri)
- Safari 13+ on macOS/Linux (WebKit-based Tauri)
- No need for old browser polyfills

### 5. **Chunk Size Analysis** 📊

Current bundle breakdown (production build):

| Chunk | Size (uncompressed) | Size (gzipped) | Load Strategy |
|-------|---------------------|----------------|---------------|
| `index.js` | ~220 KB | ~60 KB | Initial load |
| `vendor-tauri` | ~2 KB | ~1 KB | Initial load |
| `vendor.js` | Small | Small | Initial load |
| `vendor-hls` | 523 KB | 163 KB | **Lazy loaded** |
| `vendor-dash` | 846 KB | 250 KB | **Lazy loaded** |
| `vendor-webtorrent` | 218 KB | N/A | **Lazy loaded** |

**Initial bundle size: ~282 KB (gzipped: ~61 KB)**

### 6. **Performance Best Practices** 🚀

#### Native Support First
```typescript
// Check for native HLS support (Safari) before loading hls.js
if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
  this.video.src = url;
  return; // No library needed!
}
```

#### Efficient Format Detection
```typescript
// Fast regex-based detection before loading any libraries
export function detectStreamFormat(url: string): StreamFormat {
  if (url.includes('.m3u8')) return 'hls';
  if (url.includes('.mpd')) return 'dash';
  if (url.startsWith('magnet:')) return 'torrent';
  return 'direct';
}
```

#### Minimal Dependencies
- Svelte (small, fast UI framework)
- Tauri API (native calls, minimal overhead)
- Only essential libraries loaded upfront

### 7. **Future Optimizations** 🔮

Potential improvements for even smaller bundles:

1. **Route-based code splitting** - Split UI sections
2. **Preload hints** - Predictive loading based on user behavior
3. **Service Worker caching** - Cache chunks after first load
4. **Dynamic imports for UI sections** - Load settings/addons on demand
5. **Inline critical CSS** - Faster initial render

### 8. **Monitoring Bundle Size** 📈

#### Build Command
```bash
npm run build
```

#### Analyze Bundle
The build output shows chunk sizes and warns if any chunk exceeds the threshold (800 KB).

#### Recommended Actions
- ✅ Keep initial bundle < 100 KB (gzipped)
- ✅ Lazy load all media players
- ✅ Split vendor libraries by usage pattern
- ✅ Monitor build output for new dependencies

### 9. **Developer Guidelines** 💡

When adding new features:

1. **Check bundle impact** - Run `npm run build` and review sizes
2. **Lazy load when possible** - Use dynamic imports for large deps
3. **Avoid duplicate dependencies** - Check package.json for conflicts
4. **Use tree-shakeable imports** - `import { specific } from 'lib'`
5. **Test with slow connections** - Ensure acceptable load times

### 10. **Performance Metrics** ⏱️

Target metrics for optimal user experience:

- **Time to Interactive (TTI)**: < 2 seconds
- **First Contentful Paint (FCP)**: < 1 second
- **Largest Contentful Paint (LCP)**: < 2.5 seconds
- **Total Blocking Time (TBT)**: < 300ms

With current optimizations, StreamGo achieves these targets on modern hardware.

## Conclusion

StreamGo's bundle optimization strategy ensures:
- ✅ Fast initial load (< 300 KB initial bundle)
- ✅ On-demand loading of heavy media players
- ✅ Efficient code splitting
- ✅ Minimal redundancy
- ✅ Future-proof architecture

The app remains responsive and fast while supporting multiple streaming protocols and formats.
