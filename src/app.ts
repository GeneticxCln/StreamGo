// StreamGo App - Main Application Logic
import type { MediaItem, UserPreferences } from './types/tauri.d';
import { invoke } from './utils';
import { escapeHtml } from './utils/security';
import { Toast, Modal } from './ui-utils';
import { SearchHistory } from './search-history';
import { initializeCasting, updateCastingInfo } from './casting-integration';
import { translateDOM, i18n } from './i18n';
import { settingsStore } from './stores/settings';

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
    private selectedStreamUrl: string | null = null;
    private searchHistory: SearchHistory;

    constructor() {
        this.searchHistory = new SearchHistory();
        this.currentSection = 'home';
        this.previousSection = 'home';
        this.searchResults = [];
        this.libraryItems = [];
        this.settings = null;
        this.currentMedia = null;
        this.mediaMap = {};
        this.init();
    }

    async init() {
        console.log('StreamGo initialized');
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        // Apply initial translations
        try { translateDOM(document); } catch {}
        // Re-translate on locale changes
        i18n.onLocaleChange(() => {
            try { translateDOM(document); } catch {}
        });

        // Listen for settings changes and update i18n locale
        settingsStore.subscribe(($settingsStore) => {
            if ($settingsStore.settings?.ui_language && $settingsStore.settings.ui_language !== i18n.getLocale()) {
                i18n.setLocale($settingsStore.settings.ui_language).catch(err => {
                    console.error('Failed to update i18n locale:', err);
                });
            }
        });
        this.setupSearchHistory();
        this.initializeTheme();
        this.loadSettings();
        
        // Initialize casting components
        initializeCasting();
        
        // Auto-install default addons if none are installed (like Stremio does)
        const installedDefault = await this.ensureDefaultAddons();
        
        
        // Auto-start with a catalog like Stremio (Movies -> first catalog)
        // Give more time if we just installed an addon
        const delay = installedDefault ? 1000 : 300;
        setTimeout(() => this.autoStartCatalog(), delay);
    }

    /**
     * Ensure default addons are installed (Cinemeta)
     * This runs on first launch to populate content like Stremio
     * @returns true if addon was installed, false otherwise
     */
    private async ensureDefaultAddons(): Promise<boolean> {
        try {
            const addons = await invoke<any[]>('get_addons');
            
            // If user already has addons, don't auto-install
            if (addons.length > 0) {
                console.log('Addons already installed, skipping auto-install');
                return false;
            }

            console.log('No addons found, installing default Cinemeta addon...');
            
            // Install Cinemeta (Stremio's official TMDB addon)
            const cinemataUrl = 'https://v3-cinemeta.strem.io/manifest.json';
            
            try {
                await invoke('install_addon', { manifest_url: cinemataUrl });
                console.log('Default Cinemeta addon installed successfully');
                
                // Wait a bit for addon to be fully initialized
                await new Promise(resolve => setTimeout(resolve, 500));
                
                return true;
            } catch (err) {
                console.warn('Could not auto-install Cinemeta:', err);
                return false;
            }
        } catch (err) {
            console.error('Error checking/installing default addons:', err);
            return false;
        }
    }

    initializeTheme() {
        // Resolve theme preference ('auto'/'system' follows OS setting)
        const preference = localStorage.getItem('theme') || 'auto';
        this.applyTheme(preference);

        // Listen for system theme changes when using auto/system
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        media.addEventListener('change', () => {
            const currentPref = localStorage.getItem('theme') || 'auto';
            if (currentPref === 'auto' || currentPref === 'system') {
                this.applyTheme(currentPref);
            }
        });
    }

    applyTheme(theme: string) {
        // Compute effective theme
        let effective = theme;
        if (theme === 'auto' || theme === 'system') {
            effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', effective);
        // Persist preference (not the resolved theme)
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
                    try {
                        window.dispatchEvent(new CustomEvent('streamgo:search', { detail: { query } }));
                    } catch {}
                }
            });
            globalSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    globalSearchBtn.click();
                }
            });
        }

    }

    setupKeyboardShortcuts() {
        // Global keyboard shortcuts
        document.addEventListener('keydown', async (e) => {
            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
            
            // Video player shortcuts
            const video = document.getElementById('video-player') as HTMLVideoElement;
            const playerContainer = document.getElementById('video-player-container');
            const isPlayerVisible = playerContainer && playerContainer.style.display !== 'none';
            
            if (isPlayerVisible && video) {
                // Play/Pause - Space or K
                if ((e.key === ' ' || e.key === 'k' || e.key === 'K') && !isInput) {
                    e.preventDefault();
                    if (video.paused) {
                        video.play();
                    } else {
                        video.pause();
                    }
                    return;
                }
                
                // Fullscreen - F
                if ((e.key === 'f' || e.key === 'F') && !isInput) {
                    e.preventDefault();
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    } else {
                        playerContainer.requestFullscreen();
                    }
                    return;
                }
                
                // Mute - M
                if ((e.key === 'm' || e.key === 'M') && !isInput) {
                    e.preventDefault();
                    video.muted = !video.muted;
                    return;
                }
                
                // Picture-in-Picture - P
                if ((e.key === 'p' || e.key === 'P') && !isInput) {
                    e.preventDefault();
                    await this.ensurePlayer().then(player => {
                        if (player && player.togglePictureInPicture) {
                            player.togglePictureInPicture();
                        }
                    }).catch(err => console.error('Failed to init player:', err));
                    return;
                }
                
                // Seek backwards - Left Arrow
                if (e.key === 'ArrowLeft' && !isInput) {
                    e.preventDefault();
                    video.currentTime = Math.max(0, video.currentTime - 10);
                    return;
                }
                
                // Seek forward - Right Arrow
                if (e.key === 'ArrowRight' && !isInput) {
                    e.preventDefault();
                    video.currentTime = Math.min(video.duration, video.currentTime + 10);
                    return;
                }
                
                // Volume up - Up Arrow
                if (e.key === 'ArrowUp' && !isInput) {
                    e.preventDefault();
                    video.volume = Math.min(1, video.volume + 0.1);
                    return;
                }
                
                // Volume down - Down Arrow
                if (e.key === 'ArrowDown' && !isInput) {
                    e.preventDefault();
                    video.volume = Math.max(0, video.volume - 0.1);
                    return;
                }
            }
            
            // Navigation shortcuts
            // Focus search - /
            if (e.key === '/' && !isInput) {
                e.preventDefault();
                const globalSearch = document.getElementById('global-search') as HTMLInputElement;
                if (globalSearch) {
                    globalSearch.focus();
                }
                return;
            }
            
            // Show shortcuts help - ?
            if (e.key === '?' && !isInput) {
                e.preventDefault();
                this.showShortcutsModal();
                return;
            }
            
            // Close player/modal - Escape
            if (e.key === 'Escape') {
                e.preventDefault();
                
                // Close shortcuts modal
                const shortcutsModal = document.getElementById('shortcuts-modal');
                if (shortcutsModal && shortcutsModal.style.display !== 'none') {
                    this.hideShortcutsModal();
                    return;
                }
                
                // Close player
                if (isPlayerVisible) {
                    this.closePlayer();
                    return;
                }
                return;
            }
        });
        
        // Setup shortcuts modal close button
        const closeBtn = document.getElementById('close-shortcuts-modal');
        closeBtn?.addEventListener('click', () => {
            this.hideShortcutsModal();
        });
    }

    showShortcutsModal() {
        const modal = document.getElementById('shortcuts-modal');
        if (modal) {
            modal.style.display = 'flex';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.right = '0';
            modal.style.bottom = '0';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            modal.style.zIndex = '9999';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.backdropFilter = 'blur(4px)';
        }
    }

    hideShortcutsModal() {
        const modal = document.getElementById('shortcuts-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    showSection(section: string): void {
        // Svelte-driven navigation: just update state and notify
        this.currentSection = section;
        try {
            window.dispatchEvent(new CustomEvent('streamgo:section-change', { detail: { section } }));
        } catch {}
    }



    private setupSearchHistory() {
        const globalSearchInput = document.getElementById('global-search') as HTMLInputElement;
        const dropdown = document.getElementById('search-history-dropdown');
        const clearAllBtn = document.getElementById('clear-history-btn');

        if (!globalSearchInput || !dropdown) return;

        // Show history on focus
        globalSearchInput.addEventListener('focus', () => {
            this.showSearchHistory();
        });

        // Hide history on blur (with delay to allow clicks)
        globalSearchInput.addEventListener('blur', () => {
            setTimeout(() => {
                this.hideSearchHistory();
            }, 200);
        });

        // Clear all history
        clearAllBtn?.addEventListener('click', () => {
            this.searchHistory.clearAll();
            this.renderSearchHistory();
        });

        // Initial render
        this.renderSearchHistory();
    }

    private showSearchHistory() {
        const dropdown = document.getElementById('search-history-dropdown');
        if (dropdown && this.searchHistory.hasHistory()) {
            dropdown.style.display = 'block';
            this.renderSearchHistory();
        }
    }

    private hideSearchHistory() {
        const dropdown = document.getElementById('search-history-dropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    private renderSearchHistory() {
        const list = document.getElementById('search-history-list');
        if (!list) return;

        const history = this.searchHistory.getHistory();
        
        if (history.length === 0) {
            list.innerHTML = '<div class="search-history-empty">No recent searches</div>';
            return;
        }

        list.innerHTML = history.map(query => `
            <div class="search-history-item" data-query="${escapeHtml(query)}">
                <div class="search-history-item-text">
                    <svg class="search-history-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                    </svg>
                    <span>${escapeHtml(query)}</span>
                </div>
                <button class="search-history-item-remove" data-query="${escapeHtml(query)}" title="Remove">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
        `).join('');

        // Attach click handlers
        list.querySelectorAll('.search-history-item').forEach(item => {
            const query = (item as HTMLElement).dataset.query;
            if (!query) return;

            // Click on item text to search
            const textEl = item.querySelector('.search-history-item-text');
            textEl?.addEventListener('click', () => {
                const globalSearchInput = document.getElementById('global-search') as HTMLInputElement;
                if (globalSearchInput) {
                    globalSearchInput.value = query;
                }
                this.hideSearchHistory();
                this.showSection('search');
                try {
                    window.dispatchEvent(new CustomEvent('streamgo:search', { detail: { query } }));
                } catch {}
            });

            // Click on remove button
            const removeBtn = item.querySelector('.search-history-item-remove');
            removeBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.searchHistory.removeQuery(query);
                this.renderSearchHistory();
            });
        });
    }



    private async autoStartCatalog() {
        console.log('autoStartCatalog: Starting...');
        
        // Simply switch to discover section - it will auto-load the first catalog
        this.showSection('discover');
    }

    /**
     * Update filter UI based on current catalog capabilities
     */




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





    async addToLibrary(item: MediaItem): Promise<void> {
        try {
            await invoke('add_to_library', { item });
            Toast.success(`"${item.title}" added to library!`);
        } catch (err) {
            console.error('Error adding to library:', err);
            Toast.error('Couldn\'t add to library. Please try again.');
        }
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

        // Re-attach context menu handlers for dynamically rendered cards
        try {
            const cm = (window as any).contextMenuManager;
            if (cm && typeof cm.attachToCards === 'function') {
                cm.attachToCards();
            }
        } catch {}
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
            <div class="meta-item-container poster-shape-poster animation-fade-in" data-media-id="${escapedId}" data-context-menu="true">
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
            ui_language: 'en',
            region: 'auto',
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
        
        // Notifications
        this.setCheckboxIfExists('notifications-toggle', this.settings.notifications_enabled);
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
            ui_language: (document.getElementById('ui-language') as HTMLSelectElement)?.value || 'en',
            region: (document.getElementById('region') as HTMLSelectElement)?.value || 'auto',
            notifications_enabled: (document.getElementById('notifications-toggle') as HTMLInputElement)?.checked ?? true,
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
            // Apply theme immediately
            this.applyTheme(settings.theme);
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

    async exportUserData(): Promise<void> {
        try {
            const data = await invoke('export_user_data');
            
            // Create JSON file and download
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            const timestamp = new Date().toISOString().split('T')[0];
            a.download = `streamgo-backup-${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            Toast.success('Data exported successfully!');
        } catch (err) {
            console.error('Error exporting data:', err);
            Toast.error(`Error exporting data: ${err}`);
        }
    }

    triggerImportDialog(): void {
        const fileInput = document.getElementById('import-data-file') as HTMLInputElement;
        if (fileInput) {
            fileInput.click();
        }
    }

    async importUserData(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            const confirmed = await Modal.confirm(
                'Are you sure you want to import this data? This will merge with your existing library and settings.',
                'Import Data'
            );
            
            if (!confirmed) {
                input.value = ''; // Reset file input
                return;
            }
            
            await invoke('import_user_data', { data });
            
            Toast.success('Data imported successfully! Reloading...');
            
            // Reload app data
            await this.loadSettings();
            
            input.value = ''; // Reset file input
        } catch (err) {
            console.error('Error importing data:', err);
            Toast.error(`Error importing data: ${err}`);
            input.value = ''; // Reset file input
        }
    }

    async checkNewEpisodes(): Promise<void> {
        try {
            Toast.info('Checking for new episodes...');
            
            const newEpisodes = await invoke<any[]>('check_new_episodes');
            
            if (newEpisodes.length === 0) {
                Toast.success('No new episodes found');
                return;
            }
            
            // Show notification for each new episode
            for (const ep of newEpisodes) {
                const title = `New Episode: ${ep.series_name}`;
                const body = `S${ep.season}E${ep.episode}: ${ep.title || 'Available now!'}`;
                
                try {
                    // Use browser Notification API
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(title, { body, icon: ep.poster_url });
                    } else if ('Notification' in window && Notification.permission !== 'denied') {
                        const permission = await Notification.requestPermission();
                        if (permission === 'granted') {
                            new Notification(title, { body, icon: ep.poster_url });
                        }
                    }
                } catch (notifErr) {
                    console.warn('Could not show notification:', notifErr);
                }
            }
            
            Toast.success(`Found ${newEpisodes.length} new episode${newEpisodes.length > 1 ? 's' : ''}!`);
        } catch (err) {
            console.error('Error checking for new episodes:', err);
            Toast.error(`Error checking episodes: ${err}`);
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

        // Notify Svelte detail section
        try {
            window.dispatchEvent(new CustomEvent('streamgo:detail-media', { detail: { media } }));
        } catch {}
        
        // Legacy DOM render replaced by Svelte DetailSection
        // this.renderMediaDetail(media);
    }




    private getMediaTypeString(mediaType: any): string {
        if (typeof mediaType === 'string') return mediaType.toLowerCase();
        if (mediaType && typeof mediaType === 'object') {
            if ('Movie' in mediaType) return 'movie';
            if ('TvShow' in mediaType) return 'series';
            if ('Episode' in mediaType) return 'episode';
            if ('Documentary' in mediaType) return 'movie';
            if ('LiveTv' in mediaType) return 'live';
            if ('Podcast' in mediaType) return 'podcast';
        }
        return 'movie';
    }


    async playMedia(mediaId: string): Promise<void> {
        try {
            Toast.info('Loading stream...');
            const media = this.currentMedia || this.mediaMap[mediaId];
            const typeStr = (() => {
                if (!media) return undefined;
                const mt: any = media.media_type;
                if (typeof mt === 'string') return mt.toLowerCase();
                if (mt && typeof mt === 'object') {
                    if ('Movie' in mt) return 'movie';
                    if ('TvShow' in mt) return 'series';
                    if ('Episode' in mt) return 'episode';
                    if ('Documentary' in mt) return 'movie';
                    if ('LiveTv' in mt) return 'live';
                    if ('Podcast' in mt) return 'podcast';
                }
                return undefined;
            })();
            const streamUrl = this.selectedStreamUrl || await invoke<string>('get_stream_url', { contentId: mediaId, mediaType: typeStr });
            
            // Set stream URL for external player manager
            const externalPlayerManager = (window as any).externalPlayerManager;
            if (externalPlayerManager) {
                externalPlayerManager.setCurrentStream(streamUrl);
            }
            
            // Check for existing watch progress
            let startTime = 0;
            if (this.currentMedia) {
                const progress = this.currentMedia.progress || 0;
                if (progress > 30) { // Only resume if more than 30 seconds watched
                    const shouldResume = await this.showResumePrompt(progress);
                    if (shouldResume) {
                        startTime = progress;
                    }
                }
            }
            
            // Update casting info with current video
            updateCastingInfo(
                streamUrl,
                this.currentMedia?.title || 'Video',
                undefined // TODO: Add subtitle URL when available
            );
            
            // Ensure player is loaded, then play
            const player = await this.ensurePlayer();
            if (player) {
                if (this.currentMedia && typeof player.setCurrentMedia === 'function') {
                    player.setCurrentMedia({
                        id: this.currentMedia.id,
                        title: this.currentMedia.title,
                        duration: this.currentMedia.duration || 0,
                        media_type: this.currentMedia.media_type,
                    });
                }
                player.loadVideo(streamUrl, this.currentMedia?.title || 'Video', startTime);
            } else {
                console.error('Player not initialized');
                Toast.error('Video player not available');
            }
        } catch (err) {
            console.error('Error getting stream:', err);

            // Provide specific error messages based on error type
            const errorMessage = String(err);
            if (errorMessage.includes('No working addons available')) {
                Toast.error('No content sources available. Please install addons from the Add-ons section first.');
            } else if (errorMessage.includes('Failed to load addons')) {
                Toast.error('Content sources not loading. Please check your internet connection and try again.');
            } else if (errorMessage.includes('TMDB_API_KEY')) {
                Toast.error('TMDB API key not configured. Please add your API key to the .env file.');
            } else {
                Toast.error(`Playback failed: ${errorMessage}`);
            }
        }
    }

    /**
     * Play media from a playlist with queue context
     */
    async playMediaFromPlaylist(items: MediaItem[], currentIndex: number): Promise<void> {
        try {
            const media = items[currentIndex];
            if (!media) {
                console.error('Media item not found at index', currentIndex);
                return;
            }

            // Show media detail first
            this.showMediaDetail(media.id);

            // Create playlist context
            const playlistContext = {
                items: items.map(item => ({
                    id: item.id,
                    title: item.title
                })),
                currentIndex,
                onNext: async () => {
                    if (currentIndex < items.length - 1) {
                        await this.playMediaFromPlaylist(items, currentIndex + 1);
                    }
                },
                onPrevious: async () => {
                    if (currentIndex > 0) {
                        await this.playMediaFromPlaylist(items, currentIndex - 1);
                    }
                }
            };

            // Load stream
            Toast.info('Loading stream...');
            const typeStr = this.getMediaTypeString(media.media_type);
            const streamUrl = await invoke<string>('get_stream_url', { 
                contentId: media.id, 
                mediaType: typeStr 
            });

            // Set stream URL for external player
            const externalPlayerManager = (window as any).externalPlayerManager;
            if (externalPlayerManager) {
                externalPlayerManager.setCurrentStream(streamUrl);
            }

            // Check for watch progress
            let startTime = 0;
            const progress = media.progress || 0;
            if (progress > 30) {
                const shouldResume = await this.showResumePrompt(progress);
                if (shouldResume) {
                    startTime = progress;
                }
            }

            // Update casting info for playlist item
            updateCastingInfo(
                streamUrl,
                media.title,
                undefined
            );
            
            // Ensure player is loaded, then play with playlist context
            const player = await this.ensurePlayer();
            if (player) {
                player.setPlaylistContext(playlistContext);
                if (typeof player.setCurrentMedia === 'function') {
                    player.setCurrentMedia({
                        id: media.id,
                        title: media.title,
                        duration: media.duration || 0,
                        media_type: media.media_type,
                    });
                }
                player.loadVideo(streamUrl, media.title, startTime);
            } else {
                console.error('Player not initialized');
                Toast.error('Video player not available');
            }
        } catch (err) {
            console.error('Error playing from playlist:', err);
            const errorMessage = String(err);
            if (errorMessage.includes('No working addons available')) {
                Toast.error('No content sources available. Please install addons.');
            } else {
                Toast.error(`Playback failed: ${errorMessage}`);
            }
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
    
    /**
     * Ensure player is initialized (lazy loading)
     */
    private async ensurePlayer(): Promise<any> {
        const initPlayer = (window as any).initPlayer;
        if (initPlayer && typeof initPlayer === 'function') {
            return await initPlayer();
        }
        // Fallback to existing player if already initialized
        return (window as any).player || null;
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

            // Don't save progress if it's near the end (already marked as watched)
            if (watched) {
                await invoke('update_watch_progress', { mediaId: this.currentMedia.id, progress: 0, watched: true });
            } else if (progress > 0) {
                await invoke('update_watch_progress', { mediaId: this.currentMedia.id, progress, watched: false });
            }

            console.log(`Progress updated: ${progress}s, watched: ${watched}`);
        } catch (err) {
            console.error('Error updating watch progress:', err);
        }
    }

    /**
     * Show resume prompt modal
     */
    private async showResumePrompt(progressSeconds: number): Promise<boolean> {
        return new Promise((resolve) => {
            const formatTime = (seconds: number): string => {
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                const secs = Math.floor(seconds % 60);
                if (hours > 0) {
                    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                }
                return `${minutes}:${secs.toString().padStart(2, '0')}`;
            };

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.style.zIndex = '10000';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3>⏱️ Resume Playback?</h3>
                    </div>
                    <div class="modal-body" style="padding: 20px;">
                        <p style="margin-bottom: 20px;">You were watching this at <strong>${formatTime(progressSeconds)}</strong>.</p>
                        <p style="color: var(--text-secondary); font-size: 14px;">Would you like to resume from where you left off?</p>
                    </div>
                    <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end; padding: 16px 20px;">
                        <button class="btn btn-secondary" id="resume-start-over">Start Over</button>
                        <button class="btn btn-primary" id="resume-continue">Resume</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const resumeBtn = modal.querySelector('#resume-continue');
            const startOverBtn = modal.querySelector('#resume-start-over');

            const cleanup = () => {
                modal.remove();
            };

            resumeBtn?.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            startOverBtn?.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            // Auto-resume after 10 seconds
            setTimeout(() => {
                if (modal.parentElement) {
                    cleanup();
                    resolve(true);
                }
            }, 10000);
        });
    }





    // Map Addon MetaPreview to a minimal MediaItem for UI rendering

    // Load Trending Content using addon catalogs

    // Load Popular Content using addon catalogs

    // Watchlist
    async addToWatchlist(mediaId: string): Promise<void> {
        try {
            await invoke('add_to_watchlist', { mediaId: mediaId });
            Toast.success('Added to watchlist!');
        } catch (err) {
            console.error('Error adding to watchlist:', err);
            Toast.error('Couldn\'t add to watchlist. Please try again.');
        }
    }

    async removeFromWatchlist(mediaId: string): Promise<void> {
        try {
            await invoke('remove_from_watchlist', { mediaId: mediaId });
            Toast.success('Removed from watchlist');
        } catch (err) {
            console.error('Error removing from watchlist:', err);
            Toast.error('Couldn\'t remove from watchlist. Please try again.');
        }
    }

    // Favorites
    async addToFavorites(mediaId: string): Promise<void> {
        try {
            await invoke('add_to_favorites', { mediaId: mediaId });
            Toast.success('Added to favorites! ♥');
        } catch (err) {
            console.error('Error adding to favorites:', err);
            Toast.error('Couldn\'t add to favorites. Please try again.');
        }
    }

    async removeFromFavorites(mediaId: string): Promise<void> {
        try {
            await invoke('remove_from_favorites', { mediaId: mediaId });
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
}

// Export for use in main.ts
// The initialization is now handled by main.ts
