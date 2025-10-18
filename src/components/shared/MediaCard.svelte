<script lang="ts">
  import type { MediaItem } from '../../types/tauri';
  
  export let item: MediaItem;
  export let showProgress = false;
  
  const posterUrl = item.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster';
  const rating = item.rating ? item.rating.toFixed(1) : null;
  
  // Calculate progress percentage
  const progress = item.progress || 0;
  const duration = item.duration ? item.duration * 60 : 0; // duration is in minutes
  const progressPercent = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
  
  function handleClick() {
    // Dispatch custom event that vanilla code can listen to
    const event = new CustomEvent('streamgo:media-click', {
      detail: { mediaId: item.id, item },
      bubbles: true,
    });
    window.dispatchEvent(event);
  }
</script>

<div class="meta-item-container poster-shape-poster animation-fade-in" data-media-id={item.id}>
  <div class="poster-container">
    <div class="poster-image-layer">
      <img 
        data-src={posterUrl}
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 450'%3E%3Crect fill='%231a1d2e' width='300' height='450'/%3E%3C/svg%3E"
        alt={item.title}
        class="poster-image lazy-img"
        loading="lazy"
      />
    </div>
    
    {#if rating}
      <div style="position: absolute; top: 0.75rem; right: 0.75rem; z-index: 2; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(8px); padding: 0.35rem 0.6rem; border-radius: 6px; display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; font-weight: 600;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffd700">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
        <span style="color: #ffd700;">{rating}</span>
      </div>
    {/if}
    
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="play-icon-layer" data-id={item.id} on:click={handleClick}>
      <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
      <div class="play-icon-outer"></div>
      <div class="play-icon-background"></div>
    </div>
    
    {#if showProgress && progressPercent > 0}
      <div class="progress-bar-layer">
        <div class="progress-bar-background"></div>
        <div class="progress-bar" style="width: {progressPercent}%"></div>
      </div>
    {/if}
    
    {#if item.watched}
      <div class="watched-icon-layer">
        <svg class="watched-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      </div>
    {/if}
  </div>
  
  <div class="title-bar-container">
    <div class="title-label">
      {item.title}
      {#if item.year}
        <span style="opacity: 0.5; font-weight: 400; margin-left: 0.25rem;">({item.year})</span>
      {/if}
    </div>
  </div>
</div>
