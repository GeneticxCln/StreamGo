// StreamGo App - Main Application Logic
import type { MediaItem, UserPreferences } from './types/tauri';
import { invoke } from './utils';
import { escapeHtml } from './utils/security';
import { Toast, Modal } from './ui-utils';
import { setupLazyLoading } from './utils/imageLazyLoad';
import { SearchHistory } from './search-history';

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
    private currentStreams: any[] = [];
    private selectedStreamUrl: string | null = null;
    private currentSubtitles: any[] = [];
    private discover = { 
        mediaType: 'movie', 
        catalogId: '', 
        items: [] as any[], 
        page: 0, 
        pageSize: 20, 
        loading: false, 
        catalogs: [] as any[], 
        skip: 0, 
        hasMore: false,
        // Filter state
        filters: {
            genre: '',
            search: '',
            year: ''
        },
        currentCatalog: null as any
    };
    private searchHistory: SearchHistory;
    private calendar = {
        entries: [] as import('./types/tauri').CalendarEntry[],
        daysAhead: 14,
        loading: false,
    };

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
        this.attachDiscoverEventListeners();
        this.attachSubtitleSelectorListeners();
        this.setupSearchHistory();
        this.initializeTheme();
        this.loadSettings();
        this.loadLibrary();
        
        // Auto-install default addons if none are installed (like Stremio does)
        const installedDefault = await this.ensureDefaultAddons();
        
        this.loadAddons();
        this.loadContinueWatching();
        
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

    setupKeyboardShortcuts() {
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
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
                    const player = (window as any).player;
                    if (player && player.togglePictureInPicture) {
                        player.togglePictureInPicture();
                    }
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
        } else if (section === 'discover') {
            this.initDiscover();
        } else if (section === 'library') {
            this.loadLibrary();
        } else if (section === 'addons') {
            this.loadAddons();
        } else if (section === 'settings') {
            this.loadSettings();
        } else if (section === 'diagnostics') {
            this.loadDiagnostics();
        } else if (section === 'calendar') {
            this.attachCalendarListeners();
            this.loadCalendar();
        }
    }

    private attachDiscoverEventListeners() {
        const typeSelect = document.getElementById('discover-type-select') as HTMLSelectElement | null;
        const catalogSelect = document.getElementById('discover-catalog-select') as HTMLSelectElement | null;
        const loadMoreBtn = document.getElementById('discover-load-more') as HTMLButtonElement | null;
        
        // Filter controls
        const genreSelect = document.getElementById('discover-genre-select') as HTMLSelectElement | null;
        const yearSelect = document.getElementById('discover-year-select') as HTMLSelectElement | null;
        const searchInput = document.getElementById('discover-search-input') as HTMLInputElement | null;
        const applyFiltersBtn = document.getElementById('discover-apply-filters-btn') as HTMLButtonElement | null;
        const clearFiltersBtn = document.getElementById('discover-clear-filters-btn') as HTMLButtonElement | null;

        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                this.discover.mediaType = typeSelect.value || 'movie';
                this.discover.catalogId = '';
                this.discover.items = [];
                this.discover.page = 0;
                this.discover.currentCatalog = null;
                this.loadDiscoverCatalogs();
            });
        }
        
        if (catalogSelect) {
            catalogSelect.addEventListener('change', () => {
                this.discover.catalogId = catalogSelect.value || '';
                // Find and store current catalog
                this.discover.currentCatalog = this.discover.catalogs.find((c: any) => c.id === this.discover.catalogId) || null;
                // Update filter UI based on catalog capabilities
                this.updateFilterUI();
                // Auto-load when catalog changes
                if (this.discover.catalogId) {
                    this.loadDiscoverItems(true);
                }
            });
        }
        
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                // Collect filter values
                if (genreSelect) this.discover.filters.genre = genreSelect.value;
                if (yearSelect) this.discover.filters.year = yearSelect.value;
                if (searchInput) this.discover.filters.search = searchInput.value.trim();
                // Reload with filters
                this.loadDiscoverItems(true);
            });
        }
        
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                // Clear all filters
                this.discover.filters.genre = '';
                this.discover.filters.year = '';
                this.discover.filters.search = '';
                // Reset UI
                if (genreSelect) genreSelect.value = '';
                if (yearSelect) yearSelect.value = '';
                if (searchInput) searchInput.value = '';
                // Reload without filters
                this.loadDiscoverItems(true);
            });
        }
        
        // Allow Enter key to apply filters in search
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && applyFiltersBtn) {
                    applyFiltersBtn.click();
                }
            });
        }
        
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadDiscoverItems(false);
            });
        }
    }

    private attachCalendarListeners() {
        const daysSelect = document.getElementById('calendar-days') as HTMLSelectElement | null;
        const refreshBtn = document.getElementById('calendar-refresh-btn') as HTMLButtonElement | null;
        if (daysSelect && !daysSelect.dataset.bound) {
            daysSelect.dataset.bound = '1';
            daysSelect.addEventListener('change', () => {
                const val = parseInt(daysSelect.value, 10);
                this.calendar.daysAhead = isNaN(val) ? 14 : val;
                this.loadCalendar();
            });
        }
        if (refreshBtn && !refreshBtn.dataset.bound) {
            refreshBtn.dataset.bound = '1';
            refreshBtn.addEventListener('click', () => this.loadCalendar());
        }
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
                const searchInput = document.getElementById('search-input') as HTMLInputElement;
                if (searchInput) {
                    searchInput.value = query;
                }
                this.performSearch(query);
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

    private async initDiscover() {
        const typeSelect = document.getElementById('discover-type-select') as HTMLSelectElement | null;
        if (typeSelect) {
            this.discover.mediaType = typeSelect.value || this.discover.mediaType;
        }
        await this.loadDiscoverCatalogs();
    }

    private async loadDiscoverCatalogs() {
        const catalogSelect = document.getElementById('discover-catalog-select') as HTMLSelectElement | null;
        const grid = document.getElementById('discover-grid');
        const loading = document.getElementById('discover-loading');
        const loadMoreBtn = document.getElementById('discover-load-more');
        try {
            if (loading) loading.style.display = 'block';
            if (grid) grid.innerHTML = this.renderSkeletonGrid(8);
            console.log(`Loading catalogs for media type: ${this.discover.mediaType}`);
            const catalogs = await invoke<any[]>('list_catalogs', { mediaType: this.discover.mediaType });
            console.log(`Received ${catalogs?.length || 0} catalogs:`, catalogs);
            this.discover.catalogs = Array.isArray(catalogs) ? catalogs : [];
            if (catalogSelect) {
                catalogSelect.innerHTML = '<option value="">Select a catalog...</option>' +
                    this.discover.catalogs.map(c => `<option value="${escapeHtml(String(c.id))}">${escapeHtml(String(c.name))} — ${escapeHtml(String(c.addon_name || ''))}</option>`).join('');
                // Preselect first catalog if available
                const first = this.discover.catalogs[0];
                if (first) {
                    catalogSelect.value = first.id;
                    this.discover.catalogId = first.id;
                    this.discover.currentCatalog = first;
                    console.log(`Preselected catalog: ${first.name} (${first.id})`);
                    // Auto-load content for first catalog
                    this.updateFilterUI();
                    await this.loadDiscoverItems(true);
                    return; // Skip setting empty message since we're loading content
                } else {
                    this.discover.catalogId = '';
                }
            }
            // Reset grid and paging state (only if no catalog was preselected)
            this.discover.items = [];
            this.discover.page = 0;
            this.discover.skip = 0;
            this.discover.hasMore = false;
            if (grid) grid.innerHTML = '<p class="empty-message">Select a catalog to browse content</p>';
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        } catch (err) {
            console.error('Failed to load catalogs - FULL ERROR:', err);
            console.error('Error type:', typeof err);
            console.error('Error details:', JSON.stringify(err, null, 2));
            const errorMessage = String(err);
            console.error('Error as string:', errorMessage);
            let userMessage = 'Unable to load catalogs';

            if (errorMessage.includes('No working addons available')) {
                userMessage = 'No content sources available';
            } else if (errorMessage.includes('Failed to load addons')) {
                userMessage = 'Content sources not loading';
            }

            if (grid) grid.innerHTML = this.renderErrorState(userMessage + '<br><small style="color: #ff6b6b; font-size: 12px; margin-top: 8px; display: block;">Debug: ' + escapeHtml(errorMessage) + '</small>', 'Please check the developer console for more details.');
        } finally {
            if (loading) loading.style.display = 'none';
        }
    }

    private async autoStartCatalog() {
        console.log('autoStartCatalog: Starting...');
        
        // Simply switch to discover section - it will auto-load the first catalog
        this.showSection('discover');
    }

    /**
     * Update filter UI based on current catalog capabilities
     */
    private updateFilterUI() {
        const filtersPanel = document.getElementById('discover-filters-panel');
        const genreContainer = document.getElementById('filter-genre-container');
        const yearContainer = document.getElementById('filter-year-container');
        const searchContainer = document.getElementById('filter-search-container');
        const genreSelect = document.getElementById('discover-genre-select') as HTMLSelectElement | null;
        const yearSelect = document.getElementById('discover-year-select') as HTMLSelectElement | null;
        
        if (!filtersPanel || !this.discover.currentCatalog) {
            if (filtersPanel) filtersPanel.style.display = 'none';
            return;
        }
        
        const catalog = this.discover.currentCatalog;
        const extraSupported = catalog.extra_supported || [];
        let hasAnyFilter = false;
        
        // Genre filter
        if (genreContainer && genreSelect && catalog.genres && catalog.genres.length > 0) {
            genreContainer.style.display = 'block';
            genreSelect.innerHTML = '<option value="">All Genres</option>' +
                catalog.genres.map((g: string) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
            hasAnyFilter = true;
        } else if (genreContainer) {
            genreContainer.style.display = 'none';
        }
        
        // Search filter
        if (searchContainer && extraSupported.includes('search')) {
            searchContainer.style.display = 'block';
            hasAnyFilter = true;
        } else if (searchContainer) {
            searchContainer.style.display = 'none';
        }
        
        // Year filter (generate year list)
        if (yearContainer && yearSelect) {
            const currentYear = new Date().getFullYear();
            const years = [];
            for (let y = currentYear; y >= 1920; y--) {
                years.push(y);
            }
            yearContainer.style.display = 'block';
            yearSelect.innerHTML = '<option value="">All Years</option>' +
                years.map(y => `<option value="${y}">${y}</option>`).join('');
            hasAnyFilter = true;
        }
        
        // Show/hide panel
        filtersPanel.style.display = hasAnyFilter ? 'block' : 'none';
    }

    private async loadDiscoverItems(reset: boolean) {
        const grid = document.getElementById('discover-grid');
        const loading = document.getElementById('discover-loading');
        const loadMoreBtn = document.getElementById('discover-load-more') as HTMLButtonElement | null;
        if (!this.discover.catalogId) {
            if (grid) {
                if (this.discover.catalogs.length === 0) {
                    grid.innerHTML = '<p class="empty-message">No content sources available. Please install addons from the Add-ons section first.</p>';
                } else {
                    grid.innerHTML = '<p class="empty-message">Select a catalog to browse content</p>';
                }
            }
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }
        try {
            if (reset) {
                this.discover.items = [];
                this.discover.page = 0;
                this.discover.skip = 0;
                this.discover.hasMore = false;
            }
            if (loading) loading.style.display = 'block';
            if (grid && reset) grid.innerHTML = this.renderSkeletonGrid(8);
            
            // Build extras with filters
            const extras: any = { 
                skip: String(this.discover.skip), 
                limit: String(this.discover.pageSize) 
            };
            
            // Add active filters to extras
            if (this.discover.filters.genre) {
                extras.genre = this.discover.filters.genre;
            }
            if (this.discover.filters.search) {
                extras.search = this.discover.filters.search;
            }
            if (this.discover.filters.year) {
                extras.genre = this.discover.filters.year; // Stremio uses 'genre' param for year filtering
            }
            
            const result = await invoke<any>('aggregate_catalogs', { mediaType: this.discover.mediaType, catalogId: this.discover.catalogId, extra: extras });
            const metas = (result && Array.isArray(result.items)) ? result.items : [];
            const newItems = metas.map((m: any) => this.mapMetaPreviewToMediaItem(m));
            // Deduplicate by id
            const existingIds = new Set(this.discover.items.map(i => i.id));
            const appended = newItems.filter((i: any) => !existingIds.has(i.id));
            this.discover.items = this.discover.items.concat(appended);
            this.discover.skip += metas.length;
            this.discover.hasMore = metas.length >= this.discover.pageSize;
            this.renderDiscoverPage();
            if (loadMoreBtn) loadMoreBtn.style.display = this.discover.hasMore ? 'inline-flex' : 'none';
        } catch (err) {
            console.error('Failed to load catalog items:', err);
            const errorMessage = String(err);
            let userMessage = 'Unable to load catalog items';

            if (errorMessage.includes('No working addons available')) {
                userMessage = 'No content sources available';
            } else if (errorMessage.includes('Failed to load addons')) {
                userMessage = 'Content sources not loading';
            }

            if (grid) grid.innerHTML = this.renderErrorState(userMessage, 'Please install addons from the Add-ons section first.');
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        } finally {
            if (loading) loading.style.display = 'none';
        }
    }

    private renderDiscoverPage() {
        const grid = document.getElementById('discover-grid');
        const loadMoreBtn = document.getElementById('discover-load-more') as HTMLButtonElement | null;
        const pageItems = this.discover.items;
        if (!grid) return;
        if (pageItems.length === 0) {
            grid.innerHTML = '<p class="empty-message">No items found in this catalog</p>';
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }
        grid.innerHTML = pageItems.map(item => this.renderMediaCard(item, false, false)).join('');
        setupLazyLoading();
        this.attachCardListeners();
        if (loadMoreBtn) loadMoreBtn.style.display = this.discover.hasMore ? 'inline-flex' : 'none';
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

    private async loadCalendar() {
        const container = document.getElementById('calendar-container');
        if (!container) return;
        try {
            this.calendar.loading = true;
            container.innerHTML = '<div class="loading-spinner">Loading calendar...</div>';
            const entries = await invoke<import('./types/tauri').CalendarEntry[]>('get_calendar', { days_ahead: this.calendar.daysAhead });
            this.calendar.entries = Array.isArray(entries) ? entries : [];
            this.renderCalendar();
        } catch (err) {
            console.error('Failed to load calendar:', err);
            container.innerHTML = this.renderErrorState('Unable to load calendar', 'Please try again later.', 'app.loadCalendar()');
        } finally {
            this.calendar.loading = false;
        }
    }

    private renderCalendar() {
        const container = document.getElementById('calendar-container');
        if (!container) return;
        const entries = this.calendar.entries;
        if (!entries || entries.length === 0) {
            container.innerHTML = '<p class="empty-message">No upcoming episodes found for the selected range.</p>';
            return;
        }
        // Group by local date
        const groups: Record<string, import('./types/tauri').CalendarEntry[]> = {};
        entries.forEach(e => {
            const d = new Date(e.air_date);
            const key = d.toISOString().split('T')[0];
            (groups[key] ||= []).push(e);
        });
        const orderedKeys = Object.keys(groups).sort();
        const html = orderedKeys.map(key => {
            const d = new Date(key + 'T00:00:00Z');
            const title = this.formatRelativeDateClient(d);
            const cards = groups[key]
                .sort((a, b) => new Date(a.air_date).getTime() - new Date(b.air_date).getTime())
                .map(e => this.renderCalendarCard(e))
                .join('');
            return `
                <div class="calendar-day">
                    <div class="calendar-day-header">
                        <div class="calendar-day-title">${this.escape(title)}</div>
                        <div class="calendar-day-date">${this.escape(key)}</div>
                    </div>
                    <div class="calendar-episodes">${cards}</div>
                </div>
            `;
        }).join('');
        container.innerHTML = html;
    }

    private renderCalendarCard(e: import('./types/tauri').CalendarEntry) {
        const poster = this.escape(e.poster_url || 'https://via.placeholder.com/160x240?text=No+Poster');
        const series = this.escape(e.series_name);
        const epTitle = this.escape(e.title);
        const se = `S${e.season}E${e.episode}`;
        const time = new Date(e.air_date).toLocaleString();
        const desc = e.description ? `<div class="calendar-card-desc">${this.escape(e.description)}</div>` : '';
        return `
            <div class="calendar-card">
                <img src="${poster}" alt="${series}" class="calendar-card-poster" loading="lazy" />
                <div class="calendar-card-body">
                    <div class="calendar-card-title">${series}</div>
                    <div class="calendar-card-meta">${se} • ${this.escape(epTitle)}</div>
                    <div class="calendar-card-meta">${this.escape(time)}</div>
                    ${desc}
                </div>
            </div>
        `;
    }

    private formatRelativeDateClient(date: Date): string {
        const today = new Date();
        const d0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffDays = Math.round((d1.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
        return date.toLocaleDateString();
    }

    private escape(s: string): string { return escapeHtml(String(s)); }

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

            // Save successful search to history
            this.searchHistory.addQuery(query);

            resultsEl.innerHTML = results.map(item => this.renderMediaCard(item, true)).join('');

            // Initialize lazy loading for newly rendered images
            setupLazyLoading();

            // Add event listeners to cards and buttons
            this.attachCardListeners();

        } catch (err) {
            console.error('Search error:', err);
            const errorMessage = String(err);
            let userMessage = 'Search unavailable';
            let userDescription = 'We couldn\'t complete your search.';

            if (errorMessage.includes('TMDB_API_KEY')) {
                userMessage = 'TMDB API key not configured';
                userDescription = 'Please add your TMDB API key to the .env file to enable search functionality.';
            } else if (errorMessage.includes('No working addons available')) {
                userMessage = 'No content sources available';
                userDescription = 'Please install addons from the Add-ons section first.';
            } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
                userDescription = 'Please check your internet connection and try again.';
            }

            resultsEl.innerHTML = this.renderErrorState(
                userMessage,
                userDescription,
                `app.performSearch('${escapeHtml(query)}')`
            );

            if (errorMessage.includes('TMDB_API_KEY')) {
                Toast.error('TMDB API key not configured. Please add your API key to the .env file.');
            } else {
                Toast.error('Search failed. Please check your connection and try again.');
            }
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
            console.log('Addons from backend:', JSON.stringify(addons, null, 2));

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

            // Auto-disable unhealthy addons (health_score < 30)
            try {
                const toDisable = addons.filter((a: any) => {
                    const h = healthData.get(a.id);
                    return a.enabled && h && typeof h.health_score === 'number' && h.health_score < 30;
                });
                if (toDisable.length > 0) {
                    for (const a of toDisable) {
                        try {
                            await invoke('disable_addon', { addon_id: a.id });
                            const h = healthData.get(a.id);
                            const score = h && h.health_score !== undefined ? Math.round(h.health_score) : 'low';
                            Toast.info(`Disabled add-on "${escapeHtml(a.name)}" due to poor health (${score})`);
                        } catch (e) {
                            console.warn('Failed to auto-disable addon', a.id, e);
                        }
                    }
                    await this.loadAddons();
                    return;
                }
            } catch (e) {
                console.warn('Auto-disable check failed:', e);
            }

            addonsEl.innerHTML = addons.map(addon => {
                const health = healthData.get(addon.id);
                return this.renderAddonCard(addon, health);
            }).join('');
            this.attachAddonActionListeners();

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

        const healthTitle = health
            ? `Health Score: ${Math.round(healthScore)}${health.last_error ? ' • Last error: ' + escapeHtml(String(health.last_error)) : ''}`
            : '';

        return `
            <div class="addon-card">
                <div class="addon-header">
                    <div class="addon-title-group">
                        <h3>${escapeHtml(addon.name)}</h3>
                        <span class="addon-version">v${escapeHtml(addon.version)}</span>
                    </div>
                    <div class="addon-badges">
                        ${health ? `<span class="addon-health-badge ${healthBadgeClass}" title="${healthTitle}">${healthStatusText}</span>` : ''}
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
                <div class="addon-actions" style="margin-top: 10px; display: flex; gap: 8px;">
                    <button class="btn btn-secondary addon-action ${addon.enabled ? 'btn-disable' : 'btn-enable'}" data-id="${escapeHtml(addon.id)}">
                        ${addon.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button class="btn btn-secondary addon-action btn-uninstall" data-id="${escapeHtml(addon.id)}">Uninstall</button>
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
            'Enter the add-on base URL (or manifest.json)',
            'Install Add-on',
            'https://example.com/addon'
        );
        if (!url) return;

        try {
            Toast.info('Installing add-on...');
            const addonId = await invoke<string>('install_addon', { addon_url: url, addonUrl: url });
            Toast.success(`Add-on installed successfully! ID: ${addonId}`);
            await this.loadAddons();
        } catch (err) {
            console.error('Error installing add-on:', err);
            Toast.error(`Error installing add-on: ${err}`);
        }
    }

    private attachAddonActionListeners() {
        // Enable
        document.querySelectorAll('.btn-enable.addon-action').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = (btn as HTMLElement).getAttribute('data-id') || '';
                if (!id) return;
                await this.enableAddon(id);
            });
        });
        // Disable
        document.querySelectorAll('.btn-disable.addon-action').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = (btn as HTMLElement).getAttribute('data-id') || '';
                if (!id) return;
                await this.disableAddon(id);
            });
        });
        // Uninstall
        document.querySelectorAll('.btn-uninstall.addon-action').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = (btn as HTMLElement).getAttribute('data-id') || '';
                if (!id) return;
                const confirmed = await Modal.confirm('Uninstall this add-on?', 'Uninstall Add-on');
                if (!confirmed) return;
                await this.uninstallAddon(id);
            });
        });
    }

    private async enableAddon(id: string) {
        try {
            await invoke('enable_addon', { addon_id: id });
            Toast.success('Add-on enabled');
            await this.loadAddons();
        } catch (e) {
            console.error('Enable addon failed:', e);
            Toast.error(`Failed to enable add-on: ${e}`);
        }
    }

    private async disableAddon(id: string) {
        try {
            await invoke('disable_addon', { addon_id: id });
            Toast.success('Add-on disabled');
            await this.loadAddons();
        } catch (e) {
            console.error('Disable addon failed:', e);
            Toast.error(`Failed to disable add-on: ${e}`);
        }
    }

    private async uninstallAddon(id: string) {
        try {
            await invoke('uninstall_addon', { addon_id: id });
            Toast.success('Add-on uninstalled');
            await this.loadAddons();
        } catch (e) {
            console.error('Uninstall addon failed:', e);
            Toast.error(`Failed to uninstall add-on: ${e}`);
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
            await this.loadLibrary();
            await this.loadSettings();
            await this.loadAddons();
            
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
        
        // Render immediately
        this.renderMediaDetail(media);
    }

    renderMediaDetail(media: MediaItem): void {
        const posterUrl = escapeHtml(media.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster');
        const backdropUrl = escapeHtml(media.backdrop_url || 'https://via.placeholder.com/1200x500?text=No+Backdrop');
        const year = media.year || 'N/A';
        const mediaType = typeof media.media_type === 'string' ? escapeHtml(media.media_type) : 
                         ('Movie' in media.media_type ? 'Movie' : 
                          'TvShow' in media.media_type ? 'TV Show' : 
                          'Episode' in media.media_type ? 'Episode' : 'Unknown');
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
                        <button class="play-btn" id="detail-play-btn" data-id="${escapedId}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                            Play Now
                        </button>
                        <button class="add-btn" id="detail-add-library-btn">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                            Library
                        </button>
                        <button class="add-btn" id="detail-add-watchlist-btn" data-id="${escapedId}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                            </svg>
                            Watchlist
                        </button>
                        <button class="favorite-btn" id="detail-favorite-btn" data-id="${escapedId}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                            Favorite
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Attach action listeners for detail buttons
        this.attachDetailActionListeners();
        
        // Append enhanced sections
        try {
            const dc = document.getElementById('detail-content');
            if (dc) {
                // Streams section
                const streamsSection = document.createElement('div');
                streamsSection.id = 'streams-container';
                streamsSection.innerHTML = `
                    <div class="settings-section">
                        <h3>🧩 Streams</h3>
                        <div id="streams-list">
                            <div class="loading-spinner">Loading streams...</div>
                        </div>
                    </div>
                `;
                dc.appendChild(streamsSection);
                this.selectedStreamUrl = null;
                this.loadStreamsForMedia(media);
                this.loadSubtitlesForMedia(media);
                
                // Enhanced metadata sections
                this.loadEnhancedMetadata(media);
                this.loadSimilarContent(media);
            }
        } catch (e) {
            console.warn('Failed to render enhanced sections:', e);
        }
        // After injecting detail images, initialize lazy loading for them
        setupLazyLoading('#detail-hero img[data-src], #detail-content img[data-src]');
    }

    private async loadEnhancedMetadata(media: MediaItem): Promise<void> {
        const dc = document.getElementById('detail-content');
        if (!dc) return;
        
        try {
            const typeStr = this.getMediaTypeString(media.media_type);
            const metaResponse = await invoke<any>('get_addon_meta', { content_id: media.id, media_type: typeStr });
            
            // Cast & Crew Section
            if (metaResponse.cast && metaResponse.cast.length > 0) {
                const castSection = document.createElement('div');
                castSection.className = 'settings-section';
                const castList = Array.isArray(metaResponse.cast) ? metaResponse.cast : [];
                castSection.innerHTML = `
                    <h3>🎭 Cast & Crew</h3>
                    <div class="cast-list">
                        ${castList.slice(0, 12).map((person: any) => {
                            const name = typeof person === 'string' ? person : (person.name || person.actor || 'Unknown');
                            // Cinemeta may provide actor data with photos
                            const photoUrl = person?.photo || person?.image || null;
                            return `
                                <div class="cast-item">
                                    ${photoUrl ? `
                                        <div class="cast-photo-wrapper">
                                            <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(name)}" class="cast-photo" loading="lazy" />
                                        </div>
                                    ` : `
                                        <div class="cast-photo-placeholder">
                                            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                            </svg>
                                        </div>
                                    `}
                                    <div class="cast-name">${escapeHtml(name)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
                dc.appendChild(castSection);
            }
            
            // Trailers Section
            if (metaResponse.trailers && metaResponse.trailers.length > 0) {
                const trailersSection = document.createElement('div');
                trailersSection.className = 'settings-section';
                trailersSection.innerHTML = `
                    <h3>🎬 Trailers</h3>
                    <div class="trailers-list">
                        ${metaResponse.trailers.slice(0, 3).map((trailer: any) => {
                            const youtubeId = trailer.source?.split('youtube:')?.[1] || trailer.source;
                            if (youtubeId && youtubeId.length > 5) {
                                return `
                                    <div class="trailer-item">
                                        <iframe 
                                            width="100%" 
                                            height="315" 
                                            src="https://www.youtube.com/embed/${escapeHtml(youtubeId)}" 
                                            frameborder="0" 
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                            allowfullscreen
                                            loading="lazy"
                                        ></iframe>
                                        <div class="trailer-title">${escapeHtml(trailer.type || 'Trailer')}</div>
                                    </div>
                                `;
                            }
                            return '';
                        }).join('')}
                    </div>
                `;
                dc.appendChild(trailersSection);
            }
            
            // External Links Section
            if (metaResponse.links && metaResponse.links.length > 0) {
                const linksSection = document.createElement('div');
                linksSection.className = 'settings-section';
                linksSection.innerHTML = `
                    <h3>🔗 External Links</h3>
                    <div class="external-links">
                        ${metaResponse.links.map((link: any) => `
                            <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="external-link-btn">
                                ${escapeHtml(link.name)}
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                                </svg>
                            </a>
                        `).join('')}
                    </div>
                `;
                dc.appendChild(linksSection);
            }
        } catch (err) {
            console.debug('Enhanced metadata not available:', err);
        }
    }

    private async loadSimilarContent(media: MediaItem): Promise<void> {
        const dc = document.getElementById('detail-content');
        if (!dc) return;
        
        try {
            const typeStr = this.getMediaTypeString(media.media_type);
            // Get first genre for recommendations
            const genre = media.genre?.[0];
            if (!genre) return;
            
            // Query catalogs with same genre
            const catalogs = await invoke<any[]>('list_catalogs', { mediaType: typeStr });
            if (!catalogs || catalogs.length === 0) return;
            
            const firstCatalog = catalogs[0];
            const extras = { genre, skip: '0', limit: '10' };
            const result = await invoke<any>('aggregate_catalogs', { 
                mediaType: typeStr, 
                catalogId: firstCatalog.id, 
                extra: extras 
            });
            
            const similar = result.items?.filter((item: any) => item.id !== media.id).slice(0, 10) || [];
            
            if (similar.length > 0) {
                const similarSection = document.createElement('div');
                similarSection.className = 'settings-section';
                similarSection.innerHTML = `
                    <h3>💡 You May Also Like</h3>
                    <div class="similar-content">
                        ${similar.map((item: any) => {
                            const posterUrl = escapeHtml(item.poster || 'https://via.placeholder.com/200x300?text=No+Poster');
                            return `
                                <div class="similar-item" data-id="${escapeHtml(item.id)}">
                                    <img src="${posterUrl}" alt="${escapeHtml(item.name)}" class="similar-poster" loading="lazy" />
                                    <div class="similar-title">${escapeHtml(item.name)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
                dc.appendChild(similarSection);
                
                // Attach click listeners for similar items
                similarSection.querySelectorAll('.similar-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const id = (item as HTMLElement).dataset.id;
                        if (id) {
                            // Convert addon preview to MediaItem and navigate
                            const similarItem = similar.find((s: any) => s.id === id);
                            if (similarItem) {
                                const mediaItem = this.mapMetaPreviewToMediaItem(similarItem);
                                this.mediaMap[mediaItem.id] = mediaItem;
                                this.showMediaDetail(mediaItem.id);
                            }
                        }
                    });
                });
            }
        } catch (err) {
            console.debug('Similar content not available:', err);
        }
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

    private attachDetailActionListeners(): void {
        const playBtn = document.getElementById('detail-play-btn');
        playBtn?.addEventListener('click', () => {
            const id = (playBtn as HTMLElement).getAttribute('data-id') || this.currentMedia?.id || '';
            if (id) this.playMedia(id);
        });
        const addLibBtn = document.getElementById('detail-add-library-btn');
        addLibBtn?.addEventListener('click', () => {
            if (this.currentMedia) this.addToLibrary(this.currentMedia);
        });
        const addWatchBtn = document.getElementById('detail-add-watchlist-btn');
        addWatchBtn?.addEventListener('click', () => {
            const id = (addWatchBtn as HTMLElement).getAttribute('data-id') || this.currentMedia?.id || '';
            if (id) this.addToWatchlist(id);
        });
        const favBtn = document.getElementById('detail-favorite-btn');
        favBtn?.addEventListener('click', () => {
            const id = (favBtn as HTMLElement).getAttribute('data-id') || this.currentMedia?.id || '';
            if (id) this.addToFavorites(id);
        });
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
            const streamUrl = this.selectedStreamUrl || await invoke<string>('get_stream_url', { content_id: mediaId, media_type: typeStr });
            
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

    private attachSubtitleSelectorListeners() {
        const toggleBtn = document.getElementById('subtitle-toggle-btn');
        const container = document.getElementById('subtitle-selector');
        if (!container || !toggleBtn) return;
        // Create menu if not exists
        let menu = document.getElementById('subtitle-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'subtitle-menu';
            menu.style.position = 'absolute';
            menu.style.top = '42px';
            menu.style.right = '0';
            menu.style.background = 'var(--background-secondary)';
            menu.style.border = '1px solid var(--border-color)';
            menu.style.borderRadius = '8px';
            menu.style.padding = '8px';
            menu.style.minWidth = '220px';
            menu.style.display = 'none';
            menu.style.zIndex = '1000';
            container.style.position = 'relative';
            container.appendChild(menu);
        }
        toggleBtn.addEventListener('click', () => {
            const m = document.getElementById('subtitle-menu');
            if (!m) return;
            m.style.display = (m.style.display === 'none' || !m.style.display) ? 'block' : 'none';
        });
        // Hide when clicking outside
        document.addEventListener('click', (e) => {
            const m = document.getElementById('subtitle-menu');
            if (!m) return;
            const within = container.contains(e.target as Node);
            if (!within) m.style.display = 'none';
        });
    }

    private async loadSubtitlesForMedia(media: MediaItem): Promise<void> {
        const menu = document.getElementById('subtitle-menu');
        if (!menu) return;
        menu.innerHTML = '<div class="loading-spinner">Loading subtitles...</div>';
        try {
            const mt: any = media.media_type as any;
            const typeStr = (typeof mt === 'string') ? mt.toLowerCase() : (mt && typeof mt === 'object') ? (
                'Movie' in mt ? 'movie' :
                'TvShow' in mt ? 'series' :
                'Episode' in mt ? 'episode' :
                'Documentary' in mt ? 'movie' :
                'LiveTv' in mt ? 'live' :
                'Podcast' in mt ? 'podcast' : undefined
            ) : undefined;
            const subs = await invoke<any[]>('get_subtitles', { content_id: media.id, media_type: typeStr });
            this.currentSubtitles = Array.isArray(subs) ? subs : [];
            if (this.currentSubtitles.length === 0) {
                menu.innerHTML = '<div class="empty-message">No subtitles available</div>';
                return;
            }
            // Group by language
            const byLang: Record<string, any[]> = {};
            this.currentSubtitles.forEach(s => {
                const lang = s.lang || 'und';
                if (!byLang[lang]) byLang[lang] = [];
                byLang[lang].push(s);
            });
            const langs = Object.keys(byLang).sort();
            const listHtml = [`<button class="btn btn-secondary" data-sub="off" style="width:100%; margin-bottom:6px;">Off</button>`]
                .concat(langs.map(l => {
                    // pick first URL per language
                    const first = byLang[l][0];
                    const label = l.toUpperCase();
                    return `<button class="btn btn-secondary subtitle-choice" data-url="${escapeHtml(String(first.url))}" data-lang="${escapeHtml(String(l))}" style="width:100%; margin-bottom:6px;">${label}</button>`;
                }))
                .join('');
            menu.innerHTML = listHtml;
            menu.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    const off = (btn as HTMLElement).getAttribute('data-sub') === 'off';
                    if (off) {
                        this.clearSubtitle();
                // Subtitle URL selection removed
                        try { window?.Toast?.info('Subtitles off'); } catch(_){}
                    } else {
                        const url = (btn as HTMLElement).getAttribute('data-url') || '';
                        const lang = (btn as HTMLElement).getAttribute('data-lang') || 'und';
                        if (url) {
                            this.applySubtitle(url, lang);
                // Subtitle URL selection removed
                            try { window?.Toast?.success(`Subtitles: ${lang.toUpperCase()}`); } catch(_){}
                        }
                    }
                    (menu as HTMLElement).style.display = 'none';
                });
            });
        } catch (err) {
            console.error('Failed to load subtitles:', err);
            menu.innerHTML = '<div class="error-message">Failed to load subtitles</div>';
        }
    }

    private applySubtitle(url: string, lang: string) {
        const video = document.getElementById('video-player') as HTMLVideoElement | null;
        if (!video) return;
        // Remove existing tracks
        const existing = video.querySelectorAll('track');
        existing.forEach(t => t.remove());
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.src = url;
        track.srclang = lang;
        track.label = lang.toUpperCase();
        track.default = true;
        video.appendChild(track);
        // Try to show as soon as metadata is loaded
        track.addEventListener('load', () => {
            try {
                // @ts-ignore
                track.mode = 'showing';
            } catch (_) {}
        });
    }

    private clearSubtitle() {
        const video = document.getElementById('video-player') as HTMLVideoElement | null;
        if (!video) return;
        const existing = video.querySelectorAll('track');
        existing.forEach(t => t.remove());
    }

    private async loadStreamsForMedia(media: MediaItem): Promise<void> {
        const listEl = document.getElementById('streams-list');
        if (!listEl) return;
        try {
            const mt: any = media.media_type as any;
            const typeStr = (typeof mt === 'string') ? mt.toLowerCase() : (mt && typeof mt === 'object') ? (
                'Movie' in mt ? 'movie' :
                'TvShow' in mt ? 'series' :
                'Episode' in mt ? 'episode' :
                'Documentary' in mt ? 'movie' :
                'LiveTv' in mt ? 'live' :
                'Podcast' in mt ? 'podcast' : undefined
            ) : undefined;
            const streams = await invoke<any[]>('get_streams', { content_id: media.id, media_type: typeStr });
            this.currentStreams = Array.isArray(streams) ? streams : [];
            if (this.currentStreams.length === 0) {
                listEl.innerHTML = `<div class="empty-message">No streams available from enabled add-ons.</div>`;
                return;
            }
            listEl.innerHTML = `
                <div style="display:flex; gap:8px; flex-wrap: wrap;">
                    ${this.currentStreams.map((s: any, i: number) => `
                        <button class="btn btn-secondary stream-choice" data-url="${escapeHtml(String(s.url))}" title="${escapeHtml(String(s.description || s.title || s.name || ''))}">
                            ${escapeHtml(String(s.name || s.title || ('Stream ' + (i + 1))))}
                        </button>
                    `).join('')}
                </div>
                <small class="setting-description">Select a stream to prefer it; Play Now will use your selection.</small>
            `;
            document.querySelectorAll('.stream-choice').forEach(btn => {
                btn.addEventListener('click', () => {
                    const url = (btn as HTMLElement).getAttribute('data-url') || '';
                    if (url) {
                        this.selectedStreamUrl = url;
                        try { window?.Toast?.success('Stream selected'); } catch (_) {}
                        document.querySelectorAll('.stream-choice').forEach(b => b.classList.remove('btn-primary'));
                        (btn as HTMLElement).classList.add('btn-primary');
                    }
                });
            });
        } catch (err) {
            console.error('Failed to load streams:', err);
            const errorMessage = String(err);
            let userMessage = 'Failed to load streams';

            if (errorMessage.includes('No working addons available')) {
                userMessage = 'No content sources available';
            } else if (errorMessage.includes('Failed to load addons')) {
                userMessage = 'Content sources not loading';
            }

            listEl.innerHTML = `<div class="error-message">${userMessage}. Please install addons from the Add-ons section first.</div>`;
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

    // Map Addon MetaPreview to a minimal MediaItem for UI rendering
    private mapMetaPreviewToMediaItem(meta: any): MediaItem {
        const mediaType = typeof meta.media_type === 'string' ? meta.media_type : (meta.type || meta.mediaType || 'movie');
        // Attempt to parse year from releaseInfo if present
        let year: number | undefined = undefined;
        const rel = meta.releaseInfo || meta.release || '';
        if (typeof rel === 'string') {
            const m = rel.match(/(19|20)\d{2}/);
            if (m) year = parseInt(m[0]);
        }
        return {
            id: String(meta.id),
            title: meta.name || meta.title || 'Unknown',
            media_type: mediaType,
            year,
            genre: [],
            description: meta.description || '',
            poster_url: meta.poster || undefined,
            backdrop_url: meta.background || undefined,
            rating: typeof meta.imdbRating === 'number' ? meta.imdbRating : undefined,
            duration: undefined,
            added_to_library: undefined,
            watched: false,
            progress: 0,
        } as unknown as MediaItem;
    }

    // Load Trending Content using addon catalogs
    async loadTrending() {
        const trendingRow = document.getElementById('trending-row');
        const trendingSection = document.getElementById('trending-section');
        if (!trendingRow) return;
        try {
            const catalogs = await invoke<any[]>('list_catalogs', { media_type: 'movie' });
            if (!catalogs || catalogs.length === 0) {
                if (trendingSection) trendingSection.style.display = 'none';
                return;
            }
            // Prefer catalog with name containing 'trending', else first
            const selected = catalogs.find(c => String(c.name).toLowerCase().includes('trending')) || catalogs[0];
            const result = await invoke<any>('aggregate_catalogs', { media_type: 'movie', catalog_id: selected.id });
            const metas = (result && Array.isArray(result.items)) ? result.items : [];
            if (metas.length === 0) {
                if (trendingSection) trendingSection.style.display = 'none';
                return;
            }
            if (trendingSection) trendingSection.style.display = 'block';
            const items = metas.slice(0, 10).map((m: any) => this.mapMetaPreviewToMediaItem(m));
            trendingRow.innerHTML = items.map((item: any) => this.renderMediaCard(item, false, false)).join('');
            setupLazyLoading();
            this.attachCardListeners();
        } catch (err) {
            console.warn('Trending catalogs not available:', err);
            if (trendingSection) trendingSection.style.display = 'none';

            // Show helpful message if it's due to missing addons
            const errorMessage = String(err);
            if (errorMessage.includes('No working addons available') || errorMessage.includes('Failed to load addons')) {
                console.warn('Trending not available due to missing addons - this is expected until addons are installed');
            }
        }
    }

    // Load Popular Content using addon catalogs
    async loadPopular() {
        const popularRow = document.getElementById('popular-row');
        const popularSection = document.getElementById('popular-section');
        if (!popularRow) return;
        try {
            const catalogs = await invoke<any[]>('list_catalogs', { media_type: 'movie' });
            if (!catalogs || catalogs.length === 0) {
                if (popularSection) popularSection.style.display = 'none';
                return;
            }
            // Prefer catalog with name containing 'popular', else first
            const selected = catalogs.find(c => String(c.name).toLowerCase().includes('popular')) || catalogs[0];
            const result = await invoke<any>('aggregate_catalogs', { media_type: 'movie', catalog_id: selected.id });
            const metas = (result && Array.isArray(result.items)) ? result.items : [];
            if (metas.length === 0) {
                if (popularSection) popularSection.style.display = 'none';
                return;
            }
            if (popularSection) popularSection.style.display = 'block';
            const items = metas.slice(0, 10).map((m: any) => this.mapMetaPreviewToMediaItem(m));
            popularRow.innerHTML = items.map((item: any) => this.renderMediaCard(item, false, false)).join('');
            setupLazyLoading();
            this.attachCardListeners();
        } catch (err) {
            console.warn('Popular catalogs not available:', err);
            if (popularSection) popularSection.style.display = 'none';

            // Show helpful message if it's due to missing addons
            const errorMessage = String(err);
            if (errorMessage.includes('No working addons available') || errorMessage.includes('Failed to load addons')) {
                console.warn('Popular content not available due to missing addons - this is expected until addons are installed');
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
