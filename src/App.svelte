<script lang="ts">
  /**
   * Main StreamGo App Component (Svelte)
   * 
   * This is the entry point for Svelte components.
   * For now, it only manages the Settings section.
   * Other sections will be migrated gradually.
   */
  
  import SettingsSection from './components/settings/SettingsSection.svelte';
  import LibrarySection from './components/library/LibrarySection.svelte';
  
  import { onMount } from 'svelte';
  
  // Track which section is active
  // Eventually this will be managed by a router or global state
  let activeSection = 'home';
  
  // Listen for section changes from vanilla TS app
  if (typeof window !== 'undefined') {
    window.addEventListener('streamgo:section-change', ((event: CustomEvent) => {
      activeSection = event.detail.section;
    }) as EventListener);
  }
  
  // Hide vanilla sections when Svelte takes over
  $: if (typeof window !== 'undefined') {
    const vanillaSettings = document.getElementById('settings-section');
    if (vanillaSettings) {
      vanillaSettings.style.display = activeSection === 'settings' ? 'none' : '';
    }
    
    const vanillaLibrary = document.getElementById('library-section');
    if (vanillaLibrary) {
      vanillaLibrary.style.display = activeSection === 'library' ? 'none' : '';
    }
  }
</script>

<!-- 
  For now, we only render the Settings section when active.
  The rest of the app still uses vanilla TS.
  
  As we migrate more sections, we'll add them here.
-->

{#if activeSection === 'settings'}
  <SettingsSection />
{:else if activeSection === 'library'}
  <LibrarySection />
{/if}

<!-- Global styles are imported from styles.css in index.html -->
