<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import MediaCard from '../shared/MediaCard.svelte';
  import type { MediaItem } from '../../types/tauri';

  let query = '';
  let results: MediaItem[] = [];
  let loading = false;
  let error: string | null = null;

  async function performSearch() {
    if (!query.trim()) return;
    loading = true;
    error = null;
    results = [];
    try {
      results = await invoke<MediaItem[]>('search_content', { query });
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  function handleExternalSearch(e: CustomEvent) {
    const q = (e.detail?.query || '').toString();
    query = q;
    void performSearch();
  }

  onMount(() => {
    const handler = (ev: Event) => handleExternalSearch(ev as CustomEvent);
    window.addEventListener('streamgo:search', handler as EventListener);
    return () => window.removeEventListener('streamgo:search', handler as EventListener);
  });
</script>

<div class="search-section">
  <div class="search-header">
    <h2>Search Movies & TV Shows</h2>
    <div class="search-bar-large">
      <input type="text" placeholder="Enter movie or TV show name..." bind:value={query} on:keypress={(e) => e.key === 'Enter' && performSearch()} />
      <button class="btn btn-primary" on:click={performSearch}>Search</button>
    </div>
  </div>

  {#if loading}
    <div class="loading-indicator"><p>Searching...</p></div>
  {:else if error}
    <div class="error-state"><p>{error}</p></div>
  {:else if results.length === 0}
    <div class="movie-grid"><p class="empty-message">Enter a search query to find movies and TV shows</p></div>
  {:else}
    <div class="movie-grid">
      {#each results as item (item.id)}
        <MediaCard {item} showProgress={false} />
      {/each}
    </div>
  {/if}
</div>