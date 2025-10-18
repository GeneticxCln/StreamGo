# 🚀 StreamGo 2.0: Svelte + Lua Migration Plan

**Date**: 2025-10-18  
**Status**: IN PROGRESS  
**Target**: Production-ready Svelte frontend + Lua plugin system

---

## 📊 Executive Summary

**Migration Strategy**: Incremental hybrid approach
- ✅ Keep existing vanilla TS app running
- ✅ Build new features in Svelte
- ✅ Gradually migrate sections one-by-one
- ✅ Add Lua plugin system in parallel

**Timeline**: 10-12 weeks total
- **Weeks 1-2**: Svelte infrastructure + first component
- **Weeks 3-6**: Migrate core sections
- **Weeks 7-9**: Lua plugin system
- **Weeks 10-12**: Polish, testing, documentation

---

## 🎯 Why This Stack?

### Svelte + TypeScript
✅ **Component model** - Solves vanilla TS scalability issues  
✅ **True reactivity** - Simpler than React hooks  
✅ **Compiled** - No runtime overhead, smaller bundles  
✅ **Fast** - No virtual DOM, direct DOM updates  
✅ **Small** - 70% smaller bundle than React  

### Lua Plugin System
✅ **User-extensible** - Community can write scrapers  
✅ **Sandboxed** - Secure execution environment  
✅ **Simple** - Easy to write plugins  
✅ **Unique** - Differentiator from Stremio  

---

## 🏗️ Project Structure

```
StreamGo/
├── src/
│   ├── components/          # 🆕 Svelte components
│   │   ├── common/          # Reusable UI components
│   │   │   ├── MediaCard.svelte
│   │   │   ├── Button.svelte
│   │   │   └── Modal.svelte
│   │   ├── library/         # Library-specific components
│   │   │   ├── LibraryGrid.svelte
│   │   │   └── LibraryHeader.svelte
│   │   ├── search/          # Search components
│   │   ├── player/          # Player components
│   │   └── settings/        # Settings components
│   │
│   ├── stores/              # 🆕 Svelte stores (state management)
│   │   ├── app.ts           # Global app state
│   │   ├── library.ts       # Library state
│   │   └── player.ts        # Player state
│   │
│   ├── lib/                 # 🆕 Utilities and helpers
│   │   ├── tauri.ts         # Tauri API wrappers
│   │   ├── format.ts        # Formatting utilities
│   │   └── validation.ts    # Input validation
│   │
│   ├── legacy/              # ⚠️ Old vanilla TS (temporary)
│   │   ├── app.ts
│   │   ├── player.ts
│   │   └── ...
│   │
│   ├── App.svelte           # 🆕 Main Svelte app
│   ├── main.ts              # 🆕 Svelte entry point
│   ├── index.html           # Updated for Svelte
│   └── styles.css           # Keep existing styles
│
├── src-tauri/
│   ├── src/
│   │   ├── plugins/         # 🆕 Lua plugin system
│   │   │   ├── mod.rs       # Plugin manager
│   │   │   ├── runtime.rs   # Lua runtime
│   │   │   ├── sandbox.rs   # Security sandbox
│   │   │   └── api.rs       # Plugin API
│   │   └── ...
│   └── Cargo.toml           # Add mlua dependency
│
├── plugins/                 # 🆕 User plugins directory
│   ├── example_scraper.lua
│   └── quality_filter.lua
│
└── docs/
    ├── SVELTE_COMPONENT_GUIDE.md
    └── LUA_PLUGIN_GUIDE.md
```

---

## 📅 Phase-by-Phase Plan

### ✅ Phase 1: Svelte Infrastructure (Week 1-2)

**Goal**: Get Svelte working alongside existing code

#### Tasks:
- [x] Install Svelte dependencies
- [x] Configure Vite for Svelte
- [x] Update tsconfig.json
- [x] Create svelte.config.js
- [ ] Create basic App.svelte
- [ ] Create routing system
- [ ] Migrate Settings section (simplest, proof-of-concept)
- [ ] Test that both vanilla TS and Svelte work together

#### Success Criteria:
- ✅ `npm run dev` starts successfully
- ✅ Settings section works in Svelte
- ✅ Other sections still work in vanilla TS
- ✅ No regressions in existing features

---

### 🔄 Phase 2: Core Section Migration (Week 3-6)

**Goal**: Migrate main UI sections to Svelte

