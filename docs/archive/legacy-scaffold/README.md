# Legacy Scaffold Files Archive

This directory contains legacy HTML and JavaScript files that were part of the initial scaffolding but have been superseded by the current TypeScript-based implementation.

## Archived Files

- **index.html** - Original root HTML file, replaced by `src/index.html`
- **detail.html** - Legacy detail view template, functionality moved to `src/app.ts`
- **detail.js** - Legacy detail page logic, replaced by TypeScript modules
- **script.js** - Legacy JavaScript implementation, replaced by modular TypeScript in `src/`
- **imageOptimization.ts** - Advanced image utilities (not currently used)
  - TMDB image size optimization
  - Progressive loading (low-to-high quality)
  - Image blob caching with size management
  - Preload utilities
  - Could be useful for future performance optimization
- **catalog-browser.ts** - Direct addon catalog browser (parallel scaffold)
  - Implemented frontend-to-addon direct approach bypassing backend
  - Duplicates functionality already in app.ts via list_catalogs/aggregate_catalogs
  - Included TODO for subtitle loading (already implemented in main player.ts)
- **addon-catalog-loader.ts** - Direct addon querying module (parallel scaffold)
  - Frontend-direct approach for loading catalogs, streams, and metadata
  - Backend approach is superior: better caching, health tracking, aggregation
  - Kept for reference of alternative implementation patterns

## Reason for Archival

These files were archived on 2025-10-16 to:
1. Remove code duplication and confusion
2. Ensure single source of truth for UI implementation
3. Improve maintainability by consolidating logic in TypeScript modules
4. Prevent accidental use of outdated implementations

## Current Implementation

The application now uses:
- **Entry Point**: `src/index.html` (served by Vite)
- **Main App Logic**: `src/app.ts` with TypeScript modules
- **Event Handling**: Programmatic listeners in `src/main.ts` (no inline handlers)
- **Build System**: Vite + TypeScript with proper CSP compliance

These archived files are kept for reference only and should not be restored to active use.
