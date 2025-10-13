import './tauri-init';
import './ui-utils';
import './styles.css';
import { StreamGoApp } from './app';
import { createPlayer } from './player';
import { PlaylistManager } from './playlists';

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
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
  }
  
  // Make app globally available for onclick handlers (will be refactored later)
  (window as any).app = app;
  
  // Initialize playlist manager
  const playlistManager = new PlaylistManager();
  window.playlistManager = playlistManager;
});