#### Week 3: Library Section
```svelte
<!-- components/library/LibrarySection.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { libraryStore } from '../../stores/library';
  import MediaCard from '../common/MediaCard.svelte';
  
  onMount(async () => {
    await libraryStore.load();
  });
</script>

{#if $libraryStore.loading}
  <div class="loading-spinner">Loading...</div>
{:else if $libraryStore.items.length === 0}
  <p class="empty-message">Your library is empty</p>
{:else}
  <div class="movie-grid">
    {#each $libraryStore.items as item (item.id)}
      <MediaCard {item} />
    {/each}
  </div>
{/if}
```

#### Week 4: Search Section
#### Week 5: Home Section
#### Week 6: Discover Section

#### Migration Checklist (per section):
- [ ] Create Svelte components
- [ ] Create Svelte store for state
- [ ] Implement data loading
- [ ] Add error handling
- [ ] Update E2E tests
- [ ] Remove old vanilla TS code
- [ ] Test thoroughly

---

### 🎮 Phase 3: Lua Plugin System (Week 7-9)

**Goal**: Enable user-written plugins for scrapers and filters

#### Week 7: Plugin Runtime

**Add Rust dependency**:
```toml
# src-tauri/Cargo.toml
[dependencies]
mlua = { version = "0.9", features = ["lua54", "async", "serialize"] }
```

**Plugin Manager**:
```rust
// src-tauri/src/plugins/mod.rs
use mlua::{Lua, Result, Table};
use std::path::PathBuf;

pub struct PluginManager {
    lua: Lua,
    plugins_dir: PathBuf,
}

impl PluginManager {
    pub fn new(plugins_dir: PathBuf) -> Result<Self> {
        let lua = Lua::new();
        
        // Register safe API
        Self::register_api(&lua)?;
        
        Ok(Self { lua, plugins_dir })
    }
    
    fn register_api(lua: &Lua) -> Result<()> {
        // HTTP API
        let http = lua.create_table()?;
        http.set("get", lua.create_function(http_get)?)?;
        http.set("post", lua.create_function(http_post)?)?;
        lua.globals().set("http", http)?;
        
        // JSON API
        let json = lua.create_table()?;
        json.set("decode", lua.create_function(json_decode)?)?;
        json.set("encode", lua.create_function(json_encode)?)?;
        lua.globals().set("json", json)?;
        
        Ok(())
    }
    
    pub fn load_plugin(&self, name: &str) -> Result<Plugin> {
        let path = self.plugins_dir.join(format!("{}.lua", name));
        self.lua.load_from_file(path)?;
        
        Ok(Plugin {
            name: name.to_string(),
            lua: &self.lua,
        })
    }
}
```

#### Week 8: Plugin API

**Scraper Plugin Example**:
```lua
-- plugins/example_scraper.lua

-- Plugin metadata
plugin = {
    name = "Example Scraper",
    version = "1.0.0",
    author = "StreamGo Community",
    description = "Example scraper plugin"
}

-- Scrape streams for a content item
function scrape_streams(content_id, content_type)
    -- Make HTTP request
    local url = "https://example.com/api/" .. content_type .. "/" .. content_id
    local response = http.get(url)
    
    -- Parse JSON
    local data = json.decode(response.body)
    
    -- Transform to StreamGo format
    local streams = {}
    for _, item in ipairs(data.streams) do
        table.insert(streams, {
            url = item.url,
            quality = item.quality,
            title = item.title,
            source = plugin.name
        })
    end
    
    return streams
end

-- Filter streams based on quality/seeders
function filter_streams(streams, min_quality, min_seeders)
    local filtered = {}
    for _, stream in ipairs(streams) do
        if stream.quality >= min_quality and stream.seeders >= min_seeders then
            table.insert(filtered, stream)
        end
    end
    return filtered
end

-- Register plugin hooks
register_hook("get_streams", scrape_streams)
register_hook("filter_streams", filter_streams)
```

#### Week 9: Security Sandbox

**Sandbox Implementation**:
```rust
// src-tauri/src/plugins/sandbox.rs

impl PluginManager {
    fn create_sandbox() -> Result<Lua> {
        let lua = Lua::new();
        
        // Disable dangerous functions
        let globals = lua.globals();
        globals.set("dofile", mlua::Nil)?;
        globals.set("loadfile", mlua::Nil)?;
        globals.set("require", mlua::Nil)?;
        globals.set("io", mlua::Nil)?;
        globals.set("os", mlua::Nil)?;
        
        // Only allow safe subset
        // - http (rate-limited)
        // - json
        // - string manipulation
        // - table operations
        
        Ok(lua)
    }
}
```

---

### 🎨 Phase 4: Polish & Testing (Week 10-12)

#### Week 10: State Management Polish
- [ ] Optimize Svelte stores
- [ ] Add persistence for user preferences
- [ ] Implement undo/redo where needed

