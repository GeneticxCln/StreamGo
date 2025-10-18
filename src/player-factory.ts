/**
 * Player Factory with Dynamic Imports
 * 
 * This factory lazy-loads different video players only when needed,
 * reducing the initial bundle size significantly.
 */

import { detectStreamFormat } from './stream-format-detector';
import type { VideoPlayer, PlayerOptions } from './player';

// Type imports (these don't increase bundle size)
type HlsType = typeof import('hls.js').default;
type DashPlayerType = typeof import('./dash-player').DashPlayer;
type TorrentPlayerType = typeof import('./torrent-player').TorrentPlayer;

// Cached modules to avoid re-importing
let hlsModule: HlsType | null = null;
let DashPlayerClass: DashPlayerType | null = null;
let TorrentPlayerClass: TorrentPlayerType | null = null;
let VideoPlayerClass: typeof VideoPlayer | null = null;

/**
 * Stream format types
 */
export type StreamFormat = 'hls' | 'dash' | 'torrent' | 'direct';

/**
 * Player factory interface
 */
export interface PlayerFactory {
  createPlayer(options: PlayerOptions): Promise<VideoPlayer>;
  preloadPlayerForFormat(format: StreamFormat): Promise<void>;
  isFormatSupported(format: StreamFormat): boolean;
}

/**
 * Lazy-loading player factory
 */
class LazyPlayerFactory implements PlayerFactory {
  private loadingPromises = new Map<string, Promise<any>>();

  /**
   * Create a player instance for the given URL
   */
  async createPlayer(options: PlayerOptions): Promise<VideoPlayer> {
    // First ensure we have the VideoPlayer class loaded
    if (!VideoPlayerClass) {
      VideoPlayerClass = await this.loadVideoPlayer();
    }

    const player = new VideoPlayerClass(options);
    return player;
  }

  /**
   * Preload player modules for a specific format
   */
  async preloadPlayerForFormat(format: StreamFormat): Promise<void> {
    switch (format) {
      case 'hls':
        await this.loadHlsModule();
        break;
      case 'dash':
        await this.loadDashPlayer();
        break;
      case 'torrent':
        await this.loadTorrentPlayer();
        break;
      case 'direct':
        // No additional modules needed for direct video
        break;
    }
  }

  /**
   * Check if a format is supported
   */
  isFormatSupported(format: StreamFormat): boolean {
    switch (format) {
      case 'hls':
        return true; // Either native support or hls.js
      case 'dash':
        return true; // dash.js support
      case 'torrent':
        return true; // WebTorrent support
      case 'direct':
        return true; // Native video support
      default:
        return false;
    }
  }

  /**
   * Load the main VideoPlayer class
   */
  private async loadVideoPlayer(): Promise<typeof VideoPlayer> {
    const cacheKey = 'video-player';
    
    if (!this.loadingPromises.has(cacheKey)) {
      this.loadingPromises.set(cacheKey, 
        import('./player').then(module => module.VideoPlayer)
      );
    }

    return this.loadingPromises.get(cacheKey)!;
  }

  /**
   * Load HLS.js module
   */
  private async loadHlsModule(): Promise<HlsType> {
    if (hlsModule) return hlsModule;

    const cacheKey = 'hls';
    
    if (!this.loadingPromises.has(cacheKey)) {
      console.log('🎬 Loading HLS.js module...');
      this.loadingPromises.set(cacheKey,
        import('hls.js').then(module => {
          hlsModule = module.default;
          console.log('✅ HLS.js module loaded');
          return hlsModule!;
        })
      );
    }

    return this.loadingPromises.get(cacheKey)!;
  }

  /**
   * Load DASH player module
   */
  private async loadDashPlayer(): Promise<DashPlayerType> {
    if (DashPlayerClass) return DashPlayerClass;

    const cacheKey = 'dash';
    
    if (!this.loadingPromises.has(cacheKey)) {
      console.log('🎬 Loading DASH player module...');
      this.loadingPromises.set(cacheKey,
        import('./dash-player').then(module => {
          DashPlayerClass = module.DashPlayer;
          console.log('✅ DASH player module loaded');
          return DashPlayerClass!;
        })
      );
    }

    return this.loadingPromises.get(cacheKey)!;
  }

  /**
   * Load WebTorrent player module
   */
  private async loadTorrentPlayer(): Promise<TorrentPlayerType> {
    if (TorrentPlayerClass) return TorrentPlayerClass;

    const cacheKey = 'torrent';
    
    if (!this.loadingPromises.has(cacheKey)) {
      console.log('🎬 Loading WebTorrent player module...');
      this.loadingPromises.set(cacheKey,
        import('./torrent-player').then(module => {
          TorrentPlayerClass = module.TorrentPlayer;
          console.log('✅ WebTorrent player module loaded');
          return TorrentPlayerClass!;
        })
      );
    }

    return this.loadingPromises.get(cacheKey)!;
  }
}

// Export singleton instance
export const playerFactory = new LazyPlayerFactory();

/**
 * Convenience function to create a player for a URL
 */
export async function createPlayerForUrl(url: string, options: PlayerOptions): Promise<VideoPlayer> {
  const format = detectStreamFormat(url) as StreamFormat;
  
  // Preload the required modules
  await playerFactory.preloadPlayerForFormat(format);
  
  // Create the player
  return playerFactory.createPlayer(options);
}

/**
 * Preload player modules based on likely usage
 */
export async function preloadCommonPlayers(): Promise<void> {
  // Preload HLS and direct video players as they're most common
  await Promise.all([
    playerFactory.preloadPlayerForFormat('hls'),
    playerFactory.preloadPlayerForFormat('direct')
  ]);
}