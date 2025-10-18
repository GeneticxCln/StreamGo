<script lang="ts">
  import { playerStore } from '../../stores/player';
  import QualitySelector from './QualitySelector.svelte';
  import SubtitleControls from './SubtitleControls.svelte';
  import PlayerStats from './PlayerStats.svelte';
  
  function handleQualityChange(index: number) {
    const player = (window as any).player;
    if (!player) return;
    
    // Handle HLS quality change
    if (player.hls) {
      player.hls.currentLevel = index;
      playerStore.setCurrentQuality(index);
    }
    // Handle DASH quality change
    else if (player.dashPlayer) {
      player.dashPlayer.setQualityLevel(index);
      playerStore.setCurrentQuality(index);
    }
  }
  
  function handleSubtitleChange(index: number) {
    const player = (window as any).player;
    if (player) {
      if (index === -1) {
        player.disableSubtitles();
      } else {
        player.enableSubtitle(index);
      }
    }
  }
  
  function handleSubtitleOffsetChange(offset: number) {
    const player = (window as any).player;
    if (!player) return;
    
    // Update player's internal offset value
    player.subtitleOffset = offset;
    
    // Apply the offset
    player.applySubtitleOffset();
    
    // Update store
    playerStore.setSubtitleOffset(offset);
  }
  
  function handleLoadSubtitle() {
    document.getElementById('load-subtitle-btn')?.click();
  }
</script>

<!-- Quality Selector -->
{#if $playerStore.qualities.length > 1}
  <div class="player-control-overlay quality-overlay">
    <div class="control-label">Quality</div>
    <QualitySelector 
      qualities={$playerStore.qualities}
      currentQuality={$playerStore.currentQuality}
      onChange={handleQualityChange}
    />
  </div>
{/if}

<!-- Subtitle Controls -->
<div class="player-control-overlay subtitle-overlay">
  <div class="control-label">Subtitles</div>
  <SubtitleControls
    tracks={$playerStore.subtitleTracks}
    currentTrack={$playerStore.currentSubtitle}
    subtitleOffset={$playerStore.subtitleOffset}
    onTrackChange={handleSubtitleChange}
    onOffsetChange={handleSubtitleOffsetChange}
    onLoadSubtitle={handleLoadSubtitle}
  />
</div>

<!-- Stats Overlay -->
{#if $playerStore.stats}
  <PlayerStats 
    visible={$playerStore.showStats}
    stats={$playerStore.stats}
  />
{/if}

<style>
  .player-control-overlay {
    position: absolute;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(10px);
    padding: 1rem;
    border-radius: 8px;
    z-index: 100;
    pointer-events: auto;
  }
  
  .quality-overlay {
    bottom: 80px;
    right: 20px;
  }
  
  .subtitle-overlay {
    bottom: 80px;
    left: 20px;
  }
  
  .control-label {
    color: white;
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    opacity: 0.9;
  }
</style>
