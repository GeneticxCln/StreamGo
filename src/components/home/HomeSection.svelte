<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import type { MediaItem } from '../../types/tauri';
  import MediaCard from '../shared/MediaCard.svelte';

  let continueWatching: MediaItem[] = [];
  let trending: MediaItem[] = [];
  let popular: MediaItem[] = [];
  let cwLoading = false;
  let trLoading = false;
  let popLoading = false;

  onMount(async () => {
    await Promise.all([loadContinueWatching(), loadTrending(), loadPopular()]);
  });

  async function loadContinueWatching() {
    cwLoading = true;
    try {
      continueWatching = await invoke<MediaItem[]>('get_continue_watching');
      continueWatching = continueWatching.slice(0, 10);
    } finally { cwLoading = false; }
  }

  async function loadTrending() {
    trLoading = true;
    try {
      const catalogs = await invoke<any[]>('list_catalogs', { mediaType: 'movie' });
      const selected = catalogs?.find((c: any) => String(c.name).toLowerCase().includes('trending')) || catalogs?.[0];
      if (!selected) { trending = []; return; }
      const result = await invoke<any>('aggregate_catalogs', { mediaType: 'movie', catalogId: selected.id });
      const metas = Array.isArray(result?.items) ? result.items : [];
      trending = metas.slice(0, 10).map(mapMetaPreviewToMediaItem);
    } finally { trLoading = false; }
  }

  async function loadPopular() {
    popLoading = true;
    try {
      const catalogs = await invoke<any[]>('list_catalogs', { mediaType: 'movie' });
      const selected = catalogs?.find((c: any) => String(c.name).toLowerCase().includes('popular')) || catalogs?.[0];
      if (!selected) { popular = []; return; }
      const result = await invoke<any>('aggregate_catalogs', { mediaType: 'movie', catalogId: selected.id });
      const metas = Array.isArray(result?.items) ? result.items : [];
      popular = metas.slice(0, 10).map(mapMetaPreviewToMediaItem);
    } finally { popLoading = false; }
  }

  function mapMetaPreviewToMediaItem(meta: any): MediaItem {
    const type = typeof meta.media_type === 'string' ? meta.media_type : (meta.type || meta.mediaType || 'movie');
    return {
      id: String(meta.id),
      title: meta.name || meta.title || 'Unknown',
      media_type: type,
      year: undefined,
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

  function startSearching() {
    try { window.dispatchEvent(new CustomEvent('streamgo:section-change', { detail: { section: 'search' } })); } catch {}
    (window as any).app?.showSection?.('search');
  }
</script>

<div class="home-section">
  <div class="hero-section">
    <div class="hero-content">
      <h2 class="hero-title">Welcome to StreamGo</h2>
      <p class="hero-description">Your modern media center for movies and TV shows. Search for content, build your library, and discover new favorites.</p>
      <button class="btn btn-primary" on:click={startSearching}>Start Searching</button>
    </div>
  </div>

  {#if continueWatching.length > 0}
    <div class="content-row">
      <div class="content-row-header">
        <h3 class="content-row-title">Continue Watching</h3>
      </div>
      <div class="content-row-items">
        {#each continueWatching as item (item.id)}
          <MediaCard {item} showProgress={true} />
        {/each}
      </div>
    </div>
  {/if}

  <div class="content-row">
    <div class="content-row-header">
      <h3 class="content-row-title">🔥 Trending Now</h3>
    </div>
    {#if trLoading}
      <div class="loading-indicator">Loading...</div>
    {:else}
      <div class="content-row-items">
        {#each trending as item (item.id)}
          <MediaCard {item} />
        {/each}
      </div>
    {/if}
  </div>

  <div class="content-row">
    <div class="content-row-header">
      <h3 class="content-row-title">⭐ Popular</h3>
    </div>
    {#if popLoading}
      <div class="loading-indicator">Loading...</div>
    {:else}
      <div class="content-row-items">
        {#each popular as item (item.id)}
          <MediaCard {item} />
        {/each}
      </div>
    {/if}
  </div>
</div>