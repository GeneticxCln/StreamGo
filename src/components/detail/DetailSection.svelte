<script lang="ts">
  import { mediaStore } from '@/stores/mediaStore';
  import StreamPicker from './StreamPicker.svelte';
  import MediaCard from '../shared/MediaCard.svelte';

  // The component now gets all its state directly from the reactive store
</script>

{#if $mediaStore.currentItem}
  {@const media = $mediaStore.currentItem}
  <div class="detail-container">
    <div class="detail-hero">
      <img src={media.backdrop_url || ''} alt={`${media.title} backdrop`} class="detail-backdrop" />
      <div class="detail-hero-overlay"></div>
    </div>

    <div class="detail-content">
      <div class="detail-poster-wrapper">
        <img src={media.poster_url || ''} alt={`${media.title} poster`} class="detail-poster" />
      </div>
      <div class="detail-info">
        <h1 class="detail-title">{media.title}</h1>
        <div class="detail-meta">
          <span>{media.year || 'N/A'}</span>
          {#if media.duration}<span>• {media.duration} min</span>{/if}
          {#if media.rating}<span>• ⭐ {media.rating.toFixed(1)}</span>{/if}
        </div>
        <p class="detail-description">{media.description || 'No description available.'}</p>
        
        <!-- Stream Picker replaces the old Play button -->
        <StreamPicker streams={$mediaStore.streams} />

      </div>
    </div>

    <div class="settings-section">
      <h3>💡 You May Also Like</h3>
      <div class="similar-content">
        {#each $mediaStore.similarItems as item (item.id)}
          <div class="similar-item" on:click={() => mediaStore.showMediaDetail(item.id)}>
            <MediaCard {item} />
          </div>
        {/each}
      </div>
    </div>
  </div>
{:else if $mediaStore.loading}
    <div class="loading-indicator">Loading details...</div>
{:else if $mediaStore.error}
    <div class="error-state">Error loading media: {$mediaStore.error}</div>
{:else}
  <div class="empty-message">Select a title to see details.</div>
{/if}