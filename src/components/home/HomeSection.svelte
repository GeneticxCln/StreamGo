<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import type { MediaItem } from '../../types/tauri';
  import MediaCard from '../shared/MediaCard.svelte';

  console.log('HomeSection: Component loaded');

  let continueWatching: MediaItem[] = [];
  let trending: MediaItem[] = [];
  let popular: MediaItem[] = [];
  let cwLoading = false;
  let trLoading = false;
  let popLoading = false;

  onMount(async () => {
    console.log('HomeSection: Component mounted, loading content');
    try {
      await Promise.all([loadContinueWatching(), loadTrending(), loadPopular()]);
      console.log('HomeSection: Content loaded successfully');
    } catch (error) {
      console.error('HomeSection: Failed to load content:', error);
    }
  });

  async function loadContinueWatching() {
    console.log('HomeSection: Loading continue watching');
    cwLoading = true;
    try {
      continueWatching = await invoke<MediaItem[]>('get_continue_watching');
      continueWatching = continueWatching.slice(0, 10);
      console.log('HomeSection: Continue watching loaded:', continueWatching.length, 'items');
    } catch (error) {
      console.warn('HomeSection: Failed to load continue watching:', error);
      continueWatching = []; // Set empty array on error
    } finally { cwLoading = false; }
  }

  async function loadTrending() {
    console.log('HomeSection: Loading trending');
    trLoading = true;
    try {
      const catalogs = await invoke<any[]>('list_catalogs', { mediaType: 'movie' });
      console.log('HomeSection: Available catalogs:', catalogs?.length || 0);
      const selected = catalogs?.find((c: any) => String(c.name).toLowerCase().includes('trending')) || catalogs?.[0];
      if (!selected) {
        console.log('HomeSection: No trending catalog found');
        trending = [];
        return;
      }
      console.log('HomeSection: Selected catalog:', selected.name);
      const result = await invoke<any>('aggregate_catalogs', { mediaType: 'movie', catalogId: selected.id });
      const metas = Array.isArray(result?.items) ? result.items : [];
      trending = metas.slice(0, 10).map(mapMetaPreviewToMediaItem);
      console.log('HomeSection: Trending loaded:', trending.length, 'items');
    } catch (error) {
      console.warn('HomeSection: Failed to load trending content:', error);
      trending = []; // Set empty array on error
    } finally { trLoading = false; }
  }

  async function loadPopular() {
    console.log('HomeSection: Loading popular');
    popLoading = true;
    try {
      const catalogs = await invoke<any[]>('list_catalogs', { mediaType: 'movie' });
      const selected = catalogs?.find((c: any) => String(c.name).toLowerCase().includes('popular')) || catalogs?.[0];
      if (!selected) {
        console.log('HomeSection: No popular catalog found');
        popular = [];
        return;
      }
      const result = await invoke<any>('aggregate_catalogs', { mediaType: 'movie', catalogId: selected.id });
      const metas = Array.isArray(result?.items) ? result.items : [];
      popular = metas.slice(0, 10).map(mapMetaPreviewToMediaItem);
      console.log('HomeSection: Popular loaded:', popular.length, 'items');
    } catch (error) {
      console.warn('HomeSection: Failed to load popular content:', error);
      popular = []; // Set empty array on error
    } finally { popLoading = false; }
  }

  function mapMetaPreviewToMediaItem(meta: any): MediaItem {
    console.log('HomeSection: Mapping meta item:', meta.name || meta.title);
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

  import { navigationStore } from '@/stores/navigationStore';

  function startSearching() {
    console.log('HomeSection: Starting search');
    navigationStore.goTo('search');
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