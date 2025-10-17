/**
 * Stream Format Detection Utility
 * Detects streaming format from URL or content type
 */

export type StreamFormat = 'hls' | 'dash' | 'direct' | 'torrent';

export interface StreamInfo {
  format: StreamFormat;
  mimeType?: string;
  isAdaptive: boolean;
}

/**
 * Detect stream format from URL
 */
export function detectStreamFormat(url: string): StreamFormat {
  const urlLower = url.toLowerCase();
  
  // Magnet link or torrent detection
  if (urlLower.startsWith('magnet:') || urlLower.endsWith('.torrent')) {
    return 'torrent';
  }
  
  // HLS detection
  if (urlLower.includes('.m3u8') || urlLower.includes('m3u8')) {
    return 'hls';
  }
  
  // DASH detection
  if (urlLower.includes('.mpd') || urlLower.includes('dash+xml')) {
    return 'dash';
  }
  
  // Direct video file
  return 'direct';
}

/**
 * Get detailed stream information
 */
export function getStreamInfo(url: string): StreamInfo {
  const format = detectStreamFormat(url);
  const urlLower = url.toLowerCase();
  
  let mimeType: string | undefined;
  let isAdaptive = false;
  
  switch (format) {
    case 'torrent':
      mimeType = 'application/x-bittorrent';
      isAdaptive = false;
      break;
    case 'hls':
      mimeType = 'application/vnd.apple.mpegurl';
      isAdaptive = true;
      break;
    case 'dash':
      mimeType = 'application/dash+xml';
      isAdaptive = true;
      break;
    case 'direct':
      // Detect file extension
      if (urlLower.endsWith('.mp4')) {
        mimeType = 'video/mp4';
      } else if (urlLower.endsWith('.webm')) {
        mimeType = 'video/webm';
      } else if (urlLower.endsWith('.mkv')) {
        mimeType = 'video/x-matroska';
      } else if (urlLower.endsWith('.avi')) {
        mimeType = 'video/x-msvideo';
      }
      isAdaptive = false;
      break;
  }
  
  return {
    format,
    mimeType,
    isAdaptive,
  };
}

/**
 * Check if browser natively supports format
 */
export function isNativelySupported(format: StreamFormat): boolean {
  const video = document.createElement('video');
  
  switch (format) {
    case 'torrent':
      // Torrents require WebTorrent
      return false;
    case 'hls':
      // Safari supports HLS natively
      return video.canPlayType('application/vnd.apple.mpegurl') !== '';
    case 'dash':
      // Most modern browsers support DASH via MSE
      return typeof MediaSource !== 'undefined';
    case 'direct':
      return true;
    default:
      return false;
  }
}
