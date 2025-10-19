<script lang="ts">
  import { castingStore, hasActiveSession, currentDevice } from '@/stores/castingStore';
  import { onMount, onDestroy } from 'svelte';

  export let currentMediaUrl: string = '';
  export let currentTitle: string = '';
  export let compact: boolean = false;

  let cleanup: (() => void) | null = null;

  onMount(async () => {
    // Load existing devices and sessions
    await castingStore.getDevices();
    await castingStore.getSessions();
  });

  onDestroy(() => {
    if (cleanup) cleanup();
  });

  function handleCastClick() {
    if ($hasActiveSession) {
      // Show controls or stop casting
      castingStore.stopCasting();
    } else {
      // Open device picker
      castingStore.openDevicePicker();
      // Start discovering devices
      castingStore.discoverDevices(5);
    }
  }

  function getProtocolIcon(protocol: string): string {
    switch (protocol) {
      case 'chromecast':
        return '📺';
      case 'dlna':
        return '🖥️';
      case 'airplay':
        return '📱';
      default:
        return '📡';
    }
  }
</script>

<button
  class="cast-button"
  class:compact
  class:active={$hasActiveSession}
  on:click={handleCastClick}
  title={$hasActiveSession ? `Casting to ${$currentDevice?.name || 'device'}` : 'Cast to device'}
>
  {#if $hasActiveSession && $currentDevice}
    <span class="cast-icon active">
      {getProtocolIcon($currentDevice.protocol)}
    </span>
    {#if !compact}
      <span class="cast-label">
        {$currentDevice.name}
      </span>
    {/if}
  {:else}
    <span class="cast-icon">📡</span>
    {#if !compact}
      <span class="cast-label">Cast</span>
    {/if}
  {/if}
</button>

<style>
  .cast-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--surface-2, #2a2a2a);
    border: 1px solid var(--border-color, #444);
    border-radius: 0.5rem;
    color: var(--text-color, #e0e0e0);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cast-button:hover {
    background: var(--surface-3, #333);
    border-color: var(--primary-color, #4CAF50);
    transform: translateY(-1px);
  }

  .cast-button:active {
    transform: translateY(0);
  }

  .cast-button.active {
    background: var(--primary-color, #4CAF50);
    border-color: var(--primary-color, #4CAF50);
    color: white;
  }

  .cast-button.active:hover {
    background: var(--primary-hover, #45a049);
  }

  .cast-button.compact {
    padding: 0.4rem;
    min-width: 2.5rem;
    justify-content: center;
  }

  .cast-icon {
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cast-icon.active {
    animation: pulse 2s infinite;
  }

  .cast-label {
    font-weight: 500;
    white-space: nowrap;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }

  /* Compact mode adjustments */
  .cast-button.compact .cast-label {
    display: none;
  }
</style>
