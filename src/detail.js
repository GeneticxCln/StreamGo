document.addEventListener('DOMContentLoaded', () => {
  const mediaItem = JSON.parse(sessionStorage.getItem('selectedMedia'));
  if (mediaItem) {
    if (mediaItem.poster_url) {
      document.querySelector('.detail-poster img').src = mediaItem.poster_url;
    } else {
      document.querySelector('.detail-poster img').src = 'https://via.placeholder.com/500x750.png?text=No+Image';
    }
    document.querySelector('.detail-poster img').alt = mediaItem.title;
    document.querySelector('.detail-title').textContent = mediaItem.title;
    document.querySelector('.detail-description').textContent = mediaItem.description;

    document.getElementById('play-button').addEventListener('click', () => {
      if (typeof window.__TAURI__ !== 'undefined') {
        window.__TAURI__.invoke('get_stream_url', { contentId: mediaItem.id })
        .then(streamUrl => {
            const videoModal = document.getElementById('video-player-modal');
            const videoPlayer = document.getElementById('main-video-player');
            
            videoPlayer.src = streamUrl;
            videoModal.style.display = 'flex';
            videoPlayer.play();
        })
        .catch(err => {
            console.error('Error getting stream URL:', err);
            if (window.Toast && typeof window.Toast.error === 'function') {
              window.Toast.error(`Error getting stream URL: ${err}`);
            } else {
              // Fallback if Toast is not available
              const el = document.createElement('div');
              el.className = 'toast error';
              el.textContent = `Error getting stream URL: ${err}`;
              document.body.appendChild(el);
              setTimeout(() => el.remove(), 4000);
            }
        });
      } else {
        const mockVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        const videoModal = document.getElementById('video-player-modal');
        const videoPlayer = document.getElementById('main-video-player');
        
        videoPlayer.src = mockVideoUrl;
        videoModal.style.display = 'flex';
        videoPlayer.play();
      }
    });

    document.getElementById('back-button').addEventListener('click', () => {
      window.history.back();
    });
  }
});