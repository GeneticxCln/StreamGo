# 🚀 Svelte Migration - Quick Start Guide

**Status**: ✅ Infrastructure ready, ready to build components

---

## ✅ What's Done

1. **Dependencies installed**
   ```bash
   ✅ svelte
   ✅ @sveltejs/vite-plugin-svelte  
   ✅ svelte-check
   ```

2. **Configuration updated**
   ```
   ✅ vite.config.ts - Svelte plugin added
   ✅ svelte.config.js - Created with TypeScript support
   ✅ tsconfig.json - Updated for .svelte files
   ```

3. **Directory structure created**
   ```
   src/
   ├── components/    🆕 Svelte components
   ├── stores/        🆕 State management
   ├── lib/           🆕 Utilities
   └── legacy/        🆕 Old vanilla TS (temporary)
   ```

---

## 📋 Next Steps

### Step 1: Test that Svelte works

```bash
# Run dev server
npm run dev

# In another terminal
npm run tauri:dev
```

**Expected**: App should still work (using vanilla TS for now)

### Step 2: Create your first Svelte component

See `src/components/settings/SettingsSection.svelte` (will be created next)

### Step 3: Gradually migrate sections

Follow the checklist in `SVELTE_LUA_MIGRATION_PLAN.md`

---

## 🎯 Migration Workflow

### For Each Section:

1. **Create Svelte component**
   ```svelte
   <!-- src/components/library/LibrarySection.svelte -->
   <script lang="ts">
     // Component logic here
   </script>
   
   <!-- Template here -->
   
   <style>
     /* Scoped styles here */
   </style>
   ```

2. **Create Svelte store** (if needed)
   ```typescript
   // src/stores/library.ts
   import { writable } from 'svelte/store';
   
   export const libraryStore = writable({
     items: [],
     loading: false
   });
   ```

3. **Test the component**
   ```bash
   npm run test:e2e
   ```

4. **Remove old vanilla TS code**
   ```bash
   # Move to legacy folder
   mv src/some-old-file.ts src/legacy/
   ```

---

## 📚 Svelte Basics (Cheat Sheet)

### Reactivity
```svelte
<script lang="ts">
  let count = 0;  // Reactive variable
  
  // Reactive statement (runs when count changes)
  $: doubled = count * 2;
  
  function increment() {
    count += 1;  // Triggers re-render
  }
</script>

<button on:click={increment}>
  Count: {count}, Doubled: {doubled}
</button>
```

### Conditionals
```svelte
{#if loading}
  <p>Loading...</p>
{:else if error}
  <p>Error: {error}</p>
{:else}
  <p>Data loaded!</p>
{/if}
```

### Loops
```svelte
{#each items as item (item.id)}
  <div>{item.name}</div>
{:else}
  <p>No items</p>
{/each}
```

### Await Promises
```svelte
{#await promise}
  <p>Loading...</p>
{:then data}
  <p>Got {data}</p>
{:catch error}
  <p>Error: {error.message}</p>
{/await}
```

### Stores
```svelte
<script lang="ts">
  import { libraryStore } from '../stores/library';
  
  // $ prefix auto-subscribes
  console.log($libraryStore.items);
</script>
```

### Lifecycle
```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  
  onMount(() => {
    console.log('Component mounted');
    return () => {
      console.log('Cleanup');
    };
  });
  
  onDestroy(() => {
    console.log('Component destroyed');
  });
</script>
```

---

## 🎨 Styling Patterns

### Scoped Styles (Recommended)
```svelte
<div class="card">Content</div>

<style>
  .card {
    /* Only applies to this component */
    background: #1e2139;
    border-radius: 12px;
  }
</style>
```

### Global Styles
```svelte
<style global>
  /* Applies globally */
  body {
    font-family: 'Poppins', sans-serif;
  }
</style>
```

### Using Existing CSS Classes
```svelte
<!-- Reuse existing StreamGo styles -->
<div class="meta-item-container poster-shape-poster">
  <!-- Content -->
</div>
```

---

## 🧪 Testing

### E2E Tests (Playwright)
```typescript
// tests/e2e/library-svelte.spec.ts
import { test, expect } from '@playwright/test';

test('library section works in Svelte', async ({ page }) => {
  await page.goto('/');
  
  // Wait for Svelte component
  await page.waitForSelector('[data-testid="library-section"]');
  
  const items = page.locator('.meta-item-container');
  await expect(items.first()).toBeVisible();
});
```

---

## 🚨 Common Issues & Solutions

### Issue: "Cannot find module 'svelte'"
**Solution**: Run `npm install`

### Issue: "Unexpected token" in .svelte files
**Solution**: Make sure `svelte.config.js` exists and Vite plugin is configured

### Issue: TypeScript errors in .svelte files
**Solution**: Run `npm run type-check` or use Svelte extension in your editor

### Issue: Styles not working
**Solution**: Make sure you're using `<style>` tags in the component, or importing global CSS

---

## 📖 Resources

- **Svelte Tutorial**: https://svelte.dev/tutorial
- **Svelte Docs**: https://svelte.dev/docs
- **Svelte REPL** (playground): https://svelte.dev/repl
- **Svelte + TypeScript**: https://svelte.dev/docs/typescript
- **This Project's Plan**: `SVELTE_LUA_MIGRATION_PLAN.md`

---

## 💡 Tips

1. **Start small** - Migrate simplest section first (Settings)
2. **Keep it working** - Don't break existing features
3. **Test frequently** - Run E2E tests after each migration
4. **Use stores** - For shared state between components
5. **Reuse CSS** - Keep existing `styles.css`, add new styles scoped in components

---

**Ready to start?** See `SVELTE_LUA_MIGRATION_PLAN.md` for the full roadmap!

**Need help?** Check Svelte docs or ask in the repo discussions.
