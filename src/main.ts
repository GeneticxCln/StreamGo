// import { relaunch } from '@tauri-apps/plugin-process'; // TODO: Re-enable when updater API is fixed
import './ui-utils';
import './styles.css';
import { StreamGoApp } from './app';
import { createPlayer } from './player';
import { PlaylistManager } from './playlists';
import { externalPlayerManager } from './external-player';
import { diagnosticsManager } from './diagnostics';
import './addon-store'; // Addon store UI and functionality

async function checkForUpdates() {
  try {
    console.log('Updater temporarily disabled - Tauri 2.x API needs research');
    console.log('To re-enable: Check Tauri 2.x updater plugin documentation');

    // TODO: Implement proper Tauri 2.x updater API
    // The API has changed significantly from 1.x to 2.x
    // Need to research: https://tauri.app/v2/guides/distribution/updater/

    /*
    // Placeholder for correct Tauri 2.x updater implementation:
    const update = await check(); // or similar function

    if (update?.available) {
      const notification = document.getElementById('update-notification');
      const versionEl = document.getElementById('update-version');
      const installBtn = document.getElementById('update-now-btn');
      const dismissBtn = document.getElementById('update-dismiss-btn');

      if (notification && versionEl && installBtn && dismissBtn) {
        versionEl.textContent = `v${update.latest?.version}`;
        notification.style.display = 'flex';
        notification.classList.add('show');

        installBtn.addEventListener('click', async () => {
          await install();
          await relaunch();
        });

        dismissBtn.addEventListener('click', () => {
          notification.classList.remove('show');
        });
      }
    }
    */
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
  
  // Initialize playlist manager
  const playlistManager = new PlaylistManager();
  window.playlistManager = playlistManager;
  
  console.log('✅ All managers initialized:', {
    app: !!(window as any).app,
    externalPlayerManager: !!(window as any).externalPlayerManager,
    diagnosticsManager: !!(window as any).diagnosticsManager,
    playlistManager: !!window.playlistManager
  });
});
