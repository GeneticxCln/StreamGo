<script lang="ts">
  /**
   * Main StreamGo App Component (Svelte)
   * 
   * This is the entry point for Svelte components.
   * For now, it only manages the Settings section.
   * Other sections will be migrated gradually.
   */
  
  import { onMount } from 'svelte';
  
  // Dynamic imports for code-splitting
  let SettingsSection: any = null;
  let LibrarySection: any = null;
  
  // Track which section is active
  // Eventually this will be managed by a router or global state
  let activeSection = 'home';
  
  // Component loading states
  let loadingSettings = false;
  let loadingLibrary = false;
  
  // Dynamic import functions
  async function loadSettingsComponent() {
    if (!SettingsSection && !loadingSettings) {
      loadingSettings = true;
      try {
        const module = await import('./components/settings/SettingsSection.svelte');
        SettingsSection = module.default;
      } catch (error) {
        console.error('Failed to load Settings component:', error);
      } finally {
        loadingSettings = false;
      }
    }
  }
  
  async function loadLibraryComponent() {
    if (!LibrarySection && !loadingLibrary) {
      loadingLibrary = true;
      try {
        const module = await import('./components/library/LibrarySection.svelte');
        LibrarySection = module.default;
      } catch (error) {
        console.error('Failed to load Library component:', error);
      } finally {
        loadingLibrary = false;
      }
    }
  }
  
  // Listen for section changes from vanilla TS app
  if (typeof window !== 'undefined') {
    window.addEventListener('streamgo:section-change', ((event: CustomEvent) => {
      activeSection = event.detail.section;
      
      // Preload components when section changes
      if (event.detail.section === 'settings') {
        loadSettingsComponent();
      } else if (event.detail.section === 'library') {
        loadLibraryComponent();
      }
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
  {#if SettingsSection}
    <svelte:component this={SettingsSection} />
  {:else if loadingSettings}
    <div class="loading-section">
      <p>Loading Settings...</p>
    </div>
  {:else}
    <div class="loading-section">
      <p>Initializing Settings...</p>
    </div>
  {/if}
{:else if activeSection === 'library'}
  {#if LibrarySection}
    <svelte:component this={LibrarySection} />
  {:else if loadingLibrary}
    <div class="loading-section">
      <p>Loading Library...</p>
    </div>
  {:else}
    <div class="loading-section">
      <p>Initializing Library...</p>
    </div>
  {/if}
{/if}

<!-- Global styles are imported from styles.css in index.html -->

<style>
  .loading-section {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200px;
    color: var(--text-muted, #888);
    font-size: 14px;
  }
</style>
