import { defineConfig } from 'vite';
import { resolve } from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    nodePolyfills({
      // Enable polyfills for Node.js built-ins
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  // Set the root directory to src where index.html is located
  root: 'src',
  // Prevent vite from obscuring rust errors
  clearScreen: false,
  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
  // Env variables starting with VITE_ are exposed to the client
  envPrefix: ['VITE_'],
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    // don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    // Output to dist folder (relative to project root, not src)
    outDir: '../dist',
    // Clear output directory before build
    emptyOutDir: true,
    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    // Better tree-shaking
    modulePreload: {
      polyfill: false, // Tauri apps don't need this
    },
    // Manual chunk splitting for better caching and smaller initial bundles
    rollupOptions: {
      // Externalize problematic WebTorrent dependencies that have export issues
      // These will be loaded at runtime instead of bundled
      external: ['bittorrent-dht', 'torrent-discovery'],
      output: {
        manualChunks(id) {
          // Vendor chunks - split heavy dependencies
          if (id.includes('node_modules')) {
            // Tauri API - frequently used, keep separate
            if (id.includes('@tauri-apps')) {
              return 'vendor-tauri';
            }
            // HLS.js - lazy loaded, separate chunk
            if (id.includes('hls.js')) {
              return 'vendor-hls';
            }
            // Dash.js - lazy loaded, separate chunk
            if (id.includes('dashjs')) {
              return 'vendor-dash';
            }
            // WebTorrent and dependencies - lazy loaded when needed
            if (id.includes('webtorrent') || 
                id.includes('bittorrent-') || 
                id.includes('torrent-') ||
                id.includes('parse-torrent')) {
              return 'vendor-webtorrent';
            }
            // Svelte - framework code
            if (id.includes('svelte')) {
              return 'vendor-svelte';
            }
            // Networking libraries (used by webtorrent)
            if (id.includes('simple-peer') || 
                id.includes('socket.io') ||
                id.includes('engine.io') ||
                id.includes('ws')) {
              return 'vendor-networking';
            }
            // Crypto and compression libraries
            if (id.includes('crypto-') || 
                id.includes('cipher-') ||
                id.includes('hash-') ||
                id.includes('pako') ||
                id.includes('bencode')) {
              return 'vendor-crypto';
            }
            // Stream and buffer utilities
            if (id.includes('buffer') || 
                id.includes('stream-') ||
                id.includes('readable-stream') ||
                id.includes('process') || 
                id.includes('events')) {
              return 'vendor-core';
            }
            // All other node_modules into common vendor chunk
            return 'vendor';
          }
          
          // Split source files into logical chunks for better code-splitting
          // Player modules (lazy-loaded)
          if (id.includes('/src/player.ts') || 
              id.includes('/src/dash-player.ts') ||
              id.includes('/src/torrent-player.ts')) {
            return 'players';
          }
          
          // Addon system (lazy-loaded)
          if (id.includes('/src/addon-') || 
              id.includes('/src/aggregator')) {
            return 'addons';
          }
          
          // Diagnostics and health monitoring (lazy-loaded)
          if (id.includes('/src/diagnostics') || 
              id.includes('/src/health-api')) {
            return 'diagnostics';
          }
          
          // Component chunks (lazy-loaded via dynamic imports)
          if (id.includes('/src/components/settings/')) {
            return 'settings';
          }
          if (id.includes('/src/components/library/')) {
            return 'library';
          }
          if (id.includes('/src/components/')) {
            return 'components';
          }
        },
      },
    },
    // Increase chunk size warning limit for media player libraries
    // HLS.js and Dash.js are large but necessary for streaming support
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
