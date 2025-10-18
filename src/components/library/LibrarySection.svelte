<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { libraryStore, libraryCount } from '../../stores/library';
  import MediaCard from '../shared/MediaCard.svelte';
  import VirtualGrid from '../shared/VirtualGrid.svelte';
  
  const VIRTUAL_THRESHOLD = 50;
  
  onMount(async () => {
    await libraryStore.load();
  });
  
  // Re-initialize lazy loading after the grid updates (for non-virtual mode)
  afterUpdate(() => {
    if (typeof window !== 'undefined' && (window as any).setupLazyLoading) {
      (window as any).setupLazyLoading();
    }
  });
  
  function handleRetry() {
    libraryStore.load();
  }
  
  $: useVirtual = $libraryStore.items.length > VIRTUAL_THRESHOLD;
</script>

<section id="library-section" class="content-section" data-testid="library-section">
  <div class="library-header">
    <h2>Your Library</h2>
    <p class="library-count">
      <span id="library-count">{$libraryCount}</span> items
    </p>
  </div>
  
  {#if $libraryStore.loading && $libraryStore.items.length === 0}
    <!-- Loading skeleton -->
    <div class="movie-grid">
      <div class="skeleton-grid">
        {#each Array(6) as _, i (i)}
          <div class="skeleton-card">
            <div class="skeleton-poster"></div>
            <div class="skeleton-info">
              <div class="skeleton-title"></div>
              <div class="skeleton-meta">
                <div class="skeleton-meta-item"></div>
                <div class="skeleton-meta-item"></div>
                <div class="skeleton-meta-item"></div>
              </div>
              <div class="skeleton-description"></div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else if $libraryStore.error && $libraryStore.items.length === 0}
    <!-- Error state -->
    <div class="movie-grid">
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Unable to Load Library</h3>
        <p>There was a problem loading your library. Your data is safe, but we couldn't display it right now.</p>
        <button class="btn btn-primary" on:click={handleRetry}>
          🔄 Retry
        </button>
      </div>
    </div>
  {:else if $libraryStore.items.length === 0}
    <!-- Empty state -->
    <div id="library-grid" class="movie-grid">
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <h3>Your library is empty</h3>
        <p>Search for movies and TV shows, then add them to your library to see them here.</p>
      </div>
    </div>
  {:else}
    <!-- Library grid with items -->
    {#if useVirtual}
      <!-- Virtual scrolling for large libraries -->
      <div id="library-grid" class="movie-grid-virtual">
        <VirtualGrid 
          items={$libraryStore.items} 
          itemHeight={400}
          itemWidth={200}
          gap={16}
          minColumns={2}
          let:item
        >
          <MediaCard {item} showProgress={false} />
        </VirtualGrid>
      </div>
    {:else}
      <!-- Standard grid for smaller libraries -->
      <div id="library-grid" class="movie-grid">
        {#each $libraryStore.items as item (item.id)}
          <MediaCard {item} showProgress={false} />
        {/each}
      </div>
    {/if}
  {/if}
</section>

<style>
  .empty-state,
  .error-state {
    text-align: center;
    padding: 4rem 2rem;
    max-width: 500px;
    margin: 0 auto;
  }
  
  .empty-icon,
  .error-icon {
    font-size: 4rem;
    margin-bottom: 1.5rem;
  }
  
  .error-state h3,
  .empty-state h3 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }
  
  .error-state p,
  .empty-state p {
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
    line-height: 1.6;
  }
  
  .movie-grid-virtual {
    height: calc(100vh - 200px);
    min-height: 400px;
  }
</style>
