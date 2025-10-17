/**
 * WebTorrent Player
 * Handles magnet links and .torrent files
 */

import WebTorrent from 'webtorrent';
import type { Torrent, TorrentFile } from 'webtorrent';

export interface TorrentStats {
  downloadSpeed: number;
  uploadSpeed: number;
  progress: number;
  numPeers: number;
  downloaded: number;
  uploaded: number;
}

export class TorrentPlayer {
  private client: WebTorrent.Instance;
  private currentTorrent: Torrent | null = null;
  private video: HTMLVideoElement;
  private statsInterval: number | null = null;
  private onStatsUpdate?: (stats: TorrentStats) => void;

  constructor(video: HTMLVideoElement) {
    this.video = video;
    this.client = new WebTorrent({
      tracker: {
        rtcConfig: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      },
    });

    console.log('WebTorrent client initialized');
  }

  /**
   * Load a magnet link or torrent URL
   */
  load(magnetOrTorrentUrl: string, onStatsUpdate?: (stats: TorrentStats) => void): void {
    this.onStatsUpdate = onStatsUpdate;

    console.log('Loading torrent:', magnetOrTorrentUrl);

    this.client.add(magnetOrTorrentUrl, (torrent) => {
      this.currentTorrent = torrent;
      console.log('Torrent added:', torrent.name);

      // Find the largest video file in the torrent
      const videoFile = this.findLargestVideoFile(torrent.files);

      if (!videoFile) {
        console.error('No video file found in torrent');
        throw new Error('No video file found in torrent');
      }

      console.log('Playing video file:', videoFile.name, 'Size:', this.formatBytes(videoFile.length));

      // Render the video file to the video element
      videoFile.renderTo(this.video, {
        autoplay: true,
        controls: false, // We use custom controls
      });

      // Start collecting stats
      this.startStatsCollection();
    });

    // Handle torrent errors
    this.client.on('error', (err) => {
      console.error('WebTorrent error:', err);
    });
  }

  /**
   * Find the largest video file in the torrent
   */
  private findLargestVideoFile(files: TorrentFile[]): TorrentFile | null {
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v', '.flv'];

    const videoFiles = files.filter((file) =>
      videoExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
    );

    if (videoFiles.length === 0) return null;

    // Return the largest video file
    return videoFiles.reduce((largest, file) => (file.length > largest.length ? file : largest));
  }

  /**
   * Start collecting torrent stats
   */
  private startStatsCollection(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    this.statsInterval = window.setInterval(() => {
      if (this.currentTorrent && this.onStatsUpdate) {
        const stats: TorrentStats = {
          downloadSpeed: this.currentTorrent.downloadSpeed,
          uploadSpeed: this.currentTorrent.uploadSpeed,
          progress: this.currentTorrent.progress,
          numPeers: this.currentTorrent.numPeers,
          downloaded: this.currentTorrent.downloaded,
          uploaded: this.currentTorrent.uploaded,
        };

        this.onStatsUpdate(stats);
      }
    }, 1000); // Update every second
  }

  /**
   * Stop stats collection
   */
  private stopStatsCollection(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get current torrent stats
   */
  getStats(): TorrentStats | null {
    if (!this.currentTorrent) return null;

    return {
      downloadSpeed: this.currentTorrent.downloadSpeed,
      uploadSpeed: this.currentTorrent.uploadSpeed,
      progress: this.currentTorrent.progress,
      numPeers: this.currentTorrent.numPeers,
      downloaded: this.currentTorrent.downloaded,
      uploaded: this.currentTorrent.uploaded,
    };
  }

  /**
   * Format speed to human-readable string
   */
  static formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return Math.round(bytesPerSecond / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format bytes to human-readable string
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Destroy the torrent player and clean up
   */
  destroy(): void {
    console.log('Destroying torrent player');

    this.stopStatsCollection();

    if (this.currentTorrent) {
      this.currentTorrent.destroy();
      this.currentTorrent = null;
    }

    if (this.client) {
      this.client.destroy();
    }
  }
}
