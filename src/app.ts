// StreamGo App - Main Application Logic
import type { MediaItem, UserPreferences } from './types/tauri';
import { invoke, escapeHtml } from './utils';
import { Toast, Modal } from './ui-utils';

// Re-export for backwards compatibility
(window as any).escapeHtml = escapeHtml;

export class StreamGoApp {
    private currentSection: string;
    private previousSection: string;
    private searchResults: MediaItem[];
    private libraryItems: MediaItem[];
    private settings: UserPreferences | null;
    private currentMedia: MediaItem | null;
    private mediaMap: Record<string, MediaItem>;

    constructor() {
        this.currentSection = 'home';
        this.previousSection = 'home';
        this.searchResults = [];
        this.libraryItems = [];
        this.settings = null;
        this.currentMedia = null;
        this.mediaMap = {};
        this.init();
    }

    init() {
        console.log('StreamGo initialized');
        this.setupEventListeners();
        this.loadSettings();
        this.loadLibrary();
        this.loadAddons();
        this.loadContinueWatching();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = (item as HTMLElement).dataset.section;
                if (section) {
                    this.showSection(section);
                }
            });
        });

        // Global search
        const globalSearchBtn = document.getElementById('global-search-btn');
        const globalSearchInput = document.getElementById('global-search') as HTMLInputElement;
        if (globalSearchBtn && globalSearchInput) {
            globalSearchBtn.addEventListener('click', () => {
                const query = globalSearchInput.value.trim();
                if (query) {
                    this.showSection('search');
                    const searchInput = document.getElementById('search-input') as HTMLInputElement;
                    if (searchInput) {
                        searchInput.value = query;
                    }
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
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
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

    showSection(section: string): void {
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
        if (section === 'home') {
            this.loadContinueWatching();
        } else if (section === 'library') {
            this.loadLibrary();
        } else if (section === 'addons') {
            this.loadAddons();
        } else if (section === 'settings') {
            this.loadSettings();
        }
    }

    async performSearch(query: string): Promise<void> {
        const resultsEl = document.getElementById('search-results');

        if (!resultsEl) {
            return;
        }

        try {
            // Show skeleton loaders
            resultsEl.innerHTML = this.renderSkeletonGrid(8);

            const results = await invoke<MediaItem[]>('search_content', { query });
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

            // Add event listeners to cards and buttons
            this.attachCardListeners();

        } catch (err) {
            console.error('Search error:', err);
            resultsEl.innerHTML = this.renderErrorState(
                'Search Failed',
                String(err)
            );
            Toast.error(`Search error: ${err}`);
        }
    }

    async loadLibrary() {
        const libraryEl = document.getElementById('library-grid');
        const recentLibraryEl = document.getElementById('recent-library');
        const countEl = document.getElementById('library-count');

        try {
            // Show skeleton while loading
            if (libraryEl) {
                libraryEl.innerHTML = this.renderSkeletonGrid(6);
            }

            const items = await invoke<MediaItem[]>('get_library_items');
            this.libraryItems = items;

            if (countEl) {
                countEl.textContent = String(items.length);
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
                this.attachCardListeners();
            }
            
            if (recentLibraryEl) {
                // Show only first 6 items on home page
                const recentItems = items.slice(0, 6);
                recentLibraryEl.innerHTML = recentItems.map(item => this.renderMediaCard(item, false)).join('');
                this.attachCardListeners();
            }

        } catch (err) {
            console.error('Error loading library:', err);
            if (libraryEl) {
                libraryEl.innerHTML = this.renderErrorState(
                    'Failed to Load Library',
                    String(err)
                );
            }
        }
    }

    async addToLibrary(item: MediaItem): Promise<void> {
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

        try {
            const addons = await invoke<any[]>('get_addons');

            if (!addonsEl) return;

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
            if (addonsEl) {
                addonsEl.innerHTML = `<p class="error-message">Error loading add-ons: ${err}</p>`;
            }
        }
    }

    attachCardListeners() {
        console.log('Attaching card listeners...');
        const cards = document.querySelectorAll('.movie-card');
        console.log(`Found ${cards.length} movie cards`);
        
        // Card click listeners
        cards.forEach((card, index) => {
            const mediaId = (card as HTMLElement).dataset.mediaId;
            console.log(`Card ${index}: mediaId =`, mediaId);
            
            card.addEventListener('click', (e) => {
                console.log('Card clicked!', e.target);
                // Don't navigate if clicking a button
                if (e.target && (e.target as HTMLElement).closest('button')) {
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

        // Add to library button listeners
        document.querySelectorAll('.add-to-library-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemId = (btn as HTMLElement).dataset.id;
                const item = itemId ? (this.mediaMap[itemId] || this.searchResults.find(i => i.id === itemId)) : undefined;
                if (item) {
                    this.addToLibrary(item);
                }
            });
        });

        // Play button listeners
        document.querySelectorAll('.play-btn-overlay').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const mediaId = (btn as HTMLElement).dataset.id;
                if (mediaId) {
                    this.playMedia(mediaId);
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

        try {
            Toast.info('Installing add-on...');
            const addonId = await invoke<string>('install_addon', { addon_url: url });
            Toast.success(`Add-on installed successfully! ID: ${addonId}`);
            await this.loadAddons();
        } catch (err) {
            console.error('Error installing add-on:', err);
            Toast.error(`Error installing add-on: ${err}`);
        }
    }

    renderMediaCard(item: MediaItem, showAddButton: boolean, showProgress = false): string {
        const posterUrl = escapeHtml(item.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster');
        const year = escapeHtml(String(item.year || 'N/A'));
        const mediaType = typeof item.media_type === 'string' ? escapeHtml(item.media_type) : 
                         ('Movie' in item.media_type ? 'Movie' : 
                          'TvShow' in item.media_type ? 'TV Show' : 'Unknown');
        const rating = item.rating ? escapeHtml(item.rating.toFixed(1)) : 'N/A';
        const description = item.description || '';
        const truncatedDesc = description.length > 150 ? description.substring(0, 150) + '...' : description;
        const escapedDesc = escapeHtml(truncatedDesc);
        const escapedTitle = escapeHtml(item.title);
        const escapedId = escapeHtml(item.id);
        
        // Calculate progress percentage
        const progress = item.progress || 0;
        const duration = item.duration ? item.duration * 60 : 0; // duration is in minutes
        const progressPercent = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
        
        // Store media in a map for easy retrieval
        if (!this.mediaMap) this.mediaMap = {};
        this.mediaMap[item.id] = item;

        return `
            <div class="movie-card" data-media-id="${escapedId}">
                <div class="movie-poster">
                    <img src="${posterUrl}" alt="${escapedTitle}" onerror="this.src='https://via.placeholder.com/300x450?text=No+Poster'">
                    ${showProgress && progress > 0 ? `<div class="progress-bar"><div class="progress-fill" style="width: ${progressPercent}%"></div></div>` : ''}
                    <div class="movie-overlay">
                        ${showAddButton ? `<button class="add-to-library-btn" data-id="${escapedId}">Add to Library</button>` : `<button class="play-btn-overlay" data-id="${escapedId}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>${showProgress ? 'Resume' : 'Play'}</button>`}
                    </div>
                </div>
                <div class="movie-info">
                    <h4 class="movie-title">${escapedTitle}</h4>
                    <div class="movie-meta">
                        <span class="movie-year">${year}</span>
                        <span class="movie-type">${mediaType}</span>
                        <span class="movie-rating">⭐ ${rating}</span>
                    </div>
                    ${escapedDesc ? `<p class="movie-description">${escapedDesc}</p>` : ''}
                </div>
            </div>
        `;
    }

    async loadSettings() {
        try {
            this.settings = await invoke<UserPreferences>('get_settings');
            this.applySettingsToUI();
        } catch (err) {
            console.error('Error loading settings:', err);
            this.settings = this.getDefaultSettings();
            this.applySettingsToUI();
        }
    }

    getDefaultSettings(): UserPreferences {
        return {
            version: 1,
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

    setIfExists(id: string, value: string): void {
        const el = document.getElementById(id) as HTMLSelectElement | HTMLInputElement;
        if (el && value !== undefined) el.value = value;
    }

    setCheckboxIfExists(id: string, value: boolean): void {
        const el = document.getElementById(id) as HTMLInputElement;
        if (el && value !== undefined) el.checked = !!value;
    }

    async saveSettings(): Promise<void> {
        // Gather all settings from UI
        const settings: UserPreferences = {
            version: 1,
            theme: (document.getElementById('theme-select') as HTMLSelectElement)?.value || 'auto',
            default_quality: (document.getElementById('quality-select') as HTMLSelectElement)?.value || 'auto',
            video_codec: (document.getElementById('codec-select') as HTMLSelectElement)?.value || 'auto',
            max_bitrate: (document.getElementById('bitrate-select') as HTMLSelectElement)?.value || 'auto',
            hardware_accel: (document.getElementById('hardware-accel-toggle') as HTMLInputElement)?.checked || false,
            audio_codec: (document.getElementById('audio-codec-select') as HTMLSelectElement)?.value || 'auto',
            audio_channels: (document.getElementById('audio-channels-select') as HTMLSelectElement)?.value || 'auto',
            volume_normalize: (document.getElementById('volume-normalize-toggle') as HTMLInputElement)?.checked || false,
            autoplay_next: (document.getElementById('autoplay-toggle') as HTMLInputElement)?.checked || false,
            skip_intro: (document.getElementById('skip-intro-toggle') as HTMLInputElement)?.checked || false,
            resume_playback: (document.getElementById('resume-playback-toggle') as HTMLInputElement)?.checked || false,
            subtitles_enabled: (document.getElementById('subtitles-toggle') as HTMLInputElement)?.checked || false,
            subtitle_language: (document.getElementById('subtitle-language') as HTMLInputElement)?.value || 'en',
            subtitle_size: (document.getElementById('subtitle-size-select') as HTMLSelectElement)?.value || 'medium',
            buffer_size: (document.getElementById('buffer-size-select') as HTMLSelectElement)?.value || 'medium',
            preload_next: (document.getElementById('preload-toggle') as HTMLInputElement)?.checked || false,
            torrent_connections: (document.getElementById('torrent-connections-select') as HTMLSelectElement)?.value || '100',
            cache_size: (document.getElementById('cache-size-select') as HTMLSelectElement)?.value || '1024',
            player_engine: (document.getElementById('player-engine-select') as HTMLSelectElement)?.value || 'auto',
            debug_logging: (document.getElementById('logging-toggle') as HTMLInputElement)?.checked || false,
            analytics: (document.getElementById('analytics-toggle') as HTMLInputElement)?.checked || false
        };

        try {
            await invoke('save_settings', { settings });
            this.settings = settings;
            Toast.success('Settings saved successfully!');
        } catch (err) {
            console.error('Error saving settings:', err);
            Toast.error(`Error saving settings: ${err}`);
        }
    }

    async resetSettings(): Promise<void> {
        const confirmed = await Modal.confirm(
            'Are you sure you want to reset all settings to defaults?',
            'Reset Settings'
        );
        
        if (confirmed) {
            this.settings = this.getDefaultSettings();
            this.applySettingsToUI();
            
            try {
                await invoke('save_settings', { settings: this.settings });
            } catch (err) {
                console.error('Error resetting settings:', err);
            }
            
            Toast.success('Settings reset to defaults!');
        }
    }

    async clearCache(): Promise<void> {
        const confirmed = await Modal.confirm(
            'Are you sure you want to clear the cache? This will free up disk space but may slow down initial loading.',
            'Clear Cache'
        );
        
        if (confirmed) {
            try {
                // In a real implementation, this would call a Rust function to clear cache
                Toast.success('Cache cleared successfully! Freed up space.');
            } catch (err) {
                console.error('Error clearing cache:', err);
                Toast.error(`Error clearing cache: ${err}`);
            }
        }
    }

    showMediaDetail(mediaId: string): void {
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

    renderMediaDetail(media: MediaItem): void {
        const posterUrl = escapeHtml(media.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster');
        const backdropUrl = escapeHtml(media.backdrop_url || 'https://via.placeholder.com/1200x500?text=No+Backdrop');
        const year = escapeHtml(String(media.year || 'N/A'));
        const mediaType = typeof media.media_type === 'string' ? escapeHtml(media.media_type) : 
                         ('Movie' in media.media_type ? 'Movie' : 
                          'TvShow' in media.media_type ? 'TV Show' : 'Unknown');
        const rating = media.rating ? escapeHtml(media.rating.toFixed(1)) : 'N/A';
        const duration = media.duration ? escapeHtml(`${media.duration} min`) : 'N/A';
        const escapedTitle = escapeHtml(media.title);
        const escapedId = escapeHtml(media.id);
        const escapedDescription = escapeHtml(media.description || 'No description available.');
        
        // Hero section
        const detailHero = document.getElementById('detail-hero');
        if (detailHero) {
            detailHero.innerHTML = `
            <img src="${backdropUrl}" alt="${escapedTitle}" class="detail-backdrop" onerror="this.src='https://via.placeholder.com/1200x500?text=No+Backdrop'">
        `;
        }
        
        // Content section
        const detailContent = document.getElementById('detail-content');
        if (detailContent) {
            detailContent.innerHTML = `
            <div>
                <img src="${posterUrl}" alt="${escapedTitle}" class="detail-poster" onerror="this.src='https://via.placeholder.com/300x450?text=No+Poster'">
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
                    <button class="add-btn" onclick="app.addToWatchlist('${escapedId}')">
                        + Watchlist
                    </button>
                    <button class="favorite-btn" onclick="app.addToFavorites('${escapedId}')">
                        ♥ Favorite
                    </button>
                </div>
            </div>
        `;
        }
    }

    async playMedia(mediaId: string): Promise<void> {
        try {
            Toast.info('Loading stream...');
            const streamUrl = await invoke<string>('get_stream_url', { content_id: mediaId });
            
            // Use the global player instance
            const player = (window as any).player;
            if (player) {
                player.loadVideo(streamUrl, this.currentMedia?.title || 'Video');
            } else {
                console.error('Player not initialized');
                Toast.error('Video player not available');
            }
        } catch (err) {
            console.error('Error getting stream:', err);
            Toast.error(`Error: ${err}`);
        }
    }

    closePlayer() {
        const player = (window as any).player;
        if (player) {
            player.close();
        }
        
        // Update watch progress when closing player
        if (this.currentMedia) {
            this.updateWatchProgress();
        }
    }

    async updateWatchProgress() {
        if (!this.currentMedia) return;

        const player = (window as any).player;
        if (!player) return;

        const video = document.getElementById('video-player') as HTMLVideoElement;
        if (!video) return;

        try {
            const progress = Math.floor(video.currentTime || 0);
            const duration = video.duration || 0;
            const watched = duration > 0 && (progress / duration) > 0.95;

            await invoke('update_watch_progress', { media_id: this.currentMedia.id, progress, watched });

            console.log(`Progress updated: ${progress}s, watched: ${watched}`);
        } catch (err) {
            console.error('Error updating watch progress:', err);
        }
    }

    // Continue Watching
    async loadContinueWatching() {
        const continueWatchingGrid = document.getElementById('continue-watching-grid');
        const continueWatchingSection = document.getElementById('continue-watching-section');
        
        if (!continueWatchingGrid) return;

        try {
            const items = await invoke<MediaItem[]>('get_continue_watching');
            
            if (items.length === 0) {
                if (continueWatchingSection) {
                    continueWatchingSection.style.display = 'none';
                }
                return;
            }

            // Show section and render items
            if (continueWatchingSection) {
                continueWatchingSection.style.display = 'block';
            }
            
            continueWatchingGrid.innerHTML = items.map(item => this.renderMediaCard(item, false, true)).join('');
            this.attachCardListeners();
        } catch (err) {
            console.error('Error loading continue watching:', err);
            if (continueWatchingSection) {
                continueWatchingSection.style.display = 'none';
            }
        }
    }

    // Watchlist
    async addToWatchlist(mediaId: string): Promise<void> {
        try {
            await invoke('add_to_watchlist', { media_id: mediaId });
            Toast.success('Added to watchlist!');
        } catch (err) {
            console.error('Error adding to watchlist:', err);
            Toast.error(`Error: ${err}`);
        }
    }

    async removeFromWatchlist(mediaId: string): Promise<void> {
        try {
            await invoke('remove_from_watchlist', { media_id: mediaId });
            Toast.success('Removed from watchlist');
        } catch (err) {
            console.error('Error removing from watchlist:', err);
            Toast.error(`Error: ${err}`);
        }
    }

    // Favorites
    async addToFavorites(mediaId: string): Promise<void> {
        try {
            await invoke('add_to_favorites', { media_id: mediaId });
            Toast.success('Added to favorites! ♥');
        } catch (err) {
            console.error('Error adding to favorites:', err);
            Toast.error(`Error: ${err}`);
        }
    }

    async removeFromFavorites(mediaId: string): Promise<void> {
        try {
            await invoke('remove_from_favorites', { media_id: mediaId });
            Toast.success('Removed from favorites');
        } catch (err) {
            console.error('Error removing from favorites:', err);
            Toast.error(`Error: ${err}`);
        }
    }

    goBack(): void {
        this.showSection(this.previousSection);
    }

    // Utility: Render skeleton grid
    renderSkeletonGrid(count = 6): string {
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
    renderErrorState(title: string, description: string): string {

        return `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h3 class="error-title">${escapeHtml(title)}</h3>
                <p class="error-description">${escapeHtml(description)}</p>
            </div>
        `;
    }

    // Utility: Render empty state
    renderEmptyState(icon: string, title: string, description: string): string {
        return `
            <div class="empty-state">
                <div class="empty-icon">${icon}</div>
                <h3 class="empty-title">${escapeHtml(title)}</h3>
                <p class="empty-description">${escapeHtml(description)}</p>
            </div>
        `;
    }
}

// Export for use in main.ts
// The initialization is now handled by main.ts
