<script lang="ts">
  import { onMount } from 'svelte';
  import { addonStore } from '@/stores/addonStore';

  onMount(() => {
    if ($addonStore.storeAddons.length === 0) {
      addonStore.loadStoreAddons();
    }
  });
</script>

<div class="addon-catalog">
  {#if $addonStore.loading}
    <div class="loading-state">Loading addon catalog...</div>
  {:else if $addonStore.error}
    <div class="error-state">{$addonStore.error}</div>
  {:else}
    <div class="addon-grid">
      {#each $addonStore.storeAddons as addon (addon.id)}
        <div class="addon-card">
          <div class="addon-header">
            <h3>{addon.name}</h3>
            <span class="addon-version">v{addon.version}</span>
          </div>
          <p class="addon-description">{addon.description}</p>
          <div class="addon-actions">
            <button class="btn btn-primary" on:click={() => addonStore.installAddon(addon.manifest.id)}>Install</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Styles remain largely the same, but are simplified as an example */
  .addon-catalog { padding: 20px; }
  .loading-state, .error-state { padding: 16px; color: var(--text-secondary); }
  .addon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
  .addon-card { border: 1px solid var(--border-color); border-radius: 10px; padding: 16px; background: var(--background-secondary); }
  .addon-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .addon-description { color: var(--text-secondary); margin: 8px 0; }
  .addon-actions { display: flex; gap: 8px; margin-top: 8px; }
</style>