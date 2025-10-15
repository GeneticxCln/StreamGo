// StreamGo App - Main Application Logic
import type { MediaItem, UserPreferences } from './types/tauri';
import { invoke, escapeHtml } from './utils';
import { Toast, Modal } from './ui-utils';
import { setupLazyLoading } from './utils/imageLazyLoad';

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
        this.initializeTheme();
        this.loadSettings();
        this.loadLibrary();
        this.loadAddons();
        this.loadContinueWatching();
    }

    initializeTheme() {
        // Check localStorage first, then system preference
        const savedTheme = localStorage.getItem('theme');
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const currentTheme = savedTheme || systemTheme;
        
        this.applyTheme(currentTheme);

        // Listen for system theme changes if no saved preference
        if (!savedTheme) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                this.applyTheme(e.matches ? 'dark' : 'light');
            });
        }
    }

    applyTheme(theme: string) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
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
            this.loadTrending();
            this.loadPopular();
        } else if (section === 'library') {
            this.loadLibrary();
        } else if (section === 'addons') {
            this.loadAddons();
        } else if (section === 'settings') {
            this.loadSettings();
        } else if (section === 'diagnostics') {
            this.loadDiagnostics();
        }
    }

    async loadDiagnostics() {
        const container = document.getElementById('diagnostics-container');
        console.log('loadDiagnostics called', { 
            containerExists: !!container, 
            diagnosticsManagerExists: !!(window as any).diagnosticsManager 
        });
        
        if (!container) {
            console.error('Diagnostics container not found in DOM');
            return;
        }
        
        if (!(window as any).diagnosticsManager) {
            console.error('diagnosticsManager not found on window object');
            container.innerHTML = `
                <div class="error-state">
                    <h3>⚠️ Diagnostics Not Available</h3>
                    <p>The diagnostics module failed to initialize.</p>
                </div>
            `;
            return;
        }
        
        try {
            await (window as any).diagnosticsManager.renderDashboard(container);
        } catch (error) {
            console.error('Error rendering diagnostics dashboard:', error);
            container.innerHTML = `
                <div class="error-state">
                    <h3>❌ Failed to Load Diagnostics</h3>
                    <p>${escapeHtml(String(error))}</p>
                </div>
            `;
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

            // Initialize lazy loading for newly rendered images
            setupLazyLoading();

            // Add event listeners to cards and buttons
            this.attachCardListeners();

        } catch (err) {
            console.error('Search error:', err);
            resultsEl.innerHTML = this.renderErrorState(
                'Unable to Search',
                'We couldn\'t complete your search. This might be due to a network issue or the service being unavailable.',
                `app.performSearch('${escapeHtml(query)}')`
            );
            Toast.error('Search failed. Please check your connection and try again.');
        }
    }

    async loadLibrary() {
        const libraryEl = document.getElementById('library-grid');
        const recentLibraryEl = document.getElementById('recent-library-row');
        const recentLibrarySection = document.getElementById('recent-library-section');
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
                if (recentLibrarySection) {
                    recentLibrarySection.style.display = 'none';
                }
                return;
            }

            const html = items.map(item => this.renderMediaCard(item, false)).join('');
            
            if (libraryEl) {
                libraryEl.innerHTML = html;
                // Initialize lazy loading for library grid images
                setupLazyLoading();
                this.attachCardListeners();
            }
            
            if (recentLibraryEl) {
                if (recentLibrarySection) {
                    recentLibrarySection.style.display = 'block';
                }
                // Show only first 10 items on home page for horizontal scroll
                const recentItems = items.slice(0, 10);
                recentLibraryEl.innerHTML = recentItems.map(item => this.renderMediaCard(item, false)).join('');
                // Initialize lazy loading for recent items images
                setupLazyLoading();
                this.attachCardListeners();
            }

            // Also refresh trending/popular on library update
            if (this.currentSection === 'home') {
                this.loadTrending();
                this.loadPopular();
            }

        } catch (err) {
            console.error('Error loading library:', err);
            if (libraryEl) {
                libraryEl.innerHTML = this.renderErrorState(
                    'Unable to Load Library',
                    'There was a problem loading your library. Your data is safe, but we couldn\'t display it right now.',
                    'app.loadLibrary()'
                );
            }
            Toast.error('Failed to load library. Click retry to try again.');
        }
    }

    async addToLibrary(item: MediaItem): Promise<void> {
        try {
            await invoke('add_to_library', { item });
            Toast.success(`"${item.title}" added to library!`);
            await this.loadLibrary();
        } catch (err) {
            console.error('Error adding to library:', err);
            Toast.error('Couldn\'t add to library. Please try again.');
        }
    }

    async loadAddons() {
        const addonsEl = document.getElementById('addons-list');

        if (!addonsEl) return;

        try {
            // Show loading state
            addonsEl.innerHTML = '<div class="loading-spinner">Loading add-ons...</div>';

            const addons = await invoke<any[]>('get_addons');

            if (addons.length === 0) {
                addonsEl.innerHTML = this.renderEmptyState(
                    '🧩',
                    'No Add-ons Installed',
                    'Add-ons extend StreamGo with new content sources. Click "Install Add-on" to get started.'
                );
                return;
            }

            // Fetch health data for all addons
            let healthData: Map<string, any> = new Map();
            try {
                const healthSummaries = await invoke<any[]>('get_addon_health_summaries');
                healthSummaries.forEach(h => healthData.set(h.addon_id, h));
            } catch (err) {
                console.warn('Could not fetch addon health data:', err);
            }

            addonsEl.innerHTML = addons.map(addon => {
                const health = healthData.get(addon.id);
                return this.renderAddonCard(addon, health);
            }).join('');

        } catch (err) {
            console.error('Error loading add-ons:', err);
            addonsEl.innerHTML = this.renderErrorState(
                'Unable to Load Add-ons',
                'We couldn\'t load your installed add-ons. They\'re still installed, we just can\'t display them right now.',
                'app.loadAddons()'
            );
            Toast.error('Failed to load add-ons. Click retry to try again.');
        }
    }

    private renderAddonCard(addon: any, health?: any): string {
        // Determine health badge class and status text
        let healthBadgeClass = 'health-unknown';
        let healthStatusText = 'Unknown';
        let healthScore = 0;
        
        if (health && health.health_score !== undefined) {
            healthScore = health.health_score;
            if (healthScore >= 80) {
                healthBadgeClass = 'health-excellent';
                healthStatusText = 'Excellent';
            } else if (healthScore >= 60) {
                healthBadgeClass = 'health-good';
                healthStatusText = 'Good';
            } else if (healthScore >= 40) {
                healthBadgeClass = 'health-fair';
                healthStatusText = 'Fair';
            } else {
                healthBadgeClass = 'health-poor';
                healthStatusText = 'Poor';
            }
        }

        // Build health metrics HTML
        let healthMetrics = '';
        if (health) {
            const successRate = health.total_requests > 0 
                ? Math.round((health.successful_requests / health.total_requests) * 100)
                : 0;
            const avgResponseTime = Math.round(health.avg_response_time_ms);
            
            healthMetrics = `
                <div class="addon-health-metrics">
                    <div class="health-metric">
                        <span class="metric-label">Success Rate:</span>
                        <span class="metric-value">${successRate}%</span>
                    </div>
                    <div class="health-metric">
                        <span class="metric-label">Avg Response:</span>
                        <span class="metric-value">${avgResponseTime}ms</span>
                    </div>
                    <div class="health-metric">
                        <span class="metric-label">Requests:</span>
                        <span class="metric-value">${health.total_requests}</span>
                    </div>
                </div>
            `;
        }

        return `
            <div class="addon-card">
                <div class="addon-header">
                    <div class="addon-title-group">
                        <h3>${escapeHtml(addon.name)}</h3>
                        <span class="addon-version">v${escapeHtml(addon.version)}</span>
                    </div>
                    <div class="addon-badges">
                        ${health ? `<span class="addon-health-badge ${healthBadgeClass}" title="Health Score: ${healthScore}">${healthStatusText}</span>` : ''}
                        <span class="addon-status ${addon.enabled ? 'enabled' : 'disabled'}">
                            ${addon.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>
                </div>
                <p class="addon-description">${escapeHtml(addon.description)}</p>
                ${healthMetrics}
                <div class="addon-meta">
                    <span class="addon-author">By ${escapeHtml(addon.author)}</span>
                </div>
            </div>
        `;
    }

    attachCardListeners() {
        console.log('Attaching card listeners...');
        const cards = document.querySelectorAll('.meta-item-container');
        console.log(`Found ${cards.length} meta items`);
        
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

        // Play icon layer listeners
        document.querySelectorAll('.play-icon-layer').forEach(playIcon => {
            playIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                const mediaId = (playIcon as HTMLElement).dataset.id;
                if (mediaId) {
                    this.showMediaDetail(mediaId);
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

    renderMediaCard(item: MediaItem, _showAddButton: boolean, showProgress = false): string {
        const posterUrl = escapeHtml(item.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster');
        const escapedTitle = escapeHtml(item.title);
        const escapedId = escapeHtml(item.id);
        const year = item.year || '';
        const rating = item.rating ? item.rating.toFixed(1) : null;
        
        // Calculate progress percentage
        const progress = item.progress || 0;
        const duration = item.duration ? item.duration * 60 : 0; // duration is in minutes
        const progressPercent = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
        
        // Store media in a map for easy retrieval
        if (!this.mediaMap) this.mediaMap = {};
        this.mediaMap[item.id] = item;

        return `
            <div class="meta-item-container poster-shape-poster animation-fade-in" data-media-id="${escapedId}">
                <div class="poster-container">
                    <div class="poster-image-layer">
                        <img 
                          data-src="${posterUrl}"
                          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 450'%3E%3Crect fill='%231a1d2e' width='300' height='450'/%3E%3C/svg%3E"
                          alt="${escapedTitle}"
                          class="poster-image lazy-img"
                          loading="lazy"
                        >
                    </div>
                    ${rating ? `
                        <div style="position: absolute; top: 0.75rem; right: 0.75rem; z-index: 2; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(8px); padding: 0.35rem 0.6rem; border-radius: 6px; display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; font-weight: 600;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffd700">
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                            </svg>
                            <span style="color: #ffd700;">${rating}</span>
                        </div>
                    ` : ''}
                    <div class="play-icon-layer" data-id="${escapedId}">
                        <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        <div class="play-icon-outer"></div>
                        <div class="play-icon-background"></div>
                    </div>
                    ${showProgress && progressPercent > 0 ? `
                        <div class="progress-bar-layer">
                            <div class="progress-bar-background"></div>
                            <div class="progress-bar" style="width: ${progressPercent}%"></div>
                        </div>
                    ` : ''}
                    ${item.watched ? `
                        <div class="watched-icon-layer">
                            <svg class="watched-icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                            </svg>
                        </div>
                    ` : ''}
                </div>
                <div class="title-bar-container">
                    <div class="title-label">
                        ${escapedTitle}
                        ${year ? `<span style="opacity: 0.5; font-weight: 400; margin-left: 0.25rem;">(${year})</span>` : ''}
                    </div>
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
            language: 'en',
            notifications_enabled: true,
            auto_update: true,
            autoplay: true,
            quality: 'auto',
            playback_speed: 1.0,
            volume: 1.0,
            subtitle_language: 'en',
            telemetry_enabled: false,
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

    setIfExists(id: string, value: string | undefined): void {
        const el = document.getElementById(id) as HTMLSelectElement | HTMLInputElement;
        if (el && value !== undefined) el.value = value;
    }

    setCheckboxIfExists(id: string, value: boolean | undefined): void {
        const el = document.getElementById(id) as HTMLInputElement;
        if (el && value !== undefined) el.checked = !!value;
    }

    async saveSettings(): Promise<void> {
        // Gather all settings from UI
        const settings: UserPreferences = {
            version: 1,
            theme: (document.getElementById('theme-select') as HTMLSelectElement)?.value || 'auto',
            language: 'en',
            notifications_enabled: true,
            auto_update: true,
            autoplay: true,
            quality: 'auto',
            playback_speed: 1.0,
            volume: 1.0,
            subtitle_language: (document.getElementById('subtitle-language') as HTMLInputElement)?.value || 'en',
            telemetry_enabled: false,
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
                await invoke('clear_cache');
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
        const year = media.year || 'N/A';
        const mediaType = typeof media.media_type === 'string' ? escapeHtml(media.media_type) : 
                         ('Movie' in media.media_type ? 'Movie' : 
                          'TvShow' in media.media_type ? 'TV Show' : 'Unknown');
        const rating = media.rating;
        const duration = media.duration ? escapeHtml(`${media.duration} min`) : 'N/A';
        const escapedTitle = escapeHtml(media.title);
        const escapedId = escapeHtml(media.id);
        const escapedDescription = escapeHtml(media.description || 'No description available.');
        
        // Hero section
        const detailHero = document.getElementById('detail-hero');
        if (detailHero) {
            detailHero.innerHTML = `
                <img 
                  data-src="${backdropUrl}"
                  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 500'%3E%3Crect fill='%231a1d2e' width='1200' height='500'/%3E%3C/svg%3E"
                  alt="${escapedTitle} backdrop"
                  class="detail-backdrop lazy-img"
                  loading="lazy"
                >
                <div class="detail-hero-overlay"></div>
            `;
        }
        
        // Content section
        const detailContent = document.getElementById('detail-content');
        if (detailContent) {
            detailContent.innerHTML = `
                <div class="detail-poster-wrapper">
                    <img 
                      data-src="${posterUrl}"
                      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 450'%3E%3Crect fill='%231a1d2e' width='300' height='450'/%3E%3C/svg%3E"
                      alt="${escapedTitle} poster"
                      class="detail-poster lazy-img"
                      loading="lazy"
                    >
                </div>
                <div class="detail-info">
                    <h1 class="detail-title">${escapedTitle}</h1>
                    <div class="detail-meta">
                        <span class="meta-item">${year}</span>
                        <span class="meta-separator">•</span>
                        <span class="meta-item">${mediaType}</span>
                        ${duration !== 'N/A' ? `
                            <span class="meta-separator">•</span>
                            <span class="meta-item">${duration}</span>
                        ` : ''}
                        ${rating ? `
                            <span class="detail-rating">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="#ffd700">
                                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                                </svg>
                                ${rating.toFixed(1)}
                            </span>
                        ` : ''}
                    </div>
                    <p class="detail-description">${escapedDescription}</p>
                    ${media.genre && media.genre.length > 0 ? `
                        <div class="detail-genres">
                            ${media.genre.map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('')}
                        </div>
                    ` : ''}
                    <div class="detail-actions">
                        <button class="play-btn" onclick="app.playMedia('${escapedId}')">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                            Play Now
                        </button>
                        <button class="add-btn" onclick="app.addToLibrary(app.currentMedia)">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                            Library
                        </button>
                        <button class="add-btn" onclick="app.addToWatchlist('${escapedId}')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                            </svg>
                            Watchlist
                        </button>
                        <button class="favorite-btn" onclick="app.addToFavorites('${escapedId}')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                            Favorite
                        </button>
                    </div>
                </div>
            `;
        }

        // After injecting detail images, initialize lazy loading for them
        setupLazyLoading('#detail-hero img[data-src], #detail-content img[data-src]');
    }

    async playMedia(mediaId: string): Promise<void> {
        try {
            Toast.info('Loading stream...');
            const streamUrl = await invoke<string>('get_stream_url', { content_id: mediaId });
            
            // Set stream URL for external player manager
            const externalPlayerManager = (window as any).externalPlayerManager;
            if (externalPlayerManager) {
                externalPlayerManager.setCurrentStream(streamUrl);
            }
            
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
            Toast.error('Unable to start playback. The stream might be unavailable.');
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
        const continueWatchingRow = document.getElementById('continue-watching-row');
        const continueWatchingSection = document.getElementById('continue-watching-section');
        
        if (!continueWatchingRow) return;

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
            
            continueWatchingRow.innerHTML = items.slice(0, 10).map(item => this.renderMediaCard(item, false, true)).join('');
            // Initialize lazy loading for Continue Watching images
            setupLazyLoading();
            this.attachCardListeners();
        } catch (err) {
            console.error('Error loading continue watching:', err);
            if (continueWatchingSection) {
                continueWatchingSection.style.display = 'none';
            }
        }
    }

    // Load Trending Content
    async loadTrending() {
        const trendingRow = document.getElementById('trending-row');
        const trendingSection = document.getElementById('trending-section');
        
        if (!trendingRow) return;

        try {
            // Try to get trending from backend, fallback to stub data
            let items: MediaItem[] = [];
            try {
                items = await invoke<MediaItem[]>('get_trending');
            } catch (err) {
                console.warn('Backend trending not available, using stub data');
                // Use library items as trending for now
                items = this.libraryItems.slice(0, 10);
            }
            
            if (items.length === 0) {
                if (trendingSection) {
                    trendingSection.style.display = 'none';
                }
                return;
            }

            if (trendingSection) {
                trendingSection.style.display = 'block';
            }
            
            trendingRow.innerHTML = items.map(item => this.renderMediaCard(item, false, false)).join('');
            setupLazyLoading();
            this.attachCardListeners();
        } catch (err) {
            console.error('Error loading trending:', err);
            if (trendingSection) {
                trendingSection.style.display = 'none';
            }
        }
    }

    // Load Popular Content
    async loadPopular() {
        const popularRow = document.getElementById('popular-row');
        const popularSection = document.getElementById('popular-section');
        
        if (!popularRow) return;

        try {
            // Try to get popular from backend, fallback to stub data
            let items: MediaItem[] = [];
            try {
                items = await invoke<MediaItem[]>('get_popular');
            } catch (err) {
                console.warn('Backend popular not available, using stub data');
                // Use library items as popular for now
                items = this.libraryItems.slice(0, 10);
            }
            
            if (items.length === 0) {
                if (popularSection) {
                    popularSection.style.display = 'none';
                }
                return;
            }

            if (popularSection) {
                popularSection.style.display = 'block';
            }
            
            popularRow.innerHTML = items.map(item => this.renderMediaCard(item, false, false)).join('');
            setupLazyLoading();
            this.attachCardListeners();
        } catch (err) {
            console.error('Error loading popular:', err);
            if (popularSection) {
                popularSection.style.display = 'none';
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
            Toast.error('Couldn\'t add to watchlist. Please try again.');
        }
    }

    async removeFromWatchlist(mediaId: string): Promise<void> {
        try {
            await invoke('remove_from_watchlist', { media_id: mediaId });
            Toast.success('Removed from watchlist');
        } catch (err) {
            console.error('Error removing from watchlist:', err);
            Toast.error('Couldn\'t remove from watchlist. Please try again.');
        }
    }

    // Favorites
    async addToFavorites(mediaId: string): Promise<void> {
        try {
            await invoke('add_to_favorites', { media_id: mediaId });
            Toast.success('Added to favorites! ♥');
        } catch (err) {
            console.error('Error adding to favorites:', err);
            Toast.error('Couldn\'t add to favorites. Please try again.');
        }
    }

    async removeFromFavorites(mediaId: string): Promise<void> {
        try {
            await invoke('remove_from_favorites', { media_id: mediaId });
            Toast.success('Removed from favorites');
        } catch (err) {
            console.error('Error removing from favorites:', err);
            Toast.error('Couldn\'t remove from favorites. Please try again.');
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

    // Utility: Render error state with retry button
    renderErrorState(title: string, description: string, retryFn?: string): string {
        const retryButton = retryFn ? `
            <div class="error-actions">
                <button class="retry-btn" onclick="${retryFn}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                    </svg>
                    Retry
                </button>
            </div>
        ` : '';

        return `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h3 class="error-title">${escapeHtml(title)}</h3>
                <p class="error-description">${escapeHtml(description)}</p>
                ${retryButton}
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
