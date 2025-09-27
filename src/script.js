// StreamGo - Main JavaScript functionality

class StreamGoApp {
  constructor() {
    this.currentSection = 'home';
    this.theme = localStorage.getItem('theme') || 'auto';
    this.searchTimeout = null;
    this.mockData = this.generateMockData();
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.applyTheme();
    this.loadMockContent();
    this.setupTauriInvokes();
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const section = e.currentTarget.dataset.section;
        this.navigateToSection(section);
      });
    });

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
      this.toggleTheme();
    });

    // Search functionality
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.performSearch(e.target.value);
      }, 300);
    });

    document.querySelector('.search-button').addEventListener('click', () => {
      this.performSearch(searchInput.value);
    });

    // Library tabs
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        this.switchLibraryTab(tab);
      });
    });

    // Video player
    document.getElementById('close-player').addEventListener('click', () => {
      this.closeVideoPlayer();
    });

    // Settings
    document.getElementById('theme-select').addEventListener('change', (e) => {
      this.setTheme(e.target.value);
    });

    document.getElementById('add-addon').addEventListener('click', () => {
      this.showAddAddonDialog();
    });

    // Content item clicks
    document.addEventListener('click', (e) => {
      if (e.target.closest('.content-item')) {
        const contentItem = e.target.closest('.content-item');
        this.playContent(contentItem.dataset.id);
      }
    });
  }

  navigateToSection(section) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');

    // Update content sections
    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.remove('active');
    });
    document.getElementById(section).classList.add('active');

    this.currentSection = section;

    // Load section-specific content
    this.loadSectionContent(section);
  }

  loadSectionContent(section) {
    switch (section) {
      case 'home':
        this.loadHomeContent();
        break;
      case 'discover':
        this.loadDiscoverContent();
        break;
      case 'library':
        this.loadLibraryContent();
        break;
      case 'search':
        // Search content is loaded via search function
        break;
      case 'settings':
        this.loadSettingsContent();
        break;
    }
  }

  toggleTheme() {
    const newTheme = this.theme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  setTheme(theme) {
    this.theme = theme;
    localStorage.setItem('theme', theme);
    this.applyTheme();
    
    // Update theme select dropdown
    document.getElementById('theme-select').value = theme;
  }

  applyTheme() {
    const root = document.documentElement;
    const themeToggle = document.getElementById('theme-toggle');
    
    if (this.theme === 'dark' || 
        (this.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.setAttribute('data-theme', 'dark');
      themeToggle.textContent = '☀️';
    } else {
      root.removeAttribute('data-theme');
      themeToggle.textContent = '🌙';
    }
  }

  generateMockData() {
    const movies = [
      { id: 1, title: 'The Matrix', year: 1999, genre: 'Sci-Fi', poster: '🎬' },
      { id: 2, title: 'Inception', year: 2010, genre: 'Thriller', poster: '🎭' },
      { id: 3, title: 'Interstellar', year: 2014, genre: 'Sci-Fi', poster: '🚀' },
      { id: 4, title: 'The Dark Knight', year: 2008, genre: 'Action', poster: '🦇' },
      { id: 5, title: 'Pulp Fiction', year: 1994, genre: 'Drama', poster: '🔫' },
    ];

    const tvShows = [
      { id: 101, title: 'Breaking Bad', year: 2008, genre: 'Drama', poster: '⚗️' },
      { id: 102, title: 'Stranger Things', year: 2016, genre: 'Horror', poster: '👻' },
      { id: 103, title: 'The Office', year: 2005, genre: 'Comedy', poster: '📄' },
      { id: 104, title: 'Game of Thrones', year: 2011, genre: 'Fantasy', poster: '⚔️' },
      { id: 105, title: 'Friends', year: 1994, genre: 'Comedy', poster: '☕' },
    ];

    return { movies, tvShows };
  }

  loadMockContent() {
    this.loadHomeContent();
  }

  loadHomeContent() {
    // Continue watching (mix of movies and shows)
    const continueWatching = [...this.mockData.movies.slice(0, 2), ...this.mockData.tvShows.slice(0, 2)];
    this.renderContentRow('continue-watching', continueWatching);

    // Popular movies
    this.renderContentRow('popular-movies', this.mockData.movies);

    // Trending TV shows
    this.renderContentRow('trending-shows', this.mockData.tvShows);
  }

  loadDiscoverContent() {
    const allContent = [...this.mockData.movies, ...this.mockData.tvShows];
    this.renderContentGrid('discover-grid', allContent);
  }

  loadLibraryContent() {
    // For now, show some mock watchlist content
    const watchlist = [...this.mockData.movies.slice(0, 3), ...this.mockData.tvShows.slice(0, 2)];
    this.renderContentGrid('library-grid', watchlist);
  }

  loadSettingsContent() {
    const addonList = document.getElementById('addon-list');
    const mockAddons = [
      { name: 'TMDB Provider', description: 'Movie and TV show metadata from The Movie Database', status: 'active' },
      { name: 'YouTube Addon', description: 'Stream content from YouTube', status: 'active' },
      { name: 'Local Files', description: 'Play local video files', status: 'inactive' },
    ];

    addonList.innerHTML = mockAddons.map(addon => `
      <div class="addon-item">
        <div class="addon-info">
          <h4>${addon.name}</h4>
          <p>${addon.description}</p>
        </div>
        <span class="addon-status ${addon.status}">${addon.status}</span>
      </div>
    `).join('');
  }

  renderContentRow(containerId, items) {
    const container = document.getElementById(containerId);
    container.innerHTML = items.map(item => this.createContentItemHTML(item)).join('');
  }

  renderContentGrid(containerId, items) {
    const container = document.getElementById(containerId);
    container.innerHTML = items.map(item => this.createContentItemHTML(item)).join('');
  }

  createContentItemHTML(item) {
    return `
      <div class="content-item" data-id="${item.id}">
        <div class="content-item-poster">${item.poster}</div>
        <div class="content-item-info">
          <div class="content-item-title">${item.title}</div>
          <div class="content-item-meta">${item.year} • ${item.genre}</div>
        </div>
      </div>
    `;
  }

  performSearch(query) {
    if (!query.trim()) {
      document.getElementById('search-results').innerHTML = '';
      return;
    }

    // Navigate to search section
    this.navigateToSection('search');

    // Mock search results
    const allContent = [...this.mockData.movies, ...this.mockData.tvShows];
    const results = allContent.filter(item => 
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.genre.toLowerCase().includes(query.toLowerCase())
    );

    const searchResults = document.getElementById('search-results');
    if (results.length === 0) {
      searchResults.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h3>No results found</h3>
          <p>Try searching for something else</p>
        </div>
      `;
    } else {
      searchResults.innerHTML = `
        <div class="content-grid">
          ${results.map(item => this.createContentItemHTML(item)).join('')}
        </div>
      `;
    }
  }

  switchLibraryTab(tab) {
    document.querySelectorAll('.tab-button').forEach(button => {
      button.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    // Load different content based on tab
    let content = [];
    switch (tab) {
      case 'watchlist':
        content = [...this.mockData.movies.slice(0, 3), ...this.mockData.tvShows.slice(0, 2)];
        break;
      case 'favorites':
        content = [...this.mockData.movies.slice(1, 3), ...this.mockData.tvShows.slice(0, 1)];
        break;
      case 'watched':
        content = [...this.mockData.movies.slice(2, 4), ...this.mockData.tvShows.slice(1, 3)];
        break;
    }
    this.renderContentGrid('library-grid', content);
  }

  playContent(contentId) {
    // Mock video URLs - in a real app, these would come from addons
    const mockVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    
    const videoModal = document.getElementById('video-player-modal');
    const videoPlayer = document.getElementById('main-video-player');
    
    videoPlayer.src = mockVideoUrl;
    videoModal.style.display = 'flex';
    videoPlayer.play();

    // In a real app, this would invoke Tauri commands to get stream URLs from addons
    console.log(`Playing content with ID: ${contentId}`);
  }

  closeVideoPlayer() {
    const videoModal = document.getElementById('video-player-modal');
    const videoPlayer = document.getElementById('main-video-player');
    
    videoPlayer.pause();
    videoPlayer.src = '';
    videoModal.style.display = 'none';
  }

  showAddAddonDialog() {
    // Mock dialog - in a real app, this would show a proper addon installation dialog
    const addonUrl = prompt('Enter addon URL or browse for local addon:');
    if (addonUrl) {
      alert(`Addon installation would be handled here: ${addonUrl}`);
      // In real app, this would invoke Tauri commands to install the addon
    }
  }

  setupTauriInvokes() {
    // Check if Tauri is available
    if (typeof window.__TAURI__ !== 'undefined') {
      console.log('Tauri detected - setting up native integrations');
      
      // Setup Tauri-specific functionality
      // This is where we would invoke Rust functions for:
      // - Database operations
      // - File system access
      // - HTTP requests
      // - Addon management
      // - Settings persistence
      
      // Example Tauri invoke (commented out until backend is implemented):
      /*
      window.__TAURI__.invoke('get_library_items')
        .then(items => {
          console.log('Library items from Rust backend:', items);
        })
        .catch(err => {
          console.error('Error fetching library items:', err);
        });
      */
    } else {
      console.log('Running in browser mode - using mock data');
    }
  }

  // Method to be called from Rust backend
  updateContent(section, content) {
    switch (section) {
      case 'library':
        this.renderContentGrid('library-grid', content);
        break;
      case 'search':
        document.getElementById('search-results').innerHTML = `
          <div class="content-grid">
            ${content.map(item => this.createContentItemHTML(item)).join('')}
          </div>
        `;
        break;
      // Add more cases as needed
    }
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.streamGoApp = new StreamGoApp();
});

// Handle system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (window.streamGoApp && window.streamGoApp.theme === 'auto') {
    window.streamGoApp.applyTheme();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 'f':
        e.preventDefault();
        document.getElementById('search-input').focus();
        break;
      case 'h':
        e.preventDefault();
        window.streamGoApp.navigateToSection('home');
        break;
      case 'd':
        e.preventDefault();
        window.streamGoApp.navigateToSection('discover');
        break;
      case 'l':
        e.preventDefault();
        window.streamGoApp.navigateToSection('library');
        break;
    }
  }
  
  // Escape key to close video player
  if (e.key === 'Escape') {
    const videoModal = document.getElementById('video-player-modal');
    if (videoModal.style.display === 'flex') {
      window.streamGoApp.closeVideoPlayer();
    }
  }
});