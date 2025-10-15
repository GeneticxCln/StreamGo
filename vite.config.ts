import { defineConfig } from 'vite';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
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
    // Manual chunk splitting for better caching and smaller initial bundles
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for heavy dependencies
          'vendor-hls': ['hls.js'],
          // Tauri API as separate chunk
          'vendor-tauri': ['@tauri-apps/api'],
        },
      },
    },
    // Increase chunk size warning limit (we're splitting intentionally)
    chunkSizeWarningLimit: 600,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
