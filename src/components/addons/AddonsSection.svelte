<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import AddonCatalog from '../AddonCatalog.svelte';

  type Addon = {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    enabled: boolean;
  };

  let activeTab: 'installed' | 'store' = 'installed';
  let installed: Addon[] = [];
  let loading = true;
  let error: string | null = null;

  async function loadInstalled() {
    loading = true;
    error = null;
    try {
      installed = await invoke<Addon[]>('get_addons');
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  async function enableAddon(id: string) {
    await invoke('enable_addon', { addonId: id });
    await loadInstalled();
  }

  async function disableAddon(id: string) {
    await invoke('disable_addon', { addonId: id });
    await loadInstalled();
  }

  async function uninstallAddon(id: string) {
    await invoke('uninstall_addon', { addonId: id });
    await loadInstalled();
  }

  onMount(loadInstalled);
</script>

<div class="addons-section">
  <div class="addons-header">
    <h2>Add-ons</h2>
    <div class="tabs">
      <button class="tab-btn {activeTab === 'installed' ? 'active' : ''}" on:click={() => activeTab = 'installed'}>Installed</button>
      <button class="tab-btn {activeTab === 'store' ? 'active' : ''}" on:click={() => activeTab = 'store'}>Discover Store</button>
    </div>
  </div>

  {#if activeTab === 'installed'}
    {#if loading}
      <div class="loading-state">Loading add-ons...</div>
    {:else if error}
      <div class="error-state">{error}</div>
    {:else if installed.length === 0}
      <div class="empty-message">No add-ons installed. Switch to the store tab to install.</div>
    {:else}
      <div class="addons-grid">
        {#each installed as addon}
          <div class="addon-card">
            <div class="addon-header">
              <div class="addon-title-group">
                <h3>{addon.name}</h3>
                <span class="addon-version">v{addon.version}</span>
              </div>
              <span class="addon-status {addon.enabled ? 'enabled' : 'disabled'}">{addon.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <p class="addon-description">{addon.description}</p>
            <div class="addon-meta">By {addon.author}</div>
            <div class="addon-actions">
              {#if addon.enabled}
                <button class="btn btn-secondary" on:click={() => disableAddon(addon.id)}>Disable</button>
              {:else}
                <button class="btn btn-secondary" on:click={() => enableAddon(addon.id)}>Enable</button>
              {/if}
              <button class="btn btn-danger" on:click={() => uninstallAddon(addon.id)}>Uninstall</button>
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
  .addons-section { padding: 20px; }
  .addons-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .tabs { display: flex; gap: 8px; }
  .tab-btn { padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--background-secondary); color: var(--text-primary); }
  .tab-btn.active { border-color: var(--primary-color); }
  .loading-state, .error-state, .empty-message { padding: 16px; color: var(--text-secondary); }
  .addons-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
  .addon-card { border: 1px solid var(--border-color); border-radius: 10px; padding: 16px; background: var(--background-secondary); }
  .addon-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .addon-title-group { display: flex; gap: 8px; align-items: baseline; }
  .addon-version { color: var(--text-secondary); font-size: 0.9rem; }
  .addon-status.enabled { color: #3ecf8e; }
  .addon-status.disabled { color: #e07a5f; }
  .addon-description { color: var(--text-secondary); margin: 8px 0; }
  .addon-actions { display: flex; gap: 8px; margin-top: 8px; }
</style>