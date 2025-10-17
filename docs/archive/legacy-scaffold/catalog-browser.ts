// Catalog Browser UI - Browse addon catalogs and navigate to detail pages
// Phase 1: Display catalog grids
// Phase 2: Integrate with stream player

import { addonCatalogLoader, CatalogMeta, EnrichedStream } from './addon-catalog-loader';
import { invoke } from './utils';

export class CatalogBrowser {
  private isLoadingStreams = false;

  /**
   * Initialize catalog browser
   */
  initialize() {
    this.setupEventHandlers();
    console.log('Catalog browser initialized');
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers() {
    // Back button
    const backBtn = document.getElementById('catalog-back-btn');
    backBtn?.addEventListener('click', () => this.hideCatalogView());

    // Close stream picker
    const closePickerBtn = document.getElementById('close-stream-picker');
    closePickerBtn?.addEventListener('click', () => this.hideStreamPicker());
  }

  /**
   * Browse a catalog from an addon
   */
  async browseCatalog(addonId: string, type: string, catalogId: string, catalogName: string) {
    console.log(`Browsing catalog: ${addonId} / ${type} / ${catalogId}`);

    // Show catalog view
    this.showCatalogView(catalogName);

    // Load catalog items
    try {
      const metas = await addonCatalogLoader.loadCatalog(addonId, type, catalogId);
      this.displayCatalogItems(metas);
    } catch (error) {
      this.showError('Failed to load catalog');
      console.error('Catalog load error:', error);
    }
  }

  /**
   * Show catalog view section
   */
  private showCatalogView(catalogName: string) {
    // Hide main content
    const mainContent = document.querySelector('.container') as HTMLElement;
    if (mainContent) mainContent.style.display = 'none';

    // Show catalog view
    const catalogView = document.getElementById('catalog-view');
    if (catalogView) {
      catalogView.style.display = 'block';
      
      // Update title
      const titleEl = document.getElementById('catalog-title');
      if (titleEl) titleEl.textContent = catalogName;

      // Clear previous items
      const grid = document.getElementById('catalog-grid');
      if (grid) grid.innerHTML = '<p>Loading...</p>';
    }
  }

  /**
   * Hide catalog view and return to main
   */
  private hideCatalogView() {
    const catalogView = document.getElementById('catalog-view');
    if (catalogView) catalogView.style.display = 'none';

    const mainContent = document.querySelector('.container') as HTMLElement;
    if (mainContent) mainContent.style.display = 'block';
  }

  /**
   * Display catalog items in grid
   */
  private displayCatalogItems(metas: CatalogMeta[]) {
    const grid = document.getElementById('catalog-grid');
    if (!grid) return;

    if (metas.length === 0) {
      grid.innerHTML = '<p class="empty-state">No items found in this catalog</p>';
      return;
    }

    grid.innerHTML = '';
    
    metas.forEach(meta => {
      const card = this.createCatalogCard(meta);
      grid.appendChild(card);
    });
  }

  /**
   * Create catalog item card
   */
  private createCatalogCard(meta: CatalogMeta): HTMLElement {
    const card = document.createElement('div');
    card.className = 'catalog-item-card';
    
    // Poster
    const poster = document.createElement('img');
    poster.src = meta.poster || '/placeholder-poster.png';
    poster.alt = meta.name;
    poster.className = 'catalog-item-poster';
    poster.loading = 'lazy';
    poster.onerror = () => {
      poster.src = '/placeholder-poster.png';
    };
    card.appendChild(poster);

    // Info overlay
    const info = document.createElement('div');
    info.className = 'catalog-item-info';
    
    const title = document.createElement('h3');
    title.textContent = meta.name;
    info.appendChild(title);

    if (meta.year) {
      const year = document.createElement('p');
      year.className = 'catalog-item-year';
      year.textContent = meta.year;
      info.appendChild(year);
    }

    if (meta.imdbRating) {
      const rating = document.createElement('p');
      rating.className = 'catalog-item-rating';
      rating.textContent = `⭐ ${meta.imdbRating}`;
      info.appendChild(rating);
    }

    card.appendChild(info);

    // Click to load streams
    card.addEventListener('click', () => {
      this.showItemDetail(meta);
    });

    return card;
  }

  /**
   * Show item detail and load streams
   */
  private async showItemDetail(meta: CatalogMeta) {
    console.log('Loading streams for:', meta.id, meta.type);

    if (this.isLoadingStreams) {
      console.log('Already loading streams...');
      return;
    }

    this.isLoadingStreams = true;

    try {
      // Load streams from all enabled addons
      const streams = await addonCatalogLoader.loadStreamsFromAllAddons(meta.type, meta.id);
      
      // Filter to playable streams only
      const playableStreams = streams.filter(s => addonCatalogLoader.isStreamPlayable(s));

      if (playableStreams.length === 0) {
        alert(`No playable streams found for "${meta.name}"\n\nMake sure you have addons installed that provide streams for this content.`);
        return;
      }

      // Show stream picker
      this.showStreamPicker(meta, playableStreams);
    } catch (error) {
      alert(`Failed to load streams: ${error}`);
      console.error('Stream load error:', error);
    } finally {
      this.isLoadingStreams = false;
    }
  }

  /**
   * Show stream picker modal
   */
  private showStreamPicker(meta: CatalogMeta, streams: EnrichedStream[]) {
    const modal = document.getElementById('stream-picker-modal');
    const title = document.getElementById('stream-picker-title');
    const list = document.getElementById('stream-picker-list');

    if (!modal || !title || !list) return;

    title.textContent = `Select Stream - ${meta.name}`;
    list.innerHTML = '';

    streams.forEach((stream) => {
      const item = document.createElement('div');
      item.className = 'stream-picker-item';
      
      const streamTitle = addonCatalogLoader.getStreamTitle(stream);
      const titleEl = document.createElement('div');
      titleEl.className = 'stream-picker-item-title';
      titleEl.textContent = streamTitle;
      item.appendChild(titleEl);

      // Health indicator
      if (stream.healthScore !== undefined) {
        const health = document.createElement('div');
        health.className = 'stream-picker-item-health';
        const healthPercent = Math.round(stream.healthScore * 100);
        health.textContent = `Health: ${healthPercent}%`;
        health.style.color = healthPercent >= 80 ? '#4CAF50' : healthPercent >= 50 ? '#FF9800' : '#f44336';
        item.appendChild(health);
      }

      // Click to play
      item.addEventListener('click', () => {
        this.playStream(stream, meta);
        this.hideStreamPicker();
      });

      list.appendChild(item);
    });

    modal.style.display = 'flex';
  }

  /**
   * Hide stream picker modal
   */
  private hideStreamPicker() {
    const modal = document.getElementById('stream-picker-modal');
    if (modal) modal.style.display = 'none';
  }

  /**
   * Play selected stream
   */
  private async playStream(stream: EnrichedStream, _meta: CatalogMeta) {
    const url = addonCatalogLoader.getStreamUrl(stream);
    
    if (!url) {
      alert('Cannot extract stream URL');
      return;
    }

    console.log('Playing stream:', url);

    // Hide catalog view
    this.hideCatalogView();

    // Show player
    const playerSection = document.getElementById('player-section');
    if (playerSection) playerSection.style.display = 'block';

    try {
      // Load stream in player using global player instance
      const player = (window as any).player;
      if (player && player.loadStream) {
        await player.loadStream(url);
      } else {
        // Fallback: use video element directly
        const video = document.getElementById('video-player') as HTMLVideoElement;
        if (video) {
          video.src = url;
          video.play();
        }
      }

      // Load subtitles if available
      if (stream.subtitles && stream.subtitles.length > 0) {
        console.log('Loading subtitles:', stream.subtitles);
        // TODO: Implement subtitle loading in player
      }

      // Record playback for health tracking
      try {
        await invoke('record_addon_metric', {
          addonId: stream.addonId,
          metric: 'stream_request_time',
          value: 0, // Will be measured by backend
        });
      } catch (err) {
        console.warn('Failed to record playback metric:', err);
      }
    } catch (error) {
      alert(`Failed to play stream: ${error}`);
      console.error('Playback error:', error);
    }
  }

  /**
   * Show error message
   */
  private showError(message: string) {
    const grid = document.getElementById('catalog-grid');
    if (grid) {
      grid.innerHTML = `<p class="error-message">${message}</p>`;
    }
  }

  /**
   * Browse first catalog of an addon
   */
  async browseAddon(addonId: string) {
    try {
      const catalogs = await addonCatalogLoader.getAddonCatalogs(addonId);
      
      if (catalogs.length === 0) {
        alert('This addon has no catalogs to browse');
        return;
      }

      // Browse first catalog
      const catalog = catalogs[0];
      await this.browseCatalog(addonId, catalog.type, catalog.id, catalog.name);
    } catch (error) {
      alert(`Failed to load addon catalogs: ${error}`);
      console.error('Addon catalog error:', error);
    }
  }
}

// Singleton instance
export const catalogBrowser = new CatalogBrowser();

// Make globally available
if (typeof window !== 'undefined') {
  (window as any).catalogBrowser = catalogBrowser;
}
