/**
 * Main Entry Point - Hybrid Svelte + Vanilla TS
 * 
 * This file bootstraps both:
 * 1. Svelte components (new, for Settings and future sections)
 * 2. Vanilla TS app (legacy, for sections not yet migrated)
 * 
 * As we migrate more sections to Svelte, we'll gradually phase out the vanilla code.
 */

import App from './App.svelte';



// Mount Svelte app
// It will co-exist with vanilla TS code
const app = new App({
  target: document.getElementById('app') as HTMLElement,
});

// Export for HMR (Hot Module Replacement)
export default app;
