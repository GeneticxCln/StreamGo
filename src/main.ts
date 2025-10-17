import { check as checkForUpdate } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import './ui-utils';
import './styles.css';
import { StreamGoApp } from './app';
import { createPlayer } from './player';
import { PlaylistManager } from './playlists';
import { externalPlayerManager } from './external-player';
import { diagnosticsManager } from './diagnostics';
import './addon-store'; // Addon store UI and functionality
import { AddonStore } from './addon-store';

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
  // Check for updates on startup
  checkForUpdates();

  const app = new StreamGoApp();
  
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
  
  // Make app and external player manager globally available
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
  
  // Initialize playlist manager
  const playlistManager = new PlaylistManager();
  window.playlistManager = playlistManager;
  
  // Initialize addon store
  const addonStore = new AddonStore();
  (window as any).addonStore = addonStore;
  
  console.log('✅ All managers initialized:', {
    app: !!(window as any).app,
    externalPlayerManager: !!(window as any).externalPlayerManager,
    diagnosticsManager: !!(window as any).diagnosticsManager,
    playlistManager: !!window.playlistManager,
    addonStore: !!(window as any).addonStore
  });
});
