// Addon Catalog Loader - Query Stremio addon catalogs and streams
// Phase 1: Catalog browsing
// Phase 2: Stream resolution
// Phase 3: Multi-addon aggregation

import { invoke } from './utils';

/**
 * Catalog metadata item
 */
export interface CatalogMeta {
  id: string;
  type: string;
  name: string;
  poster?: string;
  posterShape?: 'poster' | 'landscape' | 'square';
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  year?: string;
  imdbRating?: string;
  genres?: string[];
  director?: string[];
  cast?: string[];
  runtime?: string;
  website?: string;
  behaviorHints?: {
    defaultVideoId?: string;
  };
}

/**
 * Stream object from addon
 */
export interface AddonStream {
  url?: string;
  ytId?: string;
  infoHash?: string;
  fileIdx?: number;
  externalUrl?: string;
  title?: string;
  name?: string;
  tag?: string[];
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
    countryWhitelist?: string[];
    videoHash?: string;
    videoSize?: number;
  };
  subtitles?: Array<{
    url: string;
    lang: string;
  }>;
}

/**
 * Stream with addon source info
 */
export interface EnrichedStream extends AddonStream {
  addonId: string;
  addonName: string;
  healthScore?: number;
}

/**
 * Catalog definition from manifest
 */
export interface AddonCatalog {
  type: string;
  id: string;
  name: string;
  extra?: Array<{
    name: string;
    isRequired?: boolean;
    options?: string[];
  }>;
}

export class AddonCatalogLoader {
  /**
   * Get all catalogs from an addon
   */
  async getAddonCatalogs(addonId: string): Promise<AddonCatalog[]> {
    try {
      const addons = await invoke<any[]>('get_addons');
      const addon = addons.find(a => a.id === addonId);
      
      if (!addon) {
        throw new Error(`Addon ${addonId} not found`);
      }

      // Fetch manifest to get catalog list
      const manifestUrl = `${addon.url}/manifest.json`;
      const response = await fetch(manifestUrl);
      const manifest = await response.json();

      return manifest.catalogs || [];
    } catch (error) {
      console.error(`Failed to get catalogs for ${addonId}:`, error);
      return [];
    }
  }

  /**
   * Load catalog metas from an addon
   */
  async loadCatalog(
    addonId: string,
    type: string,
    catalogId: string,
    extra?: Record<string, string>
  ): Promise<CatalogMeta[]> {
    try {
      const addons = await invoke<any[]>('get_addons');
      const addon = addons.find(a => a.id === addonId);
      
      if (!addon) {
        throw new Error(`Addon ${addonId} not found`);
      }

      // Build URL with extra parameters
      let url = `${addon.url}/catalog/${type}/${catalogId}.json`;
      if (extra && Object.keys(extra).length > 0) {
        const params = new URLSearchParams(extra).toString();
        url += `?${params}`;
      }

      console.log('Loading catalog:', url);

      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.metas || [];
    } catch (error) {
      console.error(`Failed to load catalog from ${addonId}:`, error);
      throw error;
    }
  }

  /**
   * Load streams for a specific item from ONE addon
   */
  async loadStreamsFromAddon(
    addonId: string,
    type: string,
    id: string
  ): Promise<AddonStream[]> {
    try {
      const addons = await invoke<any[]>('get_addons');
      const addon = addons.find(a => a.id === addonId);
      
      if (!addon) {
        throw new Error(`Addon ${addonId} not found`);
      }

      const url = `${addon.url}/stream/${type}/${id}.json`;
      console.log('Loading streams:', url);

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.streams || [];
    } catch (error) {
      console.error(`Failed to load streams from ${addonId}:`, error);
      return [];
    }
  }

