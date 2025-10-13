# Phase 1.1: Vite + TypeScript Migration Guide

## Status: Infrastructure Complete, Migration In Progress

### ✅ Completed

1. **Vite Configuration** (`vite.config.ts`)
   - Configured for Tauri with port 1420
   - Source maps for debugging
   - Path aliases (@/)
   - Hot Module Replacement (HMR)

2. **TypeScript Configuration** (`tsconfig.json`)
   - Strict mode enabled
   - ES2020 target
   - DOM type definitions
   - Path mapping for imports

3. **Type Definitions** (`src/types/tauri.d.ts`)
   - Complete Tauri command interfaces
   - MediaItem, Addon, UserPreferences types
   - Toast and Modal type definitions
   - Type-safe invoke function

4. **Package.json Updates**
   - Added Vite, TypeScript, @types/node
   - New scripts: `dev`, `build`, `preview`, `type-check`
   - Module type set to "module"

5. **Tauri Config Updates**
   - Dev server points to Vite (localhost:1420)
   - `beforeDevCommand`: `npm run dev`
   - `beforeBuildCommand`: `npm run build`

6. **New Files Created**
   - `src/main.ts` - Entry point
   - `src/utils.ts` - Utility functions
   - `src/tauri-init.ts` - Tauri initialization
   - `src/types/tauri.d.ts` - Type definitions

7. **HTML Updates**
   - Uses `<script type="module" src="/main.ts">`
   - Removed separate script tags (now bundled)

### 🚧 Next Steps

#### 1. Install Dependencies

```bash
cd /home/quinton/StreamGo
npm install
```

This will install:
- vite@^5.0.11
- typescript@^5.3.3
- @types/node@^20.11.0
- eslint@^8.56.0

#### 2. Convert script.js to app.ts

The main `script.js` file (30KB) needs to be refactored into TypeScript modules:

**Suggested Structure:**
```
src/
├── app.ts              # Main StreamGoApp class
├── main.ts             # Entry point (✅ created)
├── utils.ts            # Utilities (✅ created)
├── ui-utils.ts         # Toast/Modal (needs TS conversion)
├── tauri-init.ts       # Tauri init (✅ converted)
├── types/
│   └── tauri.d.ts      # Type definitions (✅ created)
└── modules/
    ├── search.ts       # Search functionality
    ├── library.ts      # Library management
    ├── addons.ts       # Add-on management
    ├── settings.ts     # Settings management
    └── player.ts       # Video player (will be Phase 1.2)
```

#### 3. Convert script.js Content

The `StreamGoApp` class from script.js should be extracted to `app.ts` with proper TypeScript types:

```typescript
import type { MediaItem, Addon, UserPreferences } from './types/tauri';
import { getTauriInvoke, escapeHtml } from './utils';

export class StreamGoApp {
  private currentSection: string = 'home';
  private previousSection: string = 'home';
  private searchResults: MediaItem[] = [];
  private libraryItems: MediaItem[] = [];
  private settings: UserPreferences | null = null;
  private currentMedia: MediaItem | null = null;
  private mediaMap: Record<string, MediaItem> = {};

  constructor() {
    this.init();
  }

  private init(): void {
    console.log('StreamGo initialized');
    this.setupEventListeners();
    this.loadSettings();
    this.loadLibrary();
    this.loadAddons();
  }

  // ... rest of methods with proper types
}
```

#### 4. Update ui-utils.ts

Convert the Toast and Modal code to proper TypeScript:

```typescript
import { escapeHtml } from './utils';

type ToastType = 'info' | 'success' | 'error' | 'warning';

export const Toast = {
  container: null as HTMLElement | null,
  
  init(): void {
    // ... implementation
  },
  
  show(message: string, type: ToastType = 'info', duration = 4000): HTMLElement {
    // ... implementation
  }
  
  // ... rest of methods
};

// Similarly for Modal
```

#### 5. Test the Setup

```bash
# Type check
npm run type-check

# Run dev server
npm run dev

# In another terminal, run Tauri
cd src-tauri
cargo tauri dev
```

### Migration Checklist

- [x] Vite configuration
- [x] TypeScript configuration
- [x] Type definitions for Tauri
- [x] Package.json updates
- [x] Tauri config updates
- [x] Entry point (main.ts)
- [x] Utils module
- [ ] Convert ui-utils.js to ui-utils.ts (in progress)
- [ ] Extract and convert script.js to app.ts
- [ ] Split large functions into modules
- [ ] Add JSDoc comments with types
- [ ] Test all functionality
- [ ] Update ESLint config for TypeScript

### Benefits of This Migration

1. **Type Safety**: Catch errors at compile time
2. **Better IDE Support**: Autocomplete, refactoring, navigation
3. **Modern Dev Experience**: HMR, fast builds with Vite
4. **Better Maintainability**: Explicit interfaces, clear contracts
5. **Future-Proof**: Ready for Phase 1.2+ features

### Notes

- The old `build.js` and `clean.js` are no longer needed (Vite handles this)
- Source maps are enabled for debugging
- Vite dev server is much faster than python SimpleHTTPServer
- TypeScript compilation happens before Vite build
- All existing functionality will be preserved

### Breaking Changes

None! The migration is backward compatible. Once complete, the app will work exactly the same but with:
- Faster development experience
- Type checking
- Better error messages
- Modern tooling

### Next Phase

After completing Phase 1.1, we'll move to Phase 1.2: HLS Player Support with quality selection and subtitle tracks.
