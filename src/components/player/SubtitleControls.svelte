<script lang="ts">
  export let tracks: Array<{label: string; index: number; language?: string}> = [];
  export let currentTrack: number = -1;
  export let subtitleOffset: number = 0;
  export let onTrackChange: (index: number) => void;
  export let onOffsetChange: (offset: number) => void;
  export let onLoadSubtitle: () => void;

  function handleTrackSelect(index: number) {
    currentTrack = index;
    onTrackChange(index);
  }

  function adjustOffset(delta: number) {
    subtitleOffset += delta;
    onOffsetChange(subtitleOffset);
  }
</script>

<div class="subtitle-controls">
  <div class="subtitle-track-selector">
    <button 
      class="subtitle-btn"
      class:active={currentTrack === -1}
      on:click={() => handleTrackSelect(-1)}
    >
      Off
    </button>
    
    {#each tracks as track (track.index)}
      <button 
        class="subtitle-btn"
        class:active={currentTrack === track.index}
        on:click={() => handleTrackSelect(track.index)}
      >
        {track.label}
      </button>
    {/each}
    
    <button class="subtitle-btn load-btn" on:click={onLoadSubtitle}>
      + Load
    </button>
  </div>
  
  {#if currentTrack >= 0}
    <div class="subtitle-sync-controls">
      <button class="sync-btn" on:click={() => adjustOffset(-0.1)}>
        −0.1s
      </button>
      <span class="sync-display">{subtitleOffset.toFixed(1)}s</span>
      <button class="sync-btn" on:click={() => adjustOffset(0.1)}>
        +0.1s
      </button>
    </div>
  {/if}
</div>

<style>
  .subtitle-controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .subtitle-track-selector {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .subtitle-btn {
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.9rem;
  }
  
  .subtitle-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .subtitle-btn.active {
    background: var(--accent-color, #0066ff);
    border-color: var(--accent-color, #0066ff);
  }
  
  .subtitle-btn.load-btn {
    background: rgba(76, 175, 80, 0.2);
    border-color: rgba(76, 175, 80, 0.4);
  }
  
  .subtitle-btn.load-btn:hover {
    background: rgba(76, 175, 80, 0.3);
  }
  
  .subtitle-sync-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .sync-btn {
    padding: 0.35rem 0.75rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.85rem;
    font-family: monospace;
  }
  
  .sync-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .sync-display {
    color: white;
    font-family: monospace;
    font-size: 0.9rem;
    min-width: 3.5rem;
    text-align: center;
  }
</style>