#### Week 11: Testing
- [ ] Update E2E tests for Svelte
- [ ] Add component tests (Svelte Testing Library)
- [ ] Test Lua plugin sandbox
- [ ] Load testing with 100+ plugins

#### Week 12: Documentation
- [ ] Svelte component guide
- [ ] Lua plugin development guide
- [ ] Migration guide for contributors
- [ ] Update README

---

## 🧪 Testing Strategy

### E2E Tests (Playwright)
```typescript
// tests/e2e/library-svelte.spec.ts
test('Svelte library section works', async ({ page }) => {
  await page.goto('/');
  
  // Wait for Svelte to hydrate
  await page.waitForSelector('[data-svelte-component="LibrarySection"]');
  
  // Check for library items
  const items = page.locator('.meta-item-container');
  await expect(items.first()).toBeVisible();
});
```

### Component Tests (Svelte Testing Library)
```typescript
// tests/unit/MediaCard.test.ts
import { render } from '@testing-library/svelte';
import MediaCard from '$lib/components/common/MediaCard.svelte';

test('MediaCard renders correctly', () => {
  const { getByText } = render(MediaCard, {
    props: {
      item: {
        id: 'tt0111161',
        name: 'The Shawshank Redemption',
        poster: 'https://...'
      }
    }
  });
  
  expect(getByText('The Shawshank Redemption')).toBeInTheDocument();
});
```

### Plugin Tests
```rust
// src-tauri/src/plugins/tests.rs
#[tokio::test]
async fn test_plugin_loading() {
    let manager = PluginManager::new("./test_plugins".into()).unwrap();
    let plugin = manager.load_plugin("example_scraper").unwrap();
    
    let streams = plugin.call_function("scrape_streams", ("tt0111161", "movie")).await.unwrap();
    assert!(!streams.is_empty());
}
```

---

## 📊 Success Metrics

### Performance
- [ ] Bundle size < 120 KB (vs vanilla TS ~50 KB, React ~200 KB)
- [ ] Startup time < 1 second
- [ ] Memory usage < 100 MB idle
- [ ] UI frame rate = 60 FPS

### Code Quality
- [ ] 100% TypeScript type coverage
- [ ] 70%+ test coverage (E2E + unit)
- [ ] Zero ESLint warnings
- [ ] Zero Clippy warnings

### Features
- [ ] All vanilla TS features work in Svelte
- [ ] At least 3 example Lua plugins
- [ ] Plugin marketplace UI

---

## 🚨 Risk Mitigation

### Risk 1: Breaking Existing Features
**Mitigation**: Incremental migration, keep vanilla TS working  
**Rollback**: Can revert any section to vanilla TS

### Risk 2: Svelte Learning Curve
**Mitigation**: Start with simple components, use templates  
**Fallback**: Svelte docs are excellent, community active

### Risk 3: Lua Plugin Security
**Mitigation**: Strict sandbox, rate limiting, code review for official plugins  
**Fallback**: Can disable plugin system if security issues arise

### Risk 4: Performance Regression
**Mitigation**: Continuous benchmarking, profile before/after  
**Rollback**: Keep vanilla TS version for performance-critical sections

---

## 📝 Next Steps

### Immediate (This Week):
1. ✅ Setup Svelte infrastructure
2. [ ] Create basic App.svelte
3. [ ] Migrate Settings section to Svelte
4. [ ] Test E2E still passes

### Short-term (Next 2 Weeks):
1. [ ] Migrate Library section
2. [ ] Create reusable components (MediaCard, Button, Modal)
3. [ ] Set up Svelte stores

### Medium-term (Weeks 3-6):
1. [ ] Migrate remaining sections
2. [ ] Remove vanilla TS code
3. [ ] Optimize bundle size

### Long-term (Weeks 7-12):
1. [ ] Implement Lua plugin system
2. [ ] Create plugin marketplace
3. [ ] Documentation and polish

---

## 📚 Resources

### Svelte
- Official Docs: https://svelte.dev/docs
- Tutorial: https://svelte.dev/tutorial
- Examples: https://svelte.dev/examples
- REPL: https://svelte.dev/repl

### Lua Plugins
- mlua docs: https://docs.rs/mlua/
- Lua manual: https://www.lua.org/manual/5.4/
- Plugin patterns: Research game modding (Factorio, etc.)

### Testing
- Svelte Testing Library: https://testing-library.com/docs/svelte-testing-library/intro
- Playwright: https://playwright.dev/

---

**Status**: 🟢 Infrastructure complete, ready for first component migration

**Last Updated**: 2025-10-18
