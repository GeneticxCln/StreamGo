<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import type { MediaItem } from '../../types/tauri';
  import MediaCard from '../shared/MediaCard.svelte';

  let media: MediaItem | null = null;
  let similar: MediaItem[] = [];
  let loadingSimilar = false;

  function handleDetailMedia(event: CustomEvent) {
    media = event.detail.media as MediaItem;
    loadSimilar(media).catch(() => {});
  }

  onMount(() => {
    const handler = (e: Event) => handleDetailMedia(e as CustomEvent);
    window.addEventListener('streamgo:detail-media', handler as EventListener);
    return () => window.removeEventListener('streamgo:detail-media', handler as EventListener);
  });

  async function play() {
    if (!media) return;
    (window as any).app?.playMedia?.(media.id);
  }

  async function addToLibrary() {
    if (!media) return;
    (window as any).app?.addToLibrary?.(media);
  }

  async function loadSimilar(m: MediaItem) {
    loadingSimilar = true;
    similar = [];
    try {
      const typeStr = getMediaTypeString(m.media_type);
      const catalogs = await invoke<any[]>('list_catalogs', { mediaType: typeStr });
      const first = catalogs?.[0];
      if (!first) { loadingSimilar = false; return; }
      const extras: any = { skip: '0', limit: '10' };
      const result = await invoke<any>('aggregate_catalogs', { mediaType: typeStr, catalogId: first.id, extra: extras });
      const metas = Array.isArray(result?.items) ? result.items : [];
      const mapped = metas.filter((x: any) => x.id !== m.id).slice(0, 10).map(mapMetaPreviewToMediaItem);
      similar = mapped;
    } finally {
      loadingSimilar = false;
    }
  }

  function getMediaTypeString(mediaType: any): string {
    if (typeof mediaType === 'string') return mediaType.toLowerCase();
    if (mediaType && typeof mediaType === 'object') {
      if ('Movie' in mediaType) return 'movie';
      if ('TvShow' in mediaType) return 'series';
      if ('Episode' in mediaType) return 'episode';
    }
    return 'movie';
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

{#if media}
  <div class="detail-container">
    <div class="detail-hero">
      <img src={media.backdrop_url || 'https://via.placeholder.com/1200x500?text=No+Backdrop'} alt={`${media.title} backdrop`} class="detail-backdrop" loading="lazy" />
      <div class="detail-hero-overlay"></div>
    </div>

    <div class="detail-content">
      <div class="detail-poster-wrapper">
        <img src={media.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster'} alt={`${media.title} poster`} class="detail-poster" loading="lazy" />
      </div>
      <div class="detail-info">
        <h1 class="detail-title">{media.title}</h1>
        <div class="detail-meta">
          <span>{media.year || 'N/A'}</span>
          {#if media.duration}<span>• {media.duration} min</span>{/if}
          {#if media.rating}<span>• ⭐ {media.rating.toFixed(1)}</span>{/if}
        </div>
        <p class="detail-description">{media.description || 'No description available.'}</p>
        <div class="detail-actions" style="display:flex; gap: 8px;">
          <button class="btn btn-primary" on:click={play}>▶ Play</button>
          <button class="btn btn-secondary" on:click={addToLibrary}>＋ Library</button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3>💡 You May Also Like</h3>
      {#if loadingSimilar}
        <div class="loading-indicator">Loading...</div>
      {:else}
        <div class="similar-content">
          {#each similar as item (item.id)}
            <div class="similar-item" on:click={() => (window as any).app?.showMediaDetail?.(item.id)}>
              <img src={item.poster_url || 'https://via.placeholder.com/200x300?text=No+Poster'} alt={item.title} class="similar-poster" loading="lazy" />
              <div class="similar-title">{item.title}</div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{:else}
  <div class="empty-message">Select a title to see details.</div>
{/if}