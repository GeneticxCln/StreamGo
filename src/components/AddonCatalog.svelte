<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Toast } from '../ui-utils';

interface AddonCatalogItem {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    url: string;
    enabled: boolean;
    addon_type: string;
    rating?: number; // community rating (0-5)
    ratingCount?: number;
    manifest: {
      id: string;
      name: string;
      version: string;
      description: string;
      resources: string[];
      types: string[];
      catalogs: Array<{
        catalog_type: string;
        id: string;
        name: string;
        genres?: string[];
      }>;
    };
  }

  interface CatalogInfo {
    addon_id: string;
    addon_name: string;
    id: string;
    name: string;
    media_type: string;
    genres?: string[];
    extra_supported: string[];
  }

  let availableAddons: AddonCatalogItem[] = [];
  let installedAddons: AddonCatalogItem[] = [];
  let loading = true;
  let searchQuery = '';
  let selectedCategory = 'all';
  let selectedMediaType = 'all';

  const dispatch = createEventDispatcher();

  // Categories for filtering
  const categories = [
    { id: 'all', name: 'All Categories', icon: '📦' },
    { id: 'movies', name: 'Movies', icon: '🎬' },
    { id: 'series', name: 'TV Series', icon: '📺' },
    { id: 'anime', name: 'Anime', icon: '🎌' },
    { id: 'documentaries', name: 'Documentaries', icon: '📚' },
    { id: 'subtitles', name: 'Subtitles', icon: '📝' },
    { id: 'general', name: 'General', icon: '⚙️' }
  ];

  const mediaTypes = [
    { id: 'all', name: 'All Types' },
    { id: 'movie', name: 'Movies' },
    { id: 'series', name: 'TV Series' },
    { id: 'channel', name: 'Channels' },
    { id: 'tv', name: 'Live TV' }
  ];

  onMount(async () => {
    await loadAddonCatalog();
  });

  async function loadAddonCatalog() {
    try {
      loading = true;

      // Load available catalogs from all enabled addons
      const catalogsData = await invoke<CatalogInfo[]>('list_catalogs', {
        mediaType: selectedMediaType === 'all' ? 'movie' : selectedMediaType
      });

      // Store catalogs data for potential future use
      console.log('Loaded catalogs:', catalogsData);

      // Load installed addons for context
      const installed = await invoke<AddonCatalogItem[]>('get_addons');
      installedAddons = installed;

      // For demo purposes, create some sample available addons
      // In a real implementation, this would come from a curated catalog server
      availableAddons = await loadAvailableAddons();

    } catch (error) {
      console.error('Failed to load addon catalog:', error);
      Toast.error('Failed to load addon catalog');
    } finally {
      loading = false;
    }
  }

  async function loadAvailableAddons(): Promise<AddonCatalogItem[]> {
    // Sample available addons - in production this would come from a server
    return [
      {
        id: 'cinemeta',
        name: 'Cinemeta',
        version: '1.0.0',
        description: 'Official TMDB addon providing comprehensive movie and TV show metadata from The Movie Database',
        author: 'StreamGo Team',
        url: 'https://v3-cinemeta.strem.io/manifest.json',
        enabled: installedAddons.some(a => a.id === 'cinemeta'),
        addon_type: 'ContentProvider',
        rating: 4.9,
        ratingCount: 1200,
        manifest: {
          id: 'cinemeta',
          name: 'Cinemeta',
          version: '1.0.0',
          description: 'Official TMDB addon',
          resources: ['catalog', 'meta'],
          types: ['movie', 'series'],
          catalogs: [
            { catalog_type: 'movie', id: 'top', name: 'Top Movies' },
            { catalog_type: 'series', id: 'top', name: 'Top Series' }
          ]
        }
      },
      {
        id: 'opensubtitles',
        name: 'OpenSubtitles',
        version: '1.0.0',
        description: 'Largest subtitle database with support for 100+ languages',
        author: 'OpenSubtitles.org',
        url: 'https://opensubtitles.strem.io/manifest.json',
        enabled: installedAddons.some(a => a.id === 'opensubtitles'),
        addon_type: 'Subtitles',
        rating: 4.4,
        ratingCount: 800,
        manifest: {
          id: 'opensubtitles',
          name: 'OpenSubtitles',
          version: '1.0.0',
          description: 'Subtitle provider',
          resources: ['subtitles'],
          types: ['movie', 'series'],
          catalogs: []
        }
      },
      {
        id: 'torrentio',
        name: 'Torrentio',
        version: '1.0.0',
        description: 'Torrent streaming addon with debrid support',
        author: 'Torrentio Community',
        url: 'https://torrentio.strem.io/manifest.json',
        enabled: installedAddons.some(a => a.id === 'torrentio'),
        addon_type: 'ContentProvider',
        rating: 4.6,
        ratingCount: 2300,
        manifest: {
          id: 'torrentio',
          name: 'Torrentio',
          version: '1.0.0',
          description: 'Torrent streaming',
          resources: ['catalog', 'stream'],
          types: ['movie', 'series'],
          catalogs: [
            { catalog_type: 'movie', id: 'torrents', name: 'Torrent Movies' },
            { catalog_type: 'series', id: 'torrents', name: 'Torrent Series' }
          ]
        }
      }
    ];
  }

  function filterAddons(addons: AddonCatalogItem[]) {
    let filtered = addons;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(addon =>
        addon.name.toLowerCase().includes(query) ||
        addon.description.toLowerCase().includes(query) ||
        addon.author.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(addon => {
        switch (selectedCategory) {
          case 'movies':
            return addon.manifest.catalogs.some(c => c.catalog_type === 'movie');
          case 'series':
            return addon.manifest.catalogs.some(c => c.catalog_type === 'series');
          case 'subtitles':
            return addon.manifest.resources.includes('subtitles');
          default:
            return true;
        }
      });
    }

    return filtered;
  }

  async function installAddon(addon: AddonCatalogItem) {
    try {
      Toast.info(`Installing ${addon.name}...`);
      await invoke('install_addon', { addonUrl: addon.url });
      Toast.success(`${addon.name} installed successfully!`);
      await loadAddonCatalog(); // Refresh the catalog
      dispatch('addonInstalled', { addonId: addon.id });
    } catch (error) {
      console.error('Failed to install addon:', error);
      Toast.error(`Failed to install ${addon.name}: ${error}`);
    }
  }

  async function uninstallAddon(addon: AddonCatalogItem) {
    try {
      const confirmed = confirm(`Are you sure you want to uninstall ${addon.name}?`);
      if (!confirmed) return;

      Toast.info(`Uninstalling ${addon.name}...`);
      await invoke('uninstall_addon', { addonId: addon.id });
      Toast.success(`${addon.name} uninstalled successfully!`);
      await loadAddonCatalog(); // Refresh the catalog
      dispatch('addonUninstalled', { addonId: addon.id });
    } catch (error) {
      console.error('Failed to uninstall addon:', error);
      Toast.error(`Failed to uninstall ${addon.name}: ${error}`);
    }
  }

  function getAddonStatus(addon: AddonCatalogItem) {
    const installed = installedAddons.find(a => a.id === addon.id);
    return installed ? (installed.enabled ? 'installed' : 'disabled') : 'available';
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'installed':
        return { text: 'Installed', class: 'badge-success' };
      case 'disabled':
        return { text: 'Disabled', class: 'badge-warning' };
      default:
        return { text: 'Available', class: 'badge-info' };
    }
  }

  function getCategoryIcon(addon: AddonCatalogItem) {
    if (addon.manifest.resources.includes('subtitles')) return '📝';
    if (addon.manifest.catalogs.some(c => c.catalog_type === 'movie')) return '🎬';
    if (addon.manifest.catalogs.some(c => c.catalog_type === 'series')) return '📺';
    return '📦';
  }

  // Rating helpers via backend
  async function fetchRating(addonId: string) {
    try {
      const summary = await invoke<any>('get_addon_rating', { addonId });
      const a = availableAddons.find(a => a.id === addonId);
      if (a) {
        a.rating = summary.weighted_rating ?? summary.rating_avg ?? a.rating;
        a.ratingCount = summary.rating_count ?? a.ratingCount;
      }
    } catch {}
  }

  async function setUserRating(addonId: string, rating: number) {
    try {
      await invoke('rate_addon', { addonId, rating });
      await fetchRating(addonId);
      Toast.success('Thanks for rating!');
    } catch (e) {
      Toast.error('Could not submit rating');
    }
  }

  onMount(async () => {
    await loadAddonCatalog();
    // hydrate ratings from backend for visible addons
    for (const a of availableAddons) {
      await fetchRating(a.id);
    }
  });

  $: filteredAddons = filterAddons(availableAddons);
</script>

<div class="addon-catalog">
  <!-- Header -->
  <div class="catalog-header">
    <h2>🏪 Addon Catalog</h2>
    <p class="catalog-subtitle">Discover and install community addons to extend StreamGo's functionality</p>
  </div>

  <!-- Search and Filters -->
  <div class="catalog-filters">
    <div class="search-box">
      <input
        type="text"
        placeholder="Search addons..."
        bind:value={searchQuery}
        class="catalog-search"
      />
      <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
      </svg>
    </div>

    <div class="filter-controls">
      <select bind:value={selectedCategory} class="filter-select">
        {#each categories as category}
          <option value={category.id}>{category.icon} {category.name}</option>
        {/each}
      </select>

      <select bind:value={selectedMediaType} class="filter-select">
        {#each mediaTypes as type}
          <option value={type.id}>{type.name}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- Loading State -->
  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner">Loading addon catalog...</div>
    </div>
  {:else}
    <!-- Addon Grid -->
    <div class="addon-grid">
      {#each filteredAddons as addon (addon.id)}
        {@const status = getAddonStatus(addon)}
        {@const statusBadge = getStatusBadge(status)}
        {@const categoryIcon = getCategoryIcon(addon)}

        <div class="addon-card">
          <div class="addon-header">
            <div class="addon-icon">
              {categoryIcon}
            </div>
            <div class="addon-title-section">
              <h3 class="addon-title">{addon.name}</h3>
              <div class="addon-meta">
                <span class="addon-version">v{addon.version}</span>
                <span class="addon-author">by {addon.author}</span>
              </div>
            </div>
            <div class="addon-badges">
              <span class="status-badge {statusBadge.class}">
                {statusBadge.text}
              </span>
            </div>
          </div>

          <p class="addon-description">{addon.description}</p>

          <div class="addon-features">
            {#if addon.manifest.catalogs.length > 0}
              <div class="feature-item">
                <span class="feature-icon">📂</span>
                <span class="feature-text">
                  {addon.manifest.catalogs.length} catalog{addon.manifest.catalogs.length !== 1 ? 's' : ''}
                </span>
              </div>
            {/if}

            {#if addon.manifest.resources.includes('stream')}
              <div class="feature-item">
                <span class="feature-icon">▶️</span>
                <span class="feature-text">Streaming</span>
              </div>
            {/if}

            {#if addon.manifest.resources.includes('subtitles')}
              <div class="feature-item">
                <span class="feature-icon">📝</span>
                <span class="feature-text">Subtitles</span>
              </div>
            {/if}

            {#if addon.manifest.resources.includes('meta')}
              <div class="feature-item">
                <span class="feature-icon">ℹ️</span>
                <span class="feature-text">Metadata</span>
              </div>
            {/if}
          </div>

          <div class="addon-rating-row">
            <div class="rating-display">
              <span class="rating-stars" aria-label={`Community rating ${addon.rating ?? 0} of 5`}>
                {#each Array(5) as _, i}
                  <span class="star {i < Math.round(addon.rating ?? 0) ? 'filled' : ''}">★</span>
                {/each}
              </span>
              <span class="rating-count">{addon.rating?.toFixed(1) || '0.0'} ({addon.ratingCount || 0})</span>
            </div>
            <div class="user-rating">
              <span class="user-rating-label">Your rating:</span>
              <span class="user-stars">
                {#each [1,2,3,4,5] as v}
                  {@const ur = getUserRating(addon.id) }
                  <button
                    class="user-star {ur && ur >= v ? 'filled' : ''}"
                    on:click={() => { setUserRating(addon.id, v); }}
                    aria-label={`Rate ${v} stars`}
                    title={`Rate ${v} stars`}
                  >★</button>
                {/each}
              </span>
            </div>
          </div>

          <div class="addon-actions">
            {#if status === 'available'}
              <button
                class="btn btn-primary"
                on:click={() => installAddon(addon)}
              >
                Install
              </button>
            {:else if status === 'disabled'}
              <button
                class="btn btn-secondary"
                on:click={() => invoke('enable_addon', { addonId: addon.id })}
              >
                Enable
              </button>
              <button
                class="btn btn-danger"
                on:click={() => uninstallAddon(addon)}
              >
                Uninstall
              </button>
            {:else}
              <button
                class="btn btn-secondary"
                on:click={() => invoke('disable_addon', { addonId: addon.id })}
              >
                Disable
              </button>
              <button
                class="btn btn-danger"
                on:click={() => uninstallAddon(addon)}
              >
                Uninstall
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if filteredAddons.length === 0}
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>No addons found</h3>
        <p>Try adjusting your search or filter criteria</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .addon-catalog {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .catalog-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .catalog-header h2 {
    margin: 0 0 8px 0;
    font-size: 2.5rem;
    color: var(--text-primary);
  }

  .catalog-subtitle {
    margin: 0;
    color: var(--text-secondary);
    font-size: 1.1rem;
  }

  .catalog-filters {
    display: flex;
    gap: 16px;
    margin-bottom: 32px;
    align-items: center;
    flex-wrap: wrap;
  }

  .search-box {
    position: relative;
    flex: 1;
    min-width: 300px;
  }

  .catalog-search {
    width: 100%;
    padding: 12px 16px 12px 44px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background-color: var(--background-secondary);
    color: var(--text-primary);
    font-size: 16px;
  }

  .catalog-search:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-secondary);
    pointer-events: none;
  }

  .filter-controls {
    display: flex;
    gap: 12px;
  }

  .filter-select {
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background-color: var(--background-secondary);
    color: var(--text-primary);
    font-size: 14px;
    min-width: 140px;
  }

  .loading-state {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 60px;
    color: var(--text-secondary);
  }

  .addon-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 24px;
  }

  .addon-rating-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 8px 0 12px 0;
  }

  .rating-stars .star { color: #666; margin-right: 2px; }
  .rating-stars .star.filled { color: #ffd700; }
  .rating-count { color: var(--text-secondary); font-size: 0.9rem; margin-left: 6px; }

  .user-rating { display: flex; align-items: center; gap: 8px; }
  .user-rating-label { color: var(--text-secondary); font-size: 0.9rem; }
  .user-stars { display: inline-flex; gap: 2px; }
  .user-star { background: transparent; border: none; color: #666; cursor: pointer; font-size: 1rem; }
  .user-star.filled { color: #00d4ff; }

  .addon-card {
    background: var(--background-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 20px;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .addon-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  .addon-header {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
  }

  .addon-icon {
    font-size: 2.5rem;
    flex-shrink: 0;
  }

  .addon-title-section {
    flex: 1;
  }

  .addon-title {
    margin: 0 0 8px 0;
    font-size: 1.4rem;
    color: var(--text-primary);
  }

  .addon-meta {
    display: flex;
    gap: 16px;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .addon-badges {
    flex-shrink: 0;
  }

  .status-badge {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .badge-success {
    background: rgba(46, 204, 113, 0.2);
    color: #2ecc71;
  }

  .badge-warning {
    background: rgba(241, 196, 15, 0.2);
    color: #f1c40f;
  }

  .badge-info {
    background: rgba(52, 152, 219, 0.2);
    color: #3498db;
  }

  .addon-description {
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 16px;
  }

  .addon-features {
    margin-bottom: 20px;
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 0.9rem;
  }

  .feature-icon {
    font-size: 1.2rem;
  }

  .feature-text {
    color: var(--text-secondary);
  }

  .addon-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .addon-actions .btn {
    flex: 1;
    min-width: 100px;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    margin: 0 0 8px 0;
    color: var(--text-primary);
  }

  .empty-state p {
    margin: 0;
  }

  @media (max-width: 768px) {
    .addon-catalog {
      padding: 16px;
    }

    .catalog-filters {
      flex-direction: column;
      align-items: stretch;
    }

    .search-box {
      min-width: auto;
    }

    .addon-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .addon-header {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .addon-actions {
      flex-direction: column;
    }
  }
</style>