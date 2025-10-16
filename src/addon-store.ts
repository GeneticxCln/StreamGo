/**
 * Addon Store Module
 * Handles addon discovery, browsing, and installation from curated sources
 */

import { invoke } from '@tauri-apps/api/core';
import { showToast } from './ui-utils';

export interface StoreAddon {
    id: string;
    name: string;
    version: string;
    description: string;
    url: string;
    author: string;
    category: string[];
    rating: number;
    downloads: number;
    verified: boolean;
    featured: boolean;
    icon?: string;
    screenshot?: string;
    types: string[];
    healthScore?: number;
}

// Curated list of community add-ons (this would ideally come from a server/API)
const CURATED_ADDONS: StoreAddon[] = [
    {
        id: 'org.example.movies',
        name: 'Example Movies',
        version: '1.0.0',
        description: 'Free movies from various sources. Includes popular movies, classics, and indie films.',
        url: 'https://example.com/addon/manifest.json',
        author: 'Community',
        category: ['movies', 'general'],
        rating: 4.5,
        downloads: 10250,
        verified: true,
        featured: true,
        types: ['movie'],
        healthScore: 85,
    },
    {
        id: 'org.example.series',
        name: 'TV Series Hub',
        version: '2.1.0',
        description: 'Comprehensive TV series catalog with latest episodes and complete seasons.',
        url: 'https://example.com/series/manifest.json',
        author: 'SeriesTeam',
        category: ['series'],
        rating: 4.7,
        downloads: 8500,
        verified: true,
        featured: true,
        types: ['series'],
        healthScore: 92,
    },
    {
        id: 'org.anime.central',
        name: 'Anime Central',
        version: '1.5.2',
        description: 'Your one-stop shop for anime content. Includes subbed and dubbed versions.',
        url: 'https://example.com/anime/manifest.json',
        author: 'AnimeLovers',
        category: ['anime', 'series'],
        rating: 4.8,
        downloads: 15000,
        verified: true,
        featured: true,
        types: ['series'],
        healthScore: 88,
    },
    {
        id: 'com.subtitles.opensubtitles',
        name: 'OpenSubtitles',
        version: '3.0.0',
        description: 'Largest collection of subtitles in multiple languages.',
        url: 'https://example.com/subs/manifest.json',
        author: 'OpenSubtitles Team',
        category: ['subtitles'],
        rating: 4.6,
        downloads: 20000,
        verified: true,
        featured: false,
        types: ['movie', 'series'],
        healthScore: 95,
    },
    {
        id: 'org.documentaries.world',
        name: 'World Documentaries',
        version: '1.2.0',
        description: 'Curated collection of documentaries covering nature, science, history, and more.',
        url: 'https://example.com/docs/manifest.json',
        author: 'DocWorld',
        category: ['documentaries'],
        rating: 4.4,
        downloads: 3500,
        verified: true,
        featured: false,
        types: ['movie'],
        healthScore: 78,
    },
    {
        id: 'net.indie.films',
        name: 'Indie Films Collection',
        version: '1.0.5',
        description: 'Independent and art-house films from around the world.',
        url: 'https://example.com/indie/manifest.json',
        author: 'IndieFilms',
        category: ['movies'],
        rating: 4.2,
        downloads: 2100,
        verified: false,
        featured: false,
        types: ['movie'],
        healthScore: 65,
    },
];

export class AddonStore {
    private addons: StoreAddon[] = [];
    private filteredAddons: StoreAddon[] = [];
    private installedAddonIds: Set<string> = new Set();

    constructor() {
        this.setupTabSwitching();
        this.setupStoreControls();
    }

    /**
     * Setup tab switching between Installed and Store
     */
    private setupTabSwitching(): void {
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLButtonElement;
                const tabName = target.dataset.tab;

                // Update active tab button
                tabButtons.forEach(b => b.classList.remove('active'));
                target.classList.add('active');

                // Update active tab content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                    (content as HTMLElement).style.display = 'none';
                });

                const activeTab = document.getElementById(`${tabName}-addons-tab`);
                if (activeTab) {
                    activeTab.classList.add('active');
                    activeTab.style.display = 'block';
                }

                // Load store addons when switching to store tab
                if (tabName === 'store') {
                    this.loadStoreAddons();
                }
            });
        });
    }

    /**
     * Setup store search, filter, and sort controls
     */
    private setupStoreControls(): void {
        const searchInput = document.getElementById('store-search-input') as HTMLInputElement;
        const searchBtn = document.getElementById('store-search-btn');
        const categoryFilter = document.getElementById('store-category-filter');
        const sortFilter = document.getElementById('store-sort-filter');
        const verifiedOnly = document.getElementById('store-verified-only') as HTMLInputElement;

        searchBtn?.addEventListener('click', () => this.applyFilters());
        searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.applyFilters();
        });
        categoryFilter?.addEventListener('change', () => this.applyFilters());
        sortFilter?.addEventListener('change', () => this.applyFilters());
        verifiedOnly?.addEventListener('change', () => this.applyFilters());
    }

    /**
     * Load add-ons from store (curated list)
     */
    async loadStoreAddons(): Promise<void> {
        try {
            // Load curated addons (in production, fetch from API)
            this.addons = [...CURATED_ADDONS];

            // Get installed addon IDs to mark them
            await this.loadInstalledAddonIds();

            this.applyFilters();
        } catch (error) {
            console.error('Error loading store addons:', error);
            showToast('Failed to load addon store', 'error');
        }
    }

    /**
     * Load IDs of currently installed addons
     */
    private async loadInstalledAddonIds(): Promise<void> {
        try {
            const installedAddons = await invoke<any[]>('get_addons');
            this.installedAddonIds = new Set(installedAddons.map(addon => addon.id));
        } catch (error) {
            console.error('Error loading installed addons:', error);
        }
    }

    /**
     * Apply search, filter, and sort to addon list
     */
    private applyFilters(): void {
        const searchInput = document.getElementById('store-search-input') as HTMLInputElement;
        const categoryFilter = document.getElementById('store-category-filter') as HTMLSelectElement;
        const sortFilter = document.getElementById('store-sort-filter') as HTMLSelectElement;
        const verifiedOnly = document.getElementById('store-verified-only') as HTMLInputElement;

        const searchQuery = searchInput?.value.toLowerCase() || '';
        const category = categoryFilter?.value || 'all';
        const sortBy = sortFilter?.value || 'featured';
        const onlyVerified = verifiedOnly?.checked ?? true;

        // Filter addons
        this.filteredAddons = this.addons.filter(addon => {
            // Search filter
            const matchesSearch = searchQuery === '' ||
                addon.name.toLowerCase().includes(searchQuery) ||
                addon.description.toLowerCase().includes(searchQuery) ||
                addon.author.toLowerCase().includes(searchQuery) ||
                addon.category.some(cat => cat.toLowerCase().includes(searchQuery));

            // Category filter
            const matchesCategory = category === 'all' || addon.category.includes(category);

            // Verified filter
            const matchesVerified = !onlyVerified || addon.verified;

            return matchesSearch && matchesCategory && matchesVerified;
        });

        // Sort addons
        this.filteredAddons.sort((a, b) => {
            switch (sortBy) {
                case 'popular':
                    return b.downloads - a.downloads;
                case 'rating':
                    return b.rating - a.rating;
                case 'newest':
                    // In real implementation, use release date
                    return b.id.localeCompare(a.id);
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'featured':
                default:
                    // Featured first, then by rating
                    if (a.featured !== b.featured) return b.featured ? 1 : -1;
                    return b.rating - a.rating;
            }
        });

        this.renderStoreAddons();
    }

    /**
     * Render store addons grid
     */
    private renderStoreAddons(): void {
        const grid = document.getElementById('store-addons-grid');
        if (!grid) return;

        if (this.filteredAddons.length === 0) {
            grid.innerHTML = '<p class="empty-message">No add-ons found matching your criteria</p>';
            return;
        }

        grid.innerHTML = this.filteredAddons.map(addon => this.renderAddonCard(addon)).join('');

        // Attach install button event listeners
        this.filteredAddons.forEach(addon => {
            const installBtn = document.getElementById(`install-${addon.id}`);
            installBtn?.addEventListener('click', () => this.installAddon(addon));
        });
    }

    /**
     * Render individual addon card
     */
    private renderAddonCard(addon: StoreAddon): string {
        const isInstalled = this.installedAddonIds.has(addon.id);
        const healthBadge = addon.healthScore ? `<span class="health-badge health-${this.getHealthClass(addon.healthScore)}">${addon.healthScore}%</span>` : '';
        const verifiedBadge = addon.verified ? '<span class="verified-badge" title="Verified addon">✓ Verified</span>' : '';
        const featuredBadge = addon.featured ? '<span class="featured-badge">⭐ Featured</span>' : '';

        return `
            <div class="store-addon-card">
                ${addon.icon ? `<img src="${addon.icon}" alt="${addon.name} icon" class="addon-icon">` : `<div class="addon-icon-placeholder">📦</div>`}
                <div class="addon-card-content">
                    <div class="addon-card-header">
                        <h4 class="addon-card-title">${addon.name}</h4>
                        <div class="addon-badges">
                            ${featuredBadge}
                            ${verifiedBadge}
                            ${healthBadge}
                        </div>
                    </div>
                    <p class="addon-card-author">by ${addon.author} • v${addon.version}</p>
                    <p class="addon-card-description">${addon.description}</p>
                    <div class="addon-card-meta">
                        <span class="addon-rating">⭐ ${addon.rating.toFixed(1)}</span>
                        <span class="addon-downloads">📥 ${this.formatNumber(addon.downloads)}</span>
                        <span class="addon-types">${addon.types.join(', ')}</span>
                    </div>
                    <div class="addon-card-categories">
                        ${addon.category.map(cat => `<span class="category-tag">${cat}</span>`).join('')}
                    </div>
                    <button 
                        id="install-${addon.id}" 
                        class="btn ${isInstalled ? 'btn-secondary' : 'btn-primary'}" 
                        ${isInstalled ? 'disabled' : ''}
                    >
                        ${isInstalled ? '✓ Installed' : '+ Install'}
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Install addon from store
     */
    private async installAddon(addon: StoreAddon): Promise<void> {
        try {
            showToast(`Installing ${addon.name}...`, 'info');

            await invoke('install_addon', { addon_url: addon.url });

            this.installedAddonIds.add(addon.id);
            showToast(`${addon.name} installed successfully!`, 'success');

            // Re-render to update install button
            this.renderStoreAddons();

            // Refresh installed addons list
            if (typeof (window as any).app?.loadAddons === 'function') {
                (window as any).app.loadAddons();
            }
        } catch (error) {
            console.error('Error installing addon:', error);
            showToast(`Failed to install ${addon.name}: ${error}`, 'error');
        }
    }

    /**
     * Get health class based on score
     */
    private getHealthClass(score: number): string {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'fair';
        return 'poor';
    }

    /**
     * Format number with K/M suffix
     */
    private formatNumber(num: number): string {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
}

// Initialize addon store when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new AddonStore();
    });
} else {
    new AddonStore();
}
