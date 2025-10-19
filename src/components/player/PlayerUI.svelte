<script lang="ts">
  import { playerStore } from '@/stores/player';
  import QualitySelector from './QualitySelector.svelte';
  import SubtitleControls from './SubtitleControls.svelte';
  import PlayerStats from './PlayerStats.svelte';
  import { invoke } from '@tauri-apps/api/core';
  
  let editing = false;
  let introStart: number | null = null;
  let introEnd: number | null = null;
  let outroStart: number | null = null;
  let outroEnd: number | null = null;

  function currentTime(): number {
    const v = document.getElementById('video-player') as HTMLVideoElement | null;
    return v?.currentTime || 0;
  }

  function applyFromStore() {
    const segs = $playerStore.skipSegments;
    introStart = segs.intro?.start ?? null;
    introEnd = segs.intro?.end ?? null;
    outroStart = segs.outro?.start ?? null;
    outroEnd = segs.outro?.end ?? null;
  }

  $: applyFromStore();
  
  async function saveSkips() {
    try {
      const payload: any = {
        intro_start: introStart,
        intro_end: introEnd,
        outro_start: outroStart,
        outro_end: outroEnd,
      };
      const mediaId = (window as any).player?.getCurrentMediaId?.() || $playerStore?.currentMediaId;
      if (!mediaId) return;
      await invoke('save_skip_segments', { mediaId, segments: payload });
      // Update store
      const segs: any = {};
      if (introStart != null && introEnd != null) segs.intro = { start: introStart, end: introEnd };
      if (outroStart != null && outroEnd != null) segs.outro = { start: outroStart, end: outroEnd };
      playerStore.setSkipSegments(segs);
      editing = false;
      (window as any).Toast?.success?.('Skip segments saved');
    } catch (e) {
      (window as any).Toast?.error?.('Failed to save skip segments');
    }
  }
  
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

<!-- Skip Intro/Credits Overlay -->
{#if $playerStore.activeSkip}
  <div class="skip-overlay">
    <button class="skip-btn" on:click={() => (window as any).player?.skipActiveSegment?.()}>
      {#if $playerStore.activeSkip.type === 'intro'}
        Skip Intro
      {:else}
        Skip Credits
      {/if}
    </button>
    <button class="edit-btn" on:click={() => { editing = !editing; }}>Edit Skips</button>
  </div>
{/if}

<!-- Skip Segments Editor -->
{#if editing}
  <div class="skip-editor">
    <div class="row">
      <strong>Intro</strong>
      <div class="field">
        <label>Start</label>
        <input type="number" step="0.1" bind:value={introStart} />
        <button class="btn" on:click={() => introStart = Math.round(currentTime()*10)/10}>Set from current</button>
      </div>
      <div class="field">
        <label>End</label>
        <input type="number" step="0.1" bind:value={introEnd} />
        <button class="btn" on:click={() => introEnd = Math.round(currentTime()*10)/10}>Set from current</button>
      </div>
    </div>
    <div class="row">
      <strong>Outro</strong>
      <div class="field">
        <label>Start</label>
        <input type="number" step="0.1" bind:value={outroStart} />
        <button class="btn" on:click={() => outroStart = Math.round(currentTime()*10)/10}>Set from current</button>
      </div>
      <div class="field">
        <label>End</label>
        <input type="number" step="0.1" bind:value={outroEnd} />
        <button class="btn" on:click={() => outroEnd = Math.round(currentTime()*10)/10}>Set from current</button>
      </div>
    </div>
    <div class="row actions">
      <button class="btn btn-secondary" on:click={() => { editing = false; }}>Cancel</button>
      <button class="btn btn-primary" on:click={saveSkips}>Save</button>
    </div>
  </div>
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

.skip-overlay {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 120;
}

.skip-btn {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 8px 12px;
  border-radius: 6px;
  font-weight: 600;
}
  
  .edit-btn { margin-left: 8px; background: rgba(0,0,0,0.6); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 6px 10px; border-radius: 6px; }

  .skip-editor {
    position: absolute;
    top: 60px;
    right: 20px;
    z-index: 130;
    background: rgba(0,0,0,0.9);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 8px;
    padding: 12px;
    width: 360px;
    color: white;
  }
  .skip-editor .row { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
  .skip-editor .field { display: flex; align-items: center; gap: 6px; }
  .skip-editor input { width: 90px; padding: 4px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.4); color: white; }
  .skip-editor .actions { justify-content: flex-end; }

  .control-label {
    color: white;
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    opacity: 0.9;
  }
</style>