  /**
   * Load streams from ALL enabled addons (Phase 3: Multi-addon aggregation)
   */
  async loadStreamsFromAllAddons(
    type: string,
    id: string
  ): Promise<EnrichedStream[]> {
    try {
      // Get all enabled addons
      const addons = await invoke<any[]>('get_addons');
      const enabledAddons = addons.filter(a => a.enabled);

      if (enabledAddons.length === 0) {
        console.warn('No enabled addons found');
        return [];
      }

      // Get health scores for sorting
      let healthMap = new Map<string, number>();
      try {
        const healthSummaries = await invoke<any[]>('get_addon_health_summaries');
        healthSummaries.forEach(h => healthMap.set(h.addon_id, h.health_score));
      } catch (err) {
        console.warn('Could not load health scores:', err);
      }

      // Query all addons in parallel
      const streamPromises = enabledAddons.map(async (addon) => {
        try {
          const streams = await this.loadStreamsFromAddon(addon.id, type, id);
          
          // Enrich streams with addon info
          return streams.map(stream => ({
            ...stream,
            addonId: addon.id,
            addonName: addon.name,
            healthScore: healthMap.get(addon.id) || 0,
          }));
        } catch (error) {
          console.warn(`Addon ${addon.id} failed:`, error);
          return [];
        }
      });

      const results = await Promise.all(streamPromises);
      const allStreams = results.flat();

      // Sort by health score (descending)
      allStreams.sort((a, b) => (b.healthScore || 0) - (a.healthScore || 0));

      console.log(`Loaded ${allStreams.length} streams from ${enabledAddons.length} addons`);
      return allStreams;
    } catch (error) {
      console.error('Failed to load streams from all addons:', error);
      return [];
    }
  }

  /**
   * Load metadata for a specific item from an addon
   */
  async loadMeta(
    addonId: string,
    type: string,
    id: string
  ): Promise<CatalogMeta | null> {
    try {
      const addons = await invoke<any[]>('get_addons');
      const addon = addons.find(a => a.id === addonId);
      
      if (!addon) {
        throw new Error(`Addon ${addonId} not found`);
      }

      const url = `${addon.url}/meta/${type}/${id}.json`;
      console.log('Loading meta:', url);

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.meta || null;
    } catch (error) {
      console.error(`Failed to load meta from ${addonId}:`, error);
      return null;
    }
  }

  /**
   * Get best playable stream URL from stream object
   */
  getStreamUrl(stream: AddonStream): string | null {
    // Priority: direct URL > YouTube > external URL
    if (stream.url) {
      return stream.url;
    }
    
    if (stream.ytId) {
      // Convert YouTube ID to embed URL
      return `https://www.youtube.com/embed/${stream.ytId}`;
    }
    
    if (stream.externalUrl) {
      return stream.externalUrl;
    }

    // Torrent streams not supported yet
    if (stream.infoHash) {
      console.warn('Torrent streams not supported:', stream.infoHash);
      return null;
    }

    return null;
  }

  /**
   * Check if stream is playable in StreamGo
   */
  isStreamPlayable(stream: AddonStream): boolean {
    // Can play direct URLs (HLS, DASH, MP4)
    if (stream.url) return true;
    
    // Can play YouTube embeds
    if (stream.ytId) return true;
    
    // Can try external URLs
    if (stream.externalUrl) return true;
    
    // Cannot play torrents yet
    if (stream.infoHash) return false;
    
    return false;
  }

  /**
   * Get stream display title
   */
  getStreamTitle(stream: EnrichedStream): string {
    const parts: string[] = [];

    // Add addon name
    parts.push(`[${stream.addonName}]`);

    // Add stream title or name
    if (stream.title) {
      parts.push(stream.title);
    } else if (stream.name) {
      parts.push(stream.name);
    }

    // Add tags if present
    if (stream.tag && stream.tag.length > 0) {
      parts.push(`(${stream.tag.join(', ')})`);
    }

    return parts.join(' ') || 'Unknown Stream';
  }
}

// Singleton instance
export const addonCatalogLoader = new AddonCatalogLoader();

// Make globally available
if (typeof window !== 'undefined') {
  (window as any).addonCatalogLoader = addonCatalogLoader;
}
