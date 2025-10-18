import { invoke } from '@tauri-apps/api/core';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: ${id}`);
  return el as T;
}

function setOutput(value: unknown): void {
  const pre = byId<HTMLPreElement>('output');
  try {
    pre.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch (_e) {
    pre.textContent = String(value);
  }
}

async function checkAddons(): Promise<void> {
  try {
    const addons = await invoke('get_addons');
    setOutput({ ok: true, addons });
  } catch (e) {
    setOutput({ ok: false, error: String(e) });
  }
}

async function loadLibrary(): Promise<void> {
  try {
    const items = await invoke('get_library_items');
    setOutput({ ok: true, count: Array.isArray(items) ? items.length : undefined, items });
  } catch (e) {
    setOutput({ ok: false, error: String(e) });
  }
}

async function performSearch(): Promise<void> {
  const q = (document.getElementById('search-query') as HTMLInputElement | null)?.value?.trim();
  if (!q) {
    setOutput('Enter a search query');
    return;
  }
  try {
    const items = await invoke('search_content', { query: q });
    setOutput({ ok: true, results: items });
  } catch (e) {
    setOutput({ ok: false, error: String(e) });
  }
}

function main(): void {
  const btnAddons = document.getElementById('btn-addons') as HTMLButtonElement | null;
  const btnLibrary = document.getElementById('btn-library') as HTMLButtonElement | null;
  const btnSearch = document.getElementById('btn-search') as HTMLButtonElement | null;

  btnAddons?.addEventListener('click', () => { void checkAddons(); });
  btnLibrary?.addEventListener('click', () => { void loadLibrary(); });
  btnSearch?.addEventListener('click', () => { void performSearch(); });
}

document.addEventListener('DOMContentLoaded', main);

import { check as checkForUpdate } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import '../ui-utils';
import '../styles.css';
import { StreamGoApp } from '../app';
import { createPlayer } from '../player';
import { ExternalPlayerManager } from '../external-player';
import { diagnosticsManager } from '../diagnostics';
import { PlaylistManager } from '../playlists';
import { AddonStore } from '../addon-store';
import { initOnboarding } from '../onboarding';
import { ContextMenuManager } from '../context-menu';

async function checkForUpdates() {
  try {
    console.log('Checking for updates...');
    
    const update = await checkForUpdate();

    if (update?.available) {
      console.log(`Update available: ${update.currentVersion} -> ${update.version}`);
      
      const notification = document.getElementById('update-notification');
      const versionEl = document.getElementById('update-version');
      const installBtn = document.getElementById('update-now-btn') as HTMLButtonElement;
      const dismissBtn = document.getElementById('update-dismiss-btn') as HTMLButtonElement;

      if (notification && versionEl && installBtn && dismissBtn) {
        versionEl.textContent = `v${update.version}`;
        notification.style.display = 'flex';
        notification.classList.add('show');

        installBtn.addEventListener('click', async () => {
          try {
            console.log('Downloading and installing update...');
            installBtn.textContent = 'Installing...';
            installBtn.disabled = true;
            
            await update.downloadAndInstall();
            
            console.log('Update installed, relaunching...');
            await relaunch();
          } catch (error) {
            console.error('Failed to install update:', error);
            installBtn.textContent = 'Update Failed';
            installBtn.disabled = false;
          }
        });

        dismissBtn.addEventListener('click', () => {
          notification.classList.remove('show');
        });
      }
    } else {
      console.log('App is up to date');
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // If minimal page without full UI, skip heavy init
  const hasPlayerUI = !!document.getElementById('video-player') && !!document.getElementById('video-player-container');
  if (!hasPlayerUI) {
    try { await checkForUpdates(); } catch {}
    return;
  }

  // Check for updates on startup
  checkForUpdates();

  const app = new StreamGoApp();
  
  // Initialize external player manager (global scope)
  const externalPlayerManager = new ExternalPlayerManager();
  
  // Initialize video player
  const playerContainer = document.getElementById('video-player-container') as HTMLElement;
  const video = document.getElementById('video-player') as HTMLVideoElement;
  
  if (playerContainer && video) {
    const player = createPlayer({
      container: playerContainer,
      video: video,
      onClose: () => {
        console.log('Player closed');
      }
    });
    
    // Make player globally available
    (window as any).player = player;
    
    // Setup PiP button
    const pipBtn = document.getElementById('pip-btn');
    if (pipBtn) {
      pipBtn.addEventListener('click', () => {
        player.togglePictureInPicture();
      });
    }
    
    // Initialize external player manager
    await externalPlayerManager.init();
    
    // Setup external player button
    const externalPlayerBtn = document.getElementById('external-player-btn');
    if (externalPlayerBtn) {
      externalPlayerManager.updateButtonState(externalPlayerBtn);
      externalPlayerBtn.addEventListener('click', () => {
        externalPlayerManager.openInExternalPlayer();
      });
    }
  }
  
  // Make app and managers globally available
  (window as any).app = app;
  (window as any).externalPlayerManager = externalPlayerManager;
  (window as any).diagnosticsManager = diagnosticsManager;

  // Bind global UI actions (removed inline handlers)
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle?.addEventListener('click', () => (window as any).app?.toggleTheme());

  const startSearchBtn = document.getElementById('start-searching-btn');
  startSearchBtn?.addEventListener('click', () => (window as any).app?.showSection('search'));

  const detailBackBtn = document.getElementById('detail-back-btn');
  detailBackBtn?.addEventListener('click', () => (window as any).app?.goBack());

  const closePlayerBtn = document.getElementById('close-player-btn');
  closePlayerBtn?.addEventListener('click', () => (window as any).app?.closePlayer());

  const settingsSave = document.getElementById('settings-save-btn');
  settingsSave?.addEventListener('click', () => (window as any).app?.saveSettings());
  const settingsReset = document.getElementById('settings-reset-btn');
  settingsReset?.addEventListener('click', () => (window as any).app?.resetSettings());
  const settingsClear = document.getElementById('settings-clear-cache-btn');
  settingsClear?.addEventListener('click', () => (window as any).app?.clearCache());
  
  const exportDataBtn = document.getElementById('export-data-btn');
  exportDataBtn?.addEventListener('click', () => (window as any).app?.exportUserData());
  const importDataBtn = document.getElementById('import-data-btn');
  importDataBtn?.addEventListener('click', () => (window as any).app?.triggerImportDialog());
  const importDataFile = document.getElementById('import-data-file') as HTMLInputElement;
  importDataFile?.addEventListener('change', (e) => (window as any).app?.importUserData(e));
  
  const checkEpisodesBtn = document.getElementById('check-episodes-now-btn');
  checkEpisodesBtn?.addEventListener('click', () => (window as any).app?.checkNewEpisodes());
  
  // Initialize playlist manager
  const playlistManager = new PlaylistManager();
  window.playlistManager = playlistManager;
  
  // Initialize context menu manager
  const contextMenuManager = new ContextMenuManager();
  (window as any).contextMenuManager = contextMenuManager;
  
  // Initialize addon store
  const addonStore = new AddonStore();
  (window as any).addonStore = addonStore;
  
  // Initialize onboarding (will show on first launch)
  const onboarding = initOnboarding();
  (window as any).onboarding = onboarding;
  
  console.log('✅ All managers initialized:', {
    app: !!(window as any).app,
    externalPlayerManager: !!(window as any).externalPlayerManager,
    diagnosticsManager: !!(window as any).diagnosticsManager,
    playlistManager: !!window.playlistManager,
    addonStore: !!(window as any).addonStore,
    onboarding: !!onboarding
  });
  
  // Listen for media click events from Svelte components
  window.addEventListener('streamgo:media-click', ((event: CustomEvent) => {
    const { mediaId, item } = event.detail;
    console.log('Media clicked from Svelte:', mediaId);
    
    // Store media item in the app's mediaMap for compatibility
    if ((window as any).app && item) {
      if (!(window as any).app.mediaMap) {
        (window as any).app.mediaMap = {};
      }
      (window as any).app.mediaMap[mediaId] = item;
    }
    
    // Navigate to detail view
    if ((window as any).app?.showMediaDetail) {
      (window as any).app.showMediaDetail(mediaId);
    }
  }) as EventListener);
});
