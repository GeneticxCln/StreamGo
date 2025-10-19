<script lang="ts">
  import { onMount } from 'svelte';
  import { addonStore } from '@/stores/addonStore';
  import AddonCatalog from '../AddonCatalog.svelte';

  let activeTab: 'installed' | 'store' = 'installed';
  let manifestUrl = '';

  onMount(() => {
    if ($addonStore.installedAddons.length === 0) {
      addonStore.loadInstalledAddons();
    }
  });

  function handleInstallFromUrl() {
    if (!manifestUrl.trim()) return;
    addonStore.installAddon(manifestUrl.trim());
    manifestUrl = '';
  }
</script>

<div class="addons-section">
  <div class="addons-header">
    <h2>Add-ons</h2>
    <div class="tabs">
      <button class="tab-btn" class:active={activeTab === 'installed'} on:click={() => activeTab = 'installed'}>Installed</button>
      <button class="tab-btn" class:active={activeTab === 'store'} on:click={() => activeTab = 'store'}>Discover</button>
    </div>
  </div>

  {#if activeTab === 'installed'}
    <div class="install-from-url">
        <input type="text" bind:value={manifestUrl} placeholder="https://.../manifest.json" />
        <button class="btn btn-primary" on:click={handleInstallFromUrl}>Install from URL</button>
    </div>
    {#if $addonStore.loading}
      <div class="loading-state">Loading installed add-ons...</div>
    {:else if $addonStore.error}
      <div class="error-state">{$addonStore.error}</div>
    {:else if $addonStore.installedAddons.length === 0}
      <div class="empty-message">No add-ons installed.</div>
    {:else}
      <div class="addons-grid">
        {#each $addonStore.installedAddons as addon (addon.id)}
          <div class="addon-card">
            <div class="addon-header">
              <h3>{addon.name}</h3>
              <span class="addon-version">v{addon.version}</span>
            </div>
            <p class="addon-description">{addon.description}</p>
            <div class="addon-actions">
              <button class="btn btn-danger" on:click={() => addonStore.uninstallAddon(addon.id)}>Uninstall</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <AddonCatalog />
  {/if}
</div>

<style>
  .install-from-url {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }
  .install-from-url input {
    flex-grow: 1;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: var(--background-secondary);
    color: var(--text-primary);
  }
</style>