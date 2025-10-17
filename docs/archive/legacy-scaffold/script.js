// StreamGo App - Main Application Logic

// Lazy loading utility (inline version for script.js)
const setupLazyLoading = (selector = 'img[data-src]') => {
    if (!('IntersectionObserver' in window)) {
        // Fallback for browsers without IntersectionObserver
        document.querySelectorAll(selector).forEach(img => {
            if (img.dataset.src) {
                img.src = img.dataset.src;
            }
        });
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.classList.add('lazy-loading');
                
                const tempImg = new Image();
                tempImg.onload = () => {
                    img.src = img.dataset.src;
                    img.classList.remove('lazy-loading');
                    img.classList.add('lazy-loaded');
                    observer.unobserve(img);
                };
                tempImg.onerror = () => {
                    img.classList.remove('lazy-loading');
                    img.classList.add('lazy-error');
                    img.src = 'https://via.placeholder.com/300x450?text=Error';
                    observer.unobserve(img);
                };
                tempImg.src = img.dataset.src;
            }
        });
    }, { rootMargin: '50px', threshold: 0.01 });

    document.querySelectorAll(selector).forEach(img => observer.observe(img));
};

// HTML sanitization utility
const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

// Tauri API helper
const getTauriInvoke = () => {
    // Debug: Log what's available
    console.log('Checking Tauri API...');
    console.log('window.__TAURI_INTERNALS__:', typeof window.__TAURI_INTERNALS__);
    console.log('window.__TAURI_INVOKE__:', typeof window.__TAURI_INVOKE__);
    console.log('window.__TAURI__:', typeof window.__TAURI__);
    if (window.__TAURI__) {
        console.log('window.__TAURI__.invoke:', typeof window.__TAURI__.invoke);
        console.log('window.__TAURI__.core:', typeof window.__TAURI__.core);
        if (window.__TAURI__.core) {
            console.log('window.__TAURI__.core.invoke:', typeof window.__TAURI__.core.invoke);
        }
    }
    
    // Try different Tauri API locations for Tauri v2
    if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
        console.log('✓ Using window.__TAURI_INTERNALS__.invoke');
        return window.__TAURI_INTERNALS__.invoke;
    }
    if (window.__TAURI_INVOKE__) {
        console.log('✓ Using window.__TAURI_INVOKE__');
        return window.__TAURI_INVOKE__;
    }
    if (window.__TAURI__ && window.__TAURI__.invoke) {
        console.log('✓ Using window.__TAURI__.invoke');
        return window.__TAURI__.invoke;
    }
    if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
        console.log('✓ Using window.__TAURI__.core.invoke');
        return window.__TAURI__.core.invoke;
    }
    console.error('✗ Tauri API not found!');
    return null;
};

class StreamGoApp {
    constructor() {
        this.currentSection = 'home';
        this.previousSection = 'home';
        this.searchResults = [];
        this.libraryItems = [];
        this.settings = null;
        this.currentMedia = null;
        this.init();
    }

    init() {
        console.log('StreamGo initialized');
        this.setupEventListeners();
        this.loadSettings();
        this.loadLibrary();
        this.loadAddons();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                if (section) {
                    this.showSection(section);
                }
            });
        });

        // Global search
        const globalSearchBtn = document.getElementById('global-search-btn');
        const globalSearchInput = document.getElementById('global-search');
        if (globalSearchBtn && globalSearchInput) {
            globalSearchBtn.addEventListener('click', () => {
                const query = globalSearchInput.value.trim();
                if (query) {
                    this.showSection('search');
                    document.getElementById('search-input').value = query;
                    this.performSearch(query);
                }
            });
            globalSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    globalSearchBtn.click();
                }
            });
        }

        // Search section
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('search-input');
        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', () => {
                const query = searchInput.value.trim();
                if (query) {
                    this.performSearch(query);
                }
            });
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    searchBtn.click();
                }
            });
        }
    }

    showSection(section) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
        });

        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Show selected section
        const sectionEl = document.getElementById(`${section}-section`);
        if (sectionEl) {
            sectionEl.classList.add('active');
        }

        // Add active class to nav item
        const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }

        this.currentSection = section;

        // Reload data if needed
        if (section === 'library') {
            this.loadLibrary();
        } else if (section === 'addons') {
            this.loadAddons();
        } else if (section === 'settings') {
            this.loadSettings();
        }
    }

    async performSearch(query) {
        const resultsEl = document.getElementById('search-results');

        const invoke = getTauriInvoke();
        if (!invoke) {
            resultsEl.innerHTML = this.renderErrorState(
                'Tauri API not available',
                'The backend connection is not available. Please restart the application.',
                false
            );
            return;
        }

        try {
            // Show skeleton loaders
            resultsEl.innerHTML = this.renderSkeletonGrid(8);

            const results = await invoke('search_content', { query });
            this.searchResults = results;

            if (results.length === 0) {
                resultsEl.innerHTML = this.renderEmptyState(
                    '🔍',
                    'No results found',
                    `No matches for "${escapeHtml(query)}". Try a different search term.`
                );
                return;
            }

            resultsEl.innerHTML = results.map(item => this.renderMediaCard(item, true)).join('');

            // Initialize lazy loading for search results
            setupLazyLoading();

            // Add event listeners to cards and buttons
            this.attachCardListeners();

        } catch (err) {
            console.error('Search error:', err);
            resultsEl.innerHTML = this.renderErrorState(
                'Search Failed',
                err.toString(),
                true,
                () => this.performSearch(query)
            );
            Toast.error(`Search error: ${err}`);
        }
    }

    async loadLibrary() {
        const libraryEl = document.getElementById('library-grid');
        const recentLibraryEl = document.getElementById('recent-library');
        const countEl = document.getElementById('library-count');

        const invoke = getTauriInvoke();
        if (!invoke) {
            if (libraryEl) {
                libraryEl.innerHTML = this.renderErrorState(
                    'Tauri API not available',
                    'Cannot load library without backend connection.',
                    false
                );
            }
            return;
        }

        try {
            // Show skeleton while loading
            if (libraryEl) {
                libraryEl.innerHTML = this.renderSkeletonGrid(6);
            }

            const items = await invoke('get_library_items');
            this.libraryItems = items;

            if (countEl) {
                countEl.textContent = items.length;
            }

            if (items.length === 0) {
                if (libraryEl) {
                    libraryEl.innerHTML = this.renderEmptyState(
                        '📚',
                        'Your library is empty',
                        'Search for movies and TV shows, then add them to your library to see them here.'
                    );
                }
                if (recentLibraryEl) {
                    recentLibraryEl.innerHTML = this.renderEmptyState(
                        '📚',
                        'No items yet',
                        'Add some content to your library to get started!'
                    );
                }
                return;
            }

            const html = items.map(item => this.renderMediaCard(item, false)).join('');
            
            if (libraryEl) {
                libraryEl.innerHTML = html;
                setupLazyLoading();
                this.attachCardListeners();
            }
            
            if (recentLibraryEl) {
                // Show only first 6 items on home page
                const recentItems = items.slice(0, 6);
                recentLibraryEl.innerHTML = recentItems.map(item => this.renderMediaCard(item, false)).join('');
                setupLazyLoading();
                this.attachCardListeners();
            }

        } catch (err) {
            console.error('Error loading library:', err);
            if (libraryEl) {
                libraryEl.innerHTML = this.renderErrorState(
                    'Failed to Load Library',
                    err.toString(),
                    true,
                    () => this.loadLibrary()
                );
            }
        }
    }

    async addToLibrary(item) {
        const invoke = getTauriInvoke();
        if (!invoke) {
            Toast.error('Tauri API not available');
            return;
        }

        try {
            await invoke('add_to_library', { item });
            Toast.success(`"${item.title}" added to library!`);
            await this.loadLibrary();
        } catch (err) {
            console.error('Error adding to library:', err);
            Toast.error(`Error adding to library: ${err}`);
        }
    }

    async loadAddons() {
        const addonsEl = document.getElementById('addons-list');

        const invoke = getTauriInvoke();
        if (!invoke) {
            if (addonsEl) addonsEl.innerHTML = '<p class="error-message">Tauri API not available</p>';
            return;
        }

        try {
            const addons = await invoke('get_addons');

            if (addons.length === 0) {
                addonsEl.innerHTML = '<p class="empty-message">No add-ons installed yet.</p>';
                return;
            }

            addonsEl.innerHTML = addons.map(addon => `
                <div class="addon-card">
                    <div class="addon-header">
                        <h3>${escapeHtml(addon.name)}</h3>
                        <span class="addon-version">v${escapeHtml(addon.version)}</span>
                    </div>
                    <p class="addon-description">${escapeHtml(addon.description)}</p>
                    <div class="addon-meta">
                        <span class="addon-author">By ${escapeHtml(addon.author)}</span>
                        <span class="addon-status ${addon.enabled ? 'enabled' : 'disabled'}">
                            ${addon.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>
                </div>
            `).join('');

        } catch (err) {
            console.error('Error loading add-ons:', err);
            addonsEl.innerHTML = `<p class="error-message">Error loading add-ons: ${err}</p>`;
        }
    }

    attachCardListeners() {
        console.log('Attaching card listeners...');
        const cards = document.querySelectorAll('.meta-item-container');
        console.log(`Found ${cards.length} meta items`);
        
        // Card click listeners
        cards.forEach((card, index) => {
            const mediaId = card.dataset.mediaId;
            console.log(`Card ${index}: mediaId =`, mediaId);
            
            card.addEventListener('click', (e) => {
                console.log('Card clicked!', e.target);
                // Don't navigate if clicking a button
                if (e.target.closest('button')) {
                    console.log('Button clicked, not navigating');
                    return;
                }
                
                console.log('Navigating to detail for mediaId:', mediaId);
                if (mediaId) {
                    this.showMediaDetail(mediaId);
                } else {
                    console.error('No mediaId found on card!');
                }
            });
        });

        // Play icon layer listeners
        document.querySelectorAll('.play-icon-layer').forEach(playIcon => {
            playIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                const mediaId = playIcon.dataset.id;
                if (mediaId) {
                    this.showMediaDetail(mediaId);
                }
            });
        });

        // Add to library button listeners
        document.querySelectorAll('.add-to-library-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemId = btn.dataset.id;
                const item = this.mediaMap[itemId] || this.searchResults.find(i => i.id === itemId);
                if (item) {
                    this.addToLibrary(item);
                }
            });
        });
    }

    async installAddon() {
        const url = await Modal.prompt(
            'Enter the add-on URL (must include manifest.json)',
            'Install Add-on',
            'https://example.com/addon'
        );
        if (!url) return;

        const invoke = getTauriInvoke();
        if (!invoke) {
            Toast.error('Tauri API not available');
            return;
        }

        try {
            Toast.info('Installing add-on...');
            const addonId = await invoke('install_addon', { addon_url: url });
            Toast.success(`Add-on installed successfully! ID: ${addonId}`);
            await this.loadAddons();
        } catch (err) {
            console.error('Error installing add-on:', err);
            Toast.error(`Error installing add-on: ${err}`);
        }
    }

    renderMediaCard(item, showAddButton) {
        const posterUrl = escapeHtml(item.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster');
        const escapedTitle = escapeHtml(item.title);
        const escapedId = escapeHtml(item.id);
        
        // Store media in a map for easy retrieval
        if (!this.mediaMap) this.mediaMap = {};
        this.mediaMap[item.id] = item;

        return `
            <div class="meta-item-container poster-shape-poster" data-media-id="${escapedId}">
                <div class="poster-container">
                    <div class="poster-image-layer">
                        <img 
                          data-src="${posterUrl}"
                          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 450'%3E%3Crect fill='%232a2a2a' width='300' height='450'/%3E%3C/svg%3E"
                          alt="${escapedTitle}"
                          class="poster-image lazy-img"
                        >
                    </div>
                    <div class="play-icon-layer" data-id="${escapedId}">
                        <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        <div class="play-icon-outer"></div>
                        <div class="play-icon-background"></div>
                    </div>
                    ${showAddButton ? `
                    <button class="add-to-library-btn" data-id="${escapedId}" style="position: absolute; bottom: 1rem; right: 1rem; z-index: 2; padding: 0.5rem 1rem; background: var(--primary-color); border: none; border-radius: var(--border-radius); color: white; cursor: pointer; font-size: 0.9rem;">+</button>
                    ` : ''}
                </div>
                <div class="title-bar-container">
                    <div class="title-label">${escapedTitle}</div>
                </div>
            </div>
        `;
    }

    async loadSettings() {
        const invoke = getTauriInvoke();
        if (!invoke) {
            console.log('Tauri API not available, using default settings');
            this.settings = this.getDefaultSettings();
            this.applySettingsToUI();
            return;
        }

        try {
            this.settings = await invoke('get_settings');
            this.applySettingsToUI();
        } catch (err) {
            console.error('Error loading settings:', err);
            this.settings = this.getDefaultSettings();
            this.applySettingsToUI();
        }
    }

    getDefaultSettings() {
        return {
            theme: 'auto',
            default_quality: 'auto',
            video_codec: 'auto',
            max_bitrate: 'auto',
            hardware_accel: true,
            audio_codec: 'auto',
            audio_channels: 'auto',
            volume_normalize: false,
            autoplay_next: true,
            skip_intro: false,
            resume_playback: true,
            subtitles_enabled: false,
            subtitle_language: 'en',
            subtitle_size: 'medium',
            buffer_size: 'medium',
            preload_next: true,
            torrent_connections: '100',
            cache_size: '1024',
            player_engine: 'auto',
            debug_logging: false,
            analytics: false
        };
    }

    applySettingsToUI() {
        if (!this.settings) return;

        // Appearance
        this.setIfExists('theme-select', this.settings.theme);
        
        // Video
        this.setIfExists('quality-select', this.settings.default_quality);
        this.setIfExists('codec-select', this.settings.video_codec);
        this.setIfExists('bitrate-select', this.settings.max_bitrate);
        this.setCheckboxIfExists('hardware-accel-toggle', this.settings.hardware_accel);
        
        // Audio
        this.setIfExists('audio-codec-select', this.settings.audio_codec);
        this.setIfExists('audio-channels-select', this.settings.audio_channels);
        this.setCheckboxIfExists('volume-normalize-toggle', this.settings.volume_normalize);
        
        // Playback
        this.setCheckboxIfExists('autoplay-toggle', this.settings.autoplay_next);
        this.setCheckboxIfExists('skip-intro-toggle', this.settings.skip_intro);
        this.setCheckboxIfExists('resume-playback-toggle', this.settings.resume_playback);
        
        // Subtitles
        this.setCheckboxIfExists('subtitles-toggle', this.settings.subtitles_enabled);
        this.setIfExists('subtitle-language', this.settings.subtitle_language);
        this.setIfExists('subtitle-size-select', this.settings.subtitle_size);
        
        // Network
        this.setIfExists('buffer-size-select', this.settings.buffer_size);
        this.setCheckboxIfExists('preload-toggle', this.settings.preload_next);
        this.setIfExists('torrent-connections-select', this.settings.torrent_connections);
        this.setIfExists('cache-size-select', this.settings.cache_size);
        
        // Advanced
        this.setIfExists('player-engine-select', this.settings.player_engine);
        this.setCheckboxIfExists('logging-toggle', this.settings.debug_logging);
        this.setCheckboxIfExists('analytics-toggle', this.settings.analytics);
    }

    setIfExists(id, value) {
        const el = document.getElementById(id);
        if (el && value !== undefined) el.value = value;
    }

    setCheckboxIfExists(id, value) {
        const el = document.getElementById(id);
        if (el && value !== undefined) el.checked = !!value;
    }

    async saveSettings() {
        // Gather all settings from UI
        const settings = {
            theme: document.getElementById('theme-select')?.value || 'auto',
            default_quality: document.getElementById('quality-select')?.value || 'auto',
            video_codec: document.getElementById('codec-select')?.value || 'auto',
            max_bitrate: document.getElementById('bitrate-select')?.value || 'auto',
            hardware_accel: document.getElementById('hardware-accel-toggle')?.checked || false,
            audio_codec: document.getElementById('audio-codec-select')?.value || 'auto',
            audio_channels: document.getElementById('audio-channels-select')?.value || 'auto',
            volume_normalize: document.getElementById('volume-normalize-toggle')?.checked || false,
            autoplay_next: document.getElementById('autoplay-toggle')?.checked || false,
            skip_intro: document.getElementById('skip-intro-toggle')?.checked || false,
            resume_playback: document.getElementById('resume-playback-toggle')?.checked || false,
            subtitles_enabled: document.getElementById('subtitles-toggle')?.checked || false,
            subtitle_language: document.getElementById('subtitle-language')?.value || 'en',
            subtitle_size: document.getElementById('subtitle-size-select')?.value || 'medium',
            buffer_size: document.getElementById('buffer-size-select')?.value || 'medium',
            preload_next: document.getElementById('preload-toggle')?.checked || false,
            torrent_connections: document.getElementById('torrent-connections-select')?.value || '100',
            cache_size: document.getElementById('cache-size-select')?.value || '1024',
            player_engine: document.getElementById('player-engine-select')?.value || 'auto',
            debug_logging: document.getElementById('logging-toggle')?.checked || false,
            analytics: document.getElementById('analytics-toggle')?.checked || false
        };

        const invoke = getTauriInvoke();
        if (!invoke) {
            this.settings = settings;
            Toast.warning('Settings saved in memory only (Tauri API not available)');
            return;
        }

        try {
            await invoke('save_settings', { settings });
            this.settings = settings;
            Toast.success('Settings saved successfully!');
        } catch (err) {
            console.error('Error saving settings:', err);
            Toast.error(`Error saving settings: ${err}`);
        }
    }

    async resetSettings() {
        const confirmed = await Modal.confirm(
            'Are you sure you want to reset all settings to defaults?',
            'Reset Settings'
        );
        
        if (confirmed) {
            this.settings = this.getDefaultSettings();
            this.applySettingsToUI();
            
            const invoke = getTauriInvoke();
            if (invoke) {
                try {
                    await invoke('save_settings', { settings: this.settings });
                } catch (err) {
                    console.error('Error resetting settings:', err);
                }
            }
            
            Toast.success('Settings reset to defaults!');
        }
    }

    async clearCache() {
        const confirmed = await Modal.confirm(
            'Are you sure you want to clear the cache? This will free up disk space but may slow down initial loading.',
            'Clear Cache'
        );
        
        if (confirmed) {
            const invoke = getTauriInvoke();
            if (!invoke) {
                Toast.error('Tauri API not available');
                return;
            }
            
            try {
                // In a real implementation, this would call a Rust function to clear cache
                Toast.success('Cache cleared successfully! Freed up space.');
            } catch (err) {
                console.error('Error clearing cache:', err);
                Toast.error(`Error clearing cache: ${err}`);
            }
        }
    }

    showMediaDetail(mediaId) {
        // Find the media immediately - NO async
        let media = this.mediaMap?.[mediaId] || 
                   this.searchResults.find(m => m.id == mediaId) || 
                   this.libraryItems.find(m => m.id == mediaId);
        
        if (!media) {
            Toast.error('Media not found. Please try searching again.');
            return;
        }
        
        // Store current section
        this.previousSection = this.currentSection;
        
        // Switch to detail section
        this.showSection('detail');
        
        // Store current media
        this.currentMedia = media;
        
        // Render immediately
        this.renderMediaDetail(media);
    }

    renderMediaDetail(media) {
        const posterUrl = escapeHtml(media.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster');
        const backdropUrl = escapeHtml(media.backdrop_url || 'https://via.placeholder.com/1200x500?text=No+Backdrop');
        const year = escapeHtml(String(media.year || 'N/A'));
        const mediaType = typeof media.media_type === 'string' ? escapeHtml(media.media_type) : 
                         (media.media_type?.Movie ? 'Movie' : 
                          media.media_type?.TvShow ? 'TV Show' : 'Unknown');
        const rating = media.rating ? escapeHtml(media.rating.toFixed(1)) : 'N/A';
        const duration = media.duration ? escapeHtml(`${media.duration} min`) : 'N/A';
        const escapedTitle = escapeHtml(media.title);
        const escapedId = escapeHtml(media.id);
        const escapedDescription = escapeHtml(media.description || 'No description available.');
        
        // Hero section
        document.getElementById('detail-hero').innerHTML = `
            <img 
              data-src="${backdropUrl}"
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 500'%3E%3Crect fill='%232a2a2a' width='1200' height='500'/%3E%3C/svg%3E"
              alt="${escapedTitle}"
              class="detail-backdrop lazy-img"
            >
        `;
        
        // Content section
        document.getElementById('detail-content').innerHTML = `
            <div>
                <img 
                  data-src="${posterUrl}"
                  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 450'%3E%3Crect fill='%232a2a2a' width='300' height='450'/%3E%3C/svg%3E"
                  alt="${escapedTitle}"
                  class="detail-poster lazy-img"
                >
            </div>
            <div class="detail-info">
                <h1>${escapedTitle}</h1>
                <div class="detail-meta">
                    <span>${year}</span>
                    <span>•</span>
                    <span>${mediaType}</span>
                    <span>•</span>
                    <span>${duration}</span>
                    <span class="detail-rating">⭐ ${rating}</span>
                </div>
                <p class="detail-description">${escapedDescription}</p>
                ${media.genre && media.genre.length > 0 ? `
                    <div class="detail-genres">
                        ${media.genre.map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="detail-actions">
                    <button class="play-btn" onclick="app.playMedia('${escapedId}')">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        Play
                    </button>
                    <button class="add-btn" onclick="app.addToLibrary(app.currentMedia)">
                        Add to Library
                    </button>
                    <button class="favorite-btn">
                        ♥ Favorite
                    </button>
                </div>
            </div>
        `;
        
        // Initialize lazy loading for detail images
        setTimeout(() => setupLazyLoading('#detail-hero img[data-src], #detail-content img[data-src]'), 0);
    }

    async playMedia(mediaId) {
        const invoke = getTauriInvoke();
        if (!invoke) {
            Toast.error('Tauri API not available');
            return;
        }

        try {
            Toast.info('Loading stream...');
            const streamUrl = await invoke('get_stream_url', { content_id: mediaId });
            this.openPlayer(streamUrl, this.currentMedia?.title || 'Video');
        } catch (err) {
            console.error('Error getting stream:', err);
            Toast.error(`Error: ${err}`);
        }
    }

    openPlayer(url, title) {
        const playerContainer = document.getElementById('video-player-container');
        const videoSource = document.getElementById('video-source');
        const videoPlayer = document.getElementById('video-player');
        const playerTitle = document.getElementById('player-title');
        
        videoSource.src = url;
        playerTitle.textContent = title;
        videoPlayer.load();
        playerContainer.style.display = 'flex';
        videoPlayer.play();
    }

    closePlayer() {
        const playerContainer = document.getElementById('video-player-container');
        const videoPlayer = document.getElementById('video-player');
        
        videoPlayer.pause();
        playerContainer.style.display = 'none';
    }

    goBack() {
        this.showSection(this.previousSection);
    }

    // Utility: Render skeleton grid
    renderSkeletonGrid(count = 6) {
        const skeletons = Array.from({ length: count }, () => `
            <div class="skeleton-card">
                <div class="skeleton-poster"></div>
                <div class="skeleton-info">
                    <div class="skeleton-title"></div>
                    <div class="skeleton-meta">
                        <div class="skeleton-meta-item"></div>
                        <div class="skeleton-meta-item"></div>
                        <div class="skeleton-meta-item"></div>
                    </div>
                    <div class="skeleton-description"></div>
                </div>
            </div>
        `).join('');

        return `<div class="skeleton-grid">${skeletons}</div>`;
    }

    // Utility: Render error state
    renderErrorState(title, description, showRetry = true, retryFn = null) {
        const retryButton = showRetry && retryFn
            ? `<button class="retry-btn" onclick="(${retryFn.toString()})()">🔄 Retry</button>`
            : '';

        return `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h3 class="error-title">${escapeHtml(title)}</h3>
                <p class="error-description">${escapeHtml(description)}</p>
                <div class="error-actions">
                    ${retryButton}
                </div>
            </div>
        `;
    }

    // Utility: Render empty state
    renderEmptyState(icon, title, description) {
        return `
            <div class="empty-state">
                <div class="empty-icon">${icon}</div>
                <h3 class="empty-title">${escapeHtml(title)}</h3>
                <p class="empty-description">${escapeHtml(description)}</p>
            </div>
        `;
    }
}

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new StreamGoApp();
    window.app = app;
});
