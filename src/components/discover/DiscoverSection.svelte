<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import MediaCard from '../shared/MediaCard.svelte';
  import type { MediaItem, CatalogInfo } from '../../types/tauri';

  type MediaTypeStr = 'movie' | 'series' | 'channel' | 'tv';

  let mediaType: MediaTypeStr = 'movie';
  let catalogs: CatalogInfo[] = [];
  let selectedCatalogId = '';
  let items: MediaItem[] = [];
  let hasMore = false;
  let skip = 0;
  const pageSize = 20;
  
  // Filters
  let genre = '';
  let searchInCatalog = '';
  let availableGenres: string[] = [];
  let supportsSearch = false;

  let loading = false;
  let error: string | null = null;

  onMount(loadCatalogs);

  async function loadCatalogs() {
    loading = true;
    error = null;
    try {
      catalogs = await invoke<CatalogInfo[]>('list_catalogs', { mediaType });
      if (catalogs.length > 0) {
        selectedCatalogId = catalogs[0].id;
        deriveFilterCapabilities();
        await loadItems(true);
      }
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  function deriveFilterCapabilities() {
    // In our backend, CatalogInfo may not carry genres; this is best-effort.
    // Keep UI controls but hide if no data.
    availableGenres = (catalogs as any).find((c: any) => c.id === selectedCatalogId)?.genres || [];
    supportsSearch = ((catalogs as any).find((c: any) => c.id === selectedCatalogId)?.extra_supported || []).includes?.('search');
  }

  async function loadItems(reset = false) {
    if (!selectedCatalogId) return;
    loading = true;
    error = null;
    try {
      if (reset) {
        items = [];
        skip = 0;
        hasMore = false;
      }
      const extra: any = { skip: String(skip), limit: String(pageSize) };
      if (genre) extra.genre = genre;
      if (searchInCatalog) extra.search = searchInCatalog;

      const result = await invoke<any>('aggregate_catalogs', { mediaType, catalogId: selectedCatalogId, extra });
      const metas = Array.isArray(result?.items) ? result.items : [];
      const mapped = metas.map(mapMetaPreviewToMediaItem);
      const existing = new Set(items.map(i => i.id));
      const appended = mapped.filter(m => !existing.has(m.id));
      items = items.concat(appended);
      skip += metas.length;
      hasMore = metas.length >= pageSize;
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  function mapMetaPreviewToMediaItem(meta: any): MediaItem {
    const type = typeof meta.media_type === 'string' ? meta.media_type : (meta.type || meta.mediaType || 'movie');
    let year: number | undefined;
    const rel = meta.releaseInfo || meta.release || '';
    if (typeof rel === 'string') {
      const m = rel.match(/(19|20)\d{2}/);
      if (m) year = parseInt(m[0]);
    }
    return {
      id: String(meta.id),
      title: meta.name || meta.title || 'Unknown',
      media_type: type,
      year,
      genre: [],
      description: meta.description || '',
      poster_url: meta.poster || undefined,
      backdrop_url: meta.background || undefined,
      rating: typeof meta.imdbRating === 'number' ? meta.imdbRating : undefined,
      duration: undefined,
      added_to_library: undefined,
      watched: false,
      progress: 0,
    } as unknown as MediaItem;
  }
</script>

<div class="discover-section">
  <div class="search-header">
    <h2>Discover</h2>
    <div class="search-bar-large" style="gap: 12px; flex-wrap: wrap;">
      <select bind:value={mediaType} class="setting-select" on:change={() => loadCatalogs()} style="min-width: 150px;">
        <option value="movie">🎬 Movies</option>
        <option value="series">📺 Series</option>
        <option value="channel">📹 Channels</option>
        <option value="tv">📡 Live TV</option>
      </select>
      <select bind:value={selectedCatalogId} class="setting-select" on:change={() => { deriveFilterCapabilities(); loadItems(true); }} style="flex: 1; min-width: 250px;">
        {#if catalogs.length === 0}
          <option value="">No catalogs</option>
        {:else}
          {#each catalogs as c}
            <option value={c.id}>{c.name}</option>
          {/each}
        {/if}
      </select>

      {#if supportsSearch}
        <input type="text" class="setting-select" placeholder="Search in catalog..." bind:value={searchInCatalog} on:keypress={(e) => e.key === 'Enter' && loadItems(true)} style="min-width: 200px;" />
      {/if}
      {#if availableGenres.length > 0}
        <select bind:value={genre} class="setting-select" style="min-width: 180px;">
          <option value="">All Genres</option>
          {#each availableGenres as g}<option value={g}>{g}</option>{/each}
        </select>
      {/if}
      <button class="btn btn-primary" on:click={() => loadItems(true)}>Apply</button>
      <button class="btn btn-secondary" on:click={() => { genre=''; searchInCatalog=''; loadItems(true); }}>Clear</button>
    </div>
  </div>

  {#if loading && items.length === 0}
    <div class="loading-indicator"><p>Loading...</p></div>
  {:else if error}
    <div class="error-state"><p>{error}</p></div>
  {:else}
    <div class="movie-grid">
      {#if items.length === 0}
        <p class="empty-message">Select a catalog to browse content</p>
      {:else}
        {#each items as item (item.id)}
          <MediaCard {item} />
        {/each}
      {/if}
    </div>
    <div style="display:flex; justify-content:center; margin-top: 16px;">
      {#if hasMore}
        <button class="btn btn-secondary" on:click={() => loadItems(false)}>Load More</button>
      {/if}
    </div>
  {/if}
</div>