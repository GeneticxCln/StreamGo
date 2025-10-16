import './ui-utils';
import './styles.css';
import { StreamGoApp } from './app';
import { createPlayer } from './player';
import { PlaylistManager } from './playlists';
import { externalPlayerManager } from './external-player';
import { diagnosticsManager } from './diagnostics';
import './addon-store'; // Addon store UI and functionality

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
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
