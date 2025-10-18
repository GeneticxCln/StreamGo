import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
  // for more information about preprocessors
  preprocess: vitePreprocess(),
  
  compilerOptions: {
    // Enable TypeScript support
    // Generate source maps for debugging
    enableSourcemap: true,
  },
  
  // Warn on unused CSS selectors
  onwarn: (warning, handler) => {
    // Ignore a11y warnings for now (we can address later)
    if (warning.code.startsWith('a11y-')) return;
    handler(warning);
  },
};
