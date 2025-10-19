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
  let PlayerUI: any = null;
  let AddonsSection: any = null;
  let SearchSection: any = null;
  let DiscoverSection: any = null;
  let CalendarSection: any = null;
  let PlaylistsSection: any = null;
  let HomeSection: any = null;
  let DetailSection: any = null;
  
  // Track which section is active
  // Eventually this will be managed by a router or global state
  let activeSection = 'home';
  
  // Component loading states
  let loadingSettings = false;
  let loadingLibrary = false;
  let loadingPlayer = false;
  let playerUILoaded = false;
  
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
  
  async function loadPlayerComponent() {
    if (!PlayerUI && !loadingPlayer) {
      loadingPlayer = true;
      try {
        const module = await import('./components/player/PlayerUI.svelte');
        PlayerUI = module.default;
        playerUILoaded = true;
        console.log('✅ Player UI component loaded');
      } catch (error) {
        console.error('Failed to load Player UI component:', error);
      } finally {
        loadingPlayer = false;
      }
    }
  }

  async function loadAddonsComponent() {
    if (!AddonsSection) {
      try {
        const module = await import('./components/addons/AddonsSection.svelte');
        AddonsSection = module.default;
      } catch (error) {
        console.error('Failed to load AddonsSection component:', error);
      }
    }
  }

  async function loadSearchComponent() {
    if (!SearchSection) {
      try {
        const module = await import('./components/search/SearchSection.svelte');
        SearchSection = module.default;
      } catch (error) {
        console.error('Failed to load SearchSection component:', error);
      }
    }
  }

  async function loadDiscoverComponent() {
    if (!DiscoverSection) {
      try {
        const module = await import('./components/discover/DiscoverSection.svelte');
        DiscoverSection = module.default;
      } catch (error) {
        console.error('Failed to load DiscoverSection component:', error);
      }
    }
  }

  async function loadCalendarComponent() {
    if (!CalendarSection) {
      try {
        const module = await import('./components/calendar/CalendarSection.svelte');
        CalendarSection = module.default;
      } catch (error) {
        console.error('Failed to load CalendarSection component:', error);
      }
    }
  }

  async function loadPlaylistsComponent() {
    if (!PlaylistsSection) {
      try {
        const module = await import('./components/playlists/PlaylistsSection.svelte');
        PlaylistsSection = module.default;
      } catch (error) {
        console.error('Failed to load PlaylistsSection component:', error);
      }
    }
  }

  async function loadHomeComponent() {
    if (!HomeSection) {
      try {
        const module = await import('./components/home/HomeSection.svelte');
        HomeSection = module.default;
      } catch (error) {
        console.error('Failed to load HomeSection component:', error);
      }
    }
  }

  async function loadDetailComponent() {
    if (!DetailSection) {
      try {
        const module = await import('./components/detail/DetailSection.svelte');
        DetailSection = module.default;
      } catch (error) {
        console.error('Failed to load DetailSection component:', error);
      }
    }
  }
  
  // Load player UI when player is initialized
  if (typeof window !== 'undefined') {
    window.addEventListener('streamgo:player-ready', () => {
      loadPlayerComponent();
    });
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
      } else if (event.detail.section === 'addons') {
        loadAddonsComponent();
      } else if (event.detail.section === 'search') {
        loadSearchComponent();
      } else if (event.detail.section === 'discover') {
        loadDiscoverComponent();
      } else if (event.detail.section === 'calendar') {
        loadCalendarComponent();
      } else if (event.detail.section === 'playlists') {
        loadPlaylistsComponent();
      } else if (event.detail.section === 'home') {
        loadHomeComponent();
      } else if (event.detail.section === 'detail') {
        loadDetailComponent();
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

    const vanillaHome = document.getElementById('home-section');
    if (vanillaHome) {
      vanillaHome.style.display = activeSection === 'home' ? 'none' : '';
    }

    const vanillaAddons = document.getElementById('addons-section');
    if (vanillaAddons) {
      vanillaAddons.style.display = activeSection === 'addons' ? 'none' : '';
    }

    const vanillaSearch = document.getElementById('search-section');
    if (vanillaSearch) {
      vanillaSearch.style.display = activeSection === 'search' ? 'none' : '';
    }

    const vanillaDiscover = document.getElementById('discover-section');
    if (vanillaDiscover) {
      vanillaDiscover.style.display = activeSection === 'discover' ? 'none' : '';
    }

    const vanillaCalendar = document.getElementById('calendar-section');
    if (vanillaCalendar) {
      vanillaCalendar.style.display = activeSection === 'calendar' ? 'none' : '';
    }

    const vanillaPlaylists = document.getElementById('playlists-section');
    if (vanillaPlaylists) {
      vanillaPlaylists.style.display = activeSection === 'playlists' ? 'none' : '';
    }

    const vanillaDetail = document.getElementById('detail-section');
    if (vanillaDetail) {
      vanillaDetail.style.display = activeSection === 'detail' ? 'none' : '';
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
{:else if activeSection === 'addons'}
  {#if AddonsSection}
    <svelte:component this={AddonsSection} />
  {:else}
    <div class="loading-section"><p>Loading Add-ons...</p></div>
  {/if}
{:else if activeSection === 'search'}
  {#if SearchSection}
    <svelte:component this={SearchSection} />
  {:else}
    <div class="loading-section"><p>Loading Search...</p></div>
  {/if}
{:else if activeSection === 'discover'}
  {#if DiscoverSection}
    <svelte:component this={DiscoverSection} />
  {:else}
    <div class="loading-section"><p>Loading Discover...</p></div>
  {/if}
{:else if activeSection === 'calendar'}
  {#if CalendarSection}
    <svelte:component this={CalendarSection} />
  {:else}
    <div class="loading-section"><p>Loading Calendar...</p></div>
  {/if}
{:else if activeSection === 'playlists'}
  {#if PlaylistsSection}
    <svelte:component this={PlaylistsSection} />
  {:else}
    <div class="loading-section"><p>Loading Playlists...</p></div>
  {/if}
{:else if activeSection === 'home'}
  {#if HomeSection}
    <svelte:component this={HomeSection} />
  {:else}
    <div class="loading-section"><p>Loading Home...</p></div>
  {/if}
{:else if activeSection === 'detail'}
  {#if DetailSection}
    <svelte:component this={DetailSection} />
  {:else}
    <div class="loading-section"><p>Loading Details...</p></div>
  {/if}

<!-- Player UI overlay - always rendered when loaded -->
{#if PlayerUI && playerUILoaded}
  <div id="player-ui-svelte">
    <svelte:component this={PlayerUI} />
  </div>
{/if}

<!-- Global styles are imported from styles.css in index.html -->

<style>
  #player-ui-svelte {
    pointer-events: none; /* Let clicks through to video */
  }
  
  #player-ui-svelte > :global(*) {
    pointer-events: auto; /* Re-enable for actual controls */
  }
  
  .loading-section {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200px;
    color: var(--text-muted, #888);
    font-size: 14px;
  }
</style>
