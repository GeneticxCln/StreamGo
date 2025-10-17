/**
 * Image Optimization Utilities
 * 
 * Provides lazy loading, skeleton loaders, and image optimization features
 */

/**
 * Image loader with lazy loading support
 */
export class LazyImageLoader {
  private observer: IntersectionObserver | null = null;
  private imageElements: Set<HTMLImageElement> = new Set();

  constructor(options?: IntersectionObserverInit) {
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        this.handleIntersection.bind(this),
        {
          rootMargin: '50px 0px', // Start loading 50px before entering viewport
          threshold: 0.01,
          ...options,
        }
      );
    }
  }

  /**
   * Register an image element for lazy loading
   */
  observe(img: HTMLImageElement): void {
    if (!this.observer) {
      // Fallback: load immediately if IntersectionObserver not supported
      this.loadImage(img);
      return;
    }

    this.imageElements.add(img);
    this.observer.observe(img);
  }

  /**
   * Unregister an image element
   */
  unobserve(img: HTMLImageElement): void {
    if (this.observer) {
      this.observer.unobserve(img);
    }
    this.imageElements.delete(img);
  }

  /**
   * Handle intersection changes
   */
  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        this.loadImage(img);
        this.unobserve(img);
      }
    });
  }

  /**
   * Load image from data-src attribute
   */
  private loadImage(img: HTMLImageElement): void {
    const src = img.dataset.src;
    if (src) {
      // Show skeleton loader
      img.classList.add('loading');

      // Create a new Image object to handle loading
      const tempImg = new Image();
      
      tempImg.onload = () => {
        img.src = src;
        img.classList.remove('loading');
        img.classList.add('loaded');
      };

      tempImg.onerror = () => {
        img.classList.remove('loading');
        img.classList.add('error');
        // Set a fallback image
        img.src = this.getFallbackImage();
      };

      tempImg.src = src;
    }
  }

  /**
   * Get fallback image for failed loads
   */
  private getFallbackImage(): string {
    // Return a data URL for a simple gray placeholder
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"%3E%3Crect fill="%23333" width="300" height="450"/%3E%3Ctext fill="%23666" font-family="sans-serif" font-size="24" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
  }

  /**
   * Cleanup all observers
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.imageElements.clear();
  }
}

/**
 * Generate optimized image URL with size parameters
 */
export function getOptimizedImageUrl(
  url: string,
  width?: number,
  _quality?: number
): string {
  if (!url) return '';

  // For TMDB images, we can use their size parameters
  if (url.includes('image.tmdb.org')) {
    // TMDB supports: w92, w154, w185, w342, w500, w780, original
    const size = width ? getClosestTMDBSize(width) : 'w500';
    return url.replace(/w\d+|original/, size);
  }

  // For other images, return as-is (could be extended with a CDN service)
  return url;
}

/**
 * Get closest TMDB image size
 */
function getClosestTMDBSize(width: number): string {
  const sizes = [92, 154, 185, 342, 500, 780];
  const closest = sizes.reduce((prev, curr) =>
    Math.abs(curr - width) < Math.abs(prev - width) ? curr : prev
  );
  return `w${closest}`;
}

/**
 * Preload critical images
 */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Preload multiple images
 */
export async function preloadImages(urls: string[]): Promise<void> {
  await Promise.all(urls.map(url => preloadImage(url)));
}

/**
 * Progressive image loader - load low quality first, then high quality
 */
export class ProgressiveImageLoader {
  load(
    container: HTMLElement,
    lowQualityUrl: string,
    highQualityUrl: string
  ): void {
    const img = container.querySelector('img');
    if (!img) return;

    // Add blur effect for low quality image
    img.classList.add('progressive-loading');

    // Load low quality image first
    img.src = lowQualityUrl;

    // Then load high quality image
    const highQualityImg = new Image();
    highQualityImg.onload = () => {
      img.src = highQualityUrl;
      img.classList.remove('progressive-loading');
      img.classList.add('progressive-loaded');
    };
    highQualityImg.src = highQualityUrl;
  }
}

/**
 * Image cache manager
 */
export class ImageCache {
  private static cache = new Map<string, { blob: Blob; url: string }>();
  private static maxSize = 50 * 1024 * 1024; // 50MB
  private static currentSize = 0;

  /**
   * Get image from cache or fetch
   */
  static async get(url: string): Promise<string> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached) {
      return cached.url;
    }

    // Fetch and cache
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objUrl = URL.createObjectURL(blob);

      // Add to cache if there's space
      if (this.currentSize + blob.size < this.maxSize) {
        this.cache.set(url, { blob, url: objUrl });
        this.currentSize += blob.size;
      }

      return objUrl;
    } catch (error) {
      console.error('Failed to fetch image:', error);
      throw error;
    }
  }

  /**
   * Clear cache
   */
  static clear(): void {
    // Revoke all object URLs we created
    this.cache.forEach((entry) => {
      URL.revokeObjectURL(entry.url);
    });

    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * Get cache size
   */
  static getSize(): number {
    return this.currentSize;
  }
}

/**
 * React hook for lazy loading images
 */
export function useLazyImage() {
  let loader: LazyImageLoader | null = null;

  const init = () => {
    if (!loader) {
      loader = new LazyImageLoader();
    }
    return loader;
  };

  const observe = (img: HTMLImageElement | null) => {
    if (img && loader) {
      loader.observe(img);
    }
  };

  const cleanup = () => {
    if (loader) {
      loader.destroy();
      loader = null;
    }
  };

  return { init, observe, cleanup };
}

/**
 * CSS for skeleton loaders and lazy loading animations
 */
export const imageStyles = `
  /* Skeleton loader */
  img.loading {
    background: linear-gradient(
      90deg,
      #f0f0f0 25%,
      #e0e0e0 50%,
      #f0f0f0 75%
    );
    background-size: 200% 100%;
    animation: loading 1.5s ease-in-out infinite;
  }

  @keyframes loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* Loaded state */
  img.loaded {
    animation: fadeIn 0.3s ease-in;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Error state */
  img.error {
    filter: grayscale(100%);
    opacity: 0.5;
  }

  /* Progressive loading */
  img.progressive-loading {
    filter: blur(10px);
    transform: scale(1.05);
    transition: filter 0.3s ease, transform 0.3s ease;
  }

  img.progressive-loaded {
    filter: blur(0);
    transform: scale(1);
  }

  /* Placeholder skeleton */
  .image-skeleton {
    background: linear-gradient(
      90deg,
      #f0f0f0 25%,
      #e0e0e0 50%,
      #f0f0f0 75%
    );
    background-size: 200% 100%;
    animation: loading 1.5s ease-in-out infinite;
    border-radius: 8px;
  }
`;
