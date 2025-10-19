<script lang="ts">
  import { onMount } from 'svelte';
  import { check as checkForUpdate, type Update } from '@tauri-apps/plugin-updater';
  import { relaunch } from '@tauri-apps/plugin-process';

  let update: Update | null = null;
  let isInstalling = false;
  let showNotification = false;

  onMount(async () => {
    try {
      console.log('Checking for updates...');
      const updateResult = await checkForUpdate();
      if (updateResult?.available) {
        console.log(`Update available: ${updateResult.currentVersion} -> ${updateResult.version}`);
        update = updateResult;
        showNotification = true;
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  });

  async function installUpdate() {
    if (!update) return;
    isInstalling = true;
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (error) {
      console.error('Failed to install update:', error);
      isInstalling = false;
    }
  }

  function dismiss() {
    showNotification = false;
  }
</script>

{#if showNotification && update}
  <div class="update-notification show">
    <p>A new version of StreamGo is available! <span>v{update.version}</span></p>
    <div class="update-actions">
      <button class="btn btn-primary" on:click={installUpdate} disabled={isInstalling}>
        {isInstalling ? 'Installing...' : 'Install Now'}
      </button>
      <button class="btn btn-secondary" on:click={dismiss}>Later</button>
    </div>
  </div>
{/if}


