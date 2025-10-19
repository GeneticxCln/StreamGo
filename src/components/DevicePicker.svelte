<script lang="ts">
  import { castingStore, dlnaDevices, chromecastDevices, startDeviceRefresh } from '@/stores/castingStore';
  import { onMount, onDestroy } from 'svelte';
  import type { CastDevice } from '../types/tauri';

  export let mediaUrl: string = '';
  export let title: string = '';
  export let subtitleUrl: string = '';

  let stopRefresh: (() => void) | null = null;

  onMount(() => {
    // Start auto-refresh
    stopRefresh = startDeviceRefresh();
  });

  onDestroy(() => {
    if (stopRefresh) stopRefresh();
  });

  function handleClose() {
    castingStore.closeDevicePicker();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  async function handleDeviceSelect(device: CastDevice) {
    try {
      await castingStore.startCasting(
        device.id,
        mediaUrl,
        title,
        subtitleUrl || undefined
      );
    } catch (error) {
      console.error('Failed to start cast:', error);
    }
  }

  async function handleRefresh() {
    await castingStore.discoverDevices(5);
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

  function getProtocolLabel(protocol: string): string {
    switch (protocol) {
      case 'chromecast':
        return 'Chromecast';
      case 'dlna':
        return 'DLNA';
      case 'airplay':
        return 'AirPlay';
      default:
        return 'Unknown';
    }
  }
</script>

{#if $castingStore.showDevicePicker}
  <div class="device-picker-backdrop" on:click={handleBackdropClick}>
    <div class="device-picker">
      <div class="picker-header">
        <h2>Cast to Device</h2>
        <button class="close-button" on:click={handleClose}>✕</button>
      </div>

      <div class="picker-content">
        {#if $castingStore.isDiscovering}
          <div class="discovering">
            <div class="spinner"></div>
            <p>Discovering devices on network...</p>
          </div>
        {:else if $castingStore.error}
          <div class="error">
            <p>{$castingStore.error}</p>
            <button class="retry-button" on:click={handleRefresh}>
              Try Again
            </button>
          </div>
        {:else if $castingStore.devices.length === 0}
          <div class="empty">
            <p>No devices found on network</p>
            <button class="refresh-button" on:click={handleRefresh}>
              🔄 Refresh
            </button>
          </div>
        {:else}
          <div class="device-list">
            {#if $dlnaDevices.length > 0}
              <div class="device-group">
                <h3>DLNA Devices</h3>
                {#each $dlnaDevices as device}
                  <button
                    class="device-item"
                    class:unavailable={device.status !== 'available'}
                    on:click={() => handleDeviceSelect(device)}
                    disabled={device.status !== 'available'}
                  >
                    <div class="device-icon">
                      {getProtocolIcon(device.protocol)}
                    </div>
                    <div class="device-info">
                      <div class="device-name">{device.name}</div>
                      <div class="device-details">
                        {device.manufacturer || 'Unknown'} • {device.ip_address}
                      </div>
                    </div>
                    <div class="device-status">
                      {device.status}
                    </div>
                  </button>
                {/each}
              </div>
            {/if}

            {#if $chromecastDevices.length > 0}
              <div class="device-group">
                <h3>Chromecast Devices</h3>
                {#each $chromecastDevices as device}
                  <button
                    class="device-item"
                    class:unavailable={device.status !== 'available'}
                    on:click={() => handleDeviceSelect(device)}
                    disabled={device.status !== 'available'}
                  >
                    <div class="device-icon">
                      {getProtocolIcon(device.protocol)}
                    </div>
                    <div class="device-info">
                      <div class="device-name">{device.name}</div>
                      <div class="device-details">
                        {device.model || 'Chromecast'} • {device.ip_address}
                      </div>
                    </div>
                    <div class="device-status">
                      {device.status}
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="picker-footer">
        <button class="refresh-button" on:click={handleRefresh} disabled={$castingStore.isDiscovering}>
          🔄 Refresh Devices
        </button>
        <button class="cancel-button" on:click={handleClose}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .device-picker-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .device-picker {
    background: var(--surface-1, #1e1e1e);
    border-radius: 1rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .picker-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-color, #e0e0e0);
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--text-muted, #888);
    cursor: pointer;
    padding: 0.25rem;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: var(--surface-2, #2a2a2a);
    color: var(--text-color, #e0e0e0);
  }

  .picker-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    min-height: 200px;
  }

  .discovering, .error, .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
    color: var(--text-muted, #888);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--surface-3, #333);
    border-top-color: var(--primary-color, #4CAF50);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .device-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .device-group h3 {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted, #888);
  }

  .device-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--surface-2, #2a2a2a);
    border: 1px solid var(--border-color, #444);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
    width: 100%;
    text-align: left;
  }

  .device-item:hover:not(:disabled) {
    background: var(--surface-3, #333);
    border-color: var(--primary-color, #4CAF50);
    transform: translateX(4px);
  }

  .device-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .device-item.unavailable {
    opacity: 0.6;
  }

  .device-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .device-info {
    flex: 1;
  }

  .device-name {
    font-weight: 600;
    color: var(--text-color, #e0e0e0);
    margin-bottom: 0.25rem;
  }

  .device-details {
    font-size: 0.875rem;
    color: var(--text-muted, #888);
  }

  .device-status {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--primary-color, #4CAF50);
  }

  .picker-footer {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-color, #333);
  }

  .refresh-button, .cancel-button, .retry-button {
    padding: 0.6rem 1.25rem;
    border-radius: 0.5rem;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
  }

  .refresh-button {
    background: var(--surface-2, #2a2a2a);
    color: var(--text-color, #e0e0e0);
    border: 1px solid var(--border-color, #444);
  }

  .refresh-button:hover:not(:disabled) {
    background: var(--surface-3, #333);
    border-color: var(--primary-color, #4CAF50);
  }

  .refresh-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cancel-button {
    background: transparent;
    color: var(--text-muted, #888);
  }

  .cancel-button:hover {
    color: var(--text-color, #e0e0e0);
    background: var(--surface-2, #2a2a2a);
  }

  .retry-button {
    margin-top: 1rem;
    background: var(--primary-color, #4CAF50);
    color: white;
  }

  .retry-button:hover {
    background: var(--primary-hover, #45a049);
  }

  .error p {
    color: var(--error-color, #f44336);
    margin-bottom: 0.5rem;
  }
</style>
