// Lazy loading utility
const setupLazyLoading = () => {
  const images = document.querySelectorAll('img[data-src]');
  
  if (!('IntersectionObserver' in window)) {
    images.forEach(img => {
      if (img.dataset.src) img.src = img.dataset.src;
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const tempImg = new Image();
        tempImg.onload = () => {
          img.src = img.dataset.src;
          img.classList.add('lazy-loaded');
          observer.unobserve(img);
        };
        tempImg.onerror = () => {
          img.src = 'https://via.placeholder.com/500x750.png?text=Error';
          observer.unobserve(img);
        };
        tempImg.src = img.dataset.src;
      }
    });
  }, { rootMargin: '50px' });

  images.forEach(img => observer.observe(img));
};

document.addEventListener('DOMContentLoaded', () => {
  const mediaItem = JSON.parse(sessionStorage.getItem('selectedMedia'));
  if (mediaItem) {
    const posterImg = document.querySelector('.detail-poster img');
    if (mediaItem.poster_url) {
      posterImg.dataset.src = mediaItem.poster_url;
      posterImg.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 300 450\'%3E%3Crect fill=\'%232a2a2a\' width=\'300\' height=\'450\'/%3E%3C/svg%3E';
    } else {
      posterImg.dataset.src = 'https://via.placeholder.com/500x750.png?text=No+Image';
      posterImg.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 300 450\'%3E%3Crect fill=\'%232a2a2a\' width=\'300\' height=\'450\'/%3E%3C/svg%3E';
    }
    posterImg.alt = mediaItem.title;
    document.querySelector('.detail-title').textContent = mediaItem.title;
    document.querySelector('.detail-description').textContent = mediaItem.description;
    
    // Initialize lazy loading
    setupLazyLoading();

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