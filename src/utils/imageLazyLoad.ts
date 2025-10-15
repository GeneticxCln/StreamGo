/**
 * Image Lazy Loading Utility
 * 
 * Uses Intersection Observer to lazy load images when they enter the viewport.
 * Improves initial page load performance by deferring off-screen images.
 */

interface LazyLoadOptions {
  /** Root margin for triggering load before entering viewport (default: '50px') */
  rootMargin?: string;
  /** Threshold for visibility (default: 0.01) */
  threshold?: number;
  /** Placeholder image while loading (default: gray gradient) */
  placeholder?: string;
  /** Class to add during loading */
  loadingClass?: string;
  /** Class to add after loaded */
  loadedClass?: string;
  /** Class to add on error */
  errorClass?: string;
}

const DEFAULT_OPTIONS: LazyLoadOptions = {
  rootMargin: '50px',
  threshold: 0.01,
  placeholder: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 300 450\'%3E%3Crect fill=\'%232a2a2a\' width=\'300\' height=\'450\'/%3E%3C/svg%3E',
  loadingClass: 'lazy-loading',
  loadedClass: 'lazy-loaded',
  errorClass: 'lazy-error',
};

class ImageLazyLoader {
  private observer: IntersectionObserver | null = null;
  private options: LazyLoadOptions;
  private loadedImages = new Set<HTMLImageElement>();

  constructor(options: LazyLoadOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.init();
  }

  /**
   * Initialize the Intersection Observer
   */
  private init(): void {
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported, falling back to immediate loading');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target as HTMLImageElement);
          }
        });
      },
      {
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold,
      }
    );
  }

  /**
   * Load an image
   */
  private loadImage(img: HTMLImageElement): void {
    // Skip if already loaded
    if (this.loadedImages.has(img)) {
      return;
    }

    const src = img.dataset.src;
    const srcset = img.dataset.srcset;

    if (!src && !srcset) {
      return;
    }

    // Add loading class
    if (this.options.loadingClass) {
      img.classList.add(this.options.loadingClass);
    }

    // Create a temporary image to preload
    const tempImg = new Image();

    tempImg.onload = () => {
      // Set the actual image source
      if (src) {
        img.src = src;
      }
      if (srcset) {
        img.srcset = srcset;
      }

      // Remove loading class, add loaded class
      if (this.options.loadingClass) {
        img.classList.remove(this.options.loadingClass);
      }
      if (this.options.loadedClass) {
        img.classList.add(this.options.loadedClass);
      }

      // Mark as loaded
      this.loadedImages.add(img);

      // Stop observing
      if (this.observer) {
        this.observer.unobserve(img);
      }
    };

    tempImg.onerror = () => {
      console.error('Failed to load image:', src || srcset);
      
      // Add error class
      if (this.options.errorClass) {
        img.classList.add(this.options.errorClass);
      }
      if (this.options.loadingClass) {
        img.classList.remove(this.options.loadingClass);
      }

      // Fallback to placeholder or default broken image
      img.src = this.options.placeholder || 'https://via.placeholder.com/300x450?text=Error';

      // Stop observing
      if (this.observer) {
        this.observer.unobserve(img);
      }
    };

    // Start loading
    if (src) {
      tempImg.src = src;
    }
  }

  /**
   * Observe an image element for lazy loading
   */
  observe(img: HTMLImageElement): void {
    // If no IntersectionObserver, load immediately
    if (!this.observer) {
      this.loadImage(img);
      return;
    }

    // Set placeholder if image has no src
    if (!img.src || img.src === window.location.href) {
      img.src = this.options.placeholder || '';
    }

    // Start observing
    this.observer.observe(img);
  }

  /**
   * Observe multiple images
   */
  observeAll(selector: string = 'img[data-src]'): void {
    const images = document.querySelectorAll<HTMLImageElement>(selector);
    images.forEach((img) => this.observe(img));
  }

  /**
   * Unobserve an image
   */
  unobserve(img: HTMLImageElement): void {
    if (this.observer) {
      this.observer.unobserve(img);
    }
  }

  /**
   * Disconnect the observer
   */
  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.loadedImages.clear();
  }

  /**
   * Get loading statistics
   */
  getStats(): { loaded: number } {
    return {
      loaded: this.loadedImages.size,
    };
  }
}

// Export a singleton instance
export const lazyLoader = new ImageLazyLoader();

/**
 * Helper function to setup lazy loading for images
 * 
 * Usage:
 * ```html
 * <img data-src="actual-image.jpg" src="placeholder.jpg" alt="..." />
 * ```
 * 
 * ```ts
 * import { setupLazyLoading } from './utils/imageLazyLoad';
 * 
 * // Setup after rendering new content
 * setupLazyLoading();
 * ```
 */
export function setupLazyLoading(selector: string = 'img[data-src]'): void {
  lazyLoader.observeAll(selector);
}

/**
 * Helper function to convert regular img to lazy-loaded img
 */
export function makeLazyImage(img: HTMLImageElement): void {
  if (img.dataset.src) {
    // Already set up for lazy loading
    lazyLoader.observe(img);
    return;
  }

  // Convert existing src to data-src
  const src = img.src;
  if (src && src !== window.location.href) {
    img.dataset.src = src;
    img.src = DEFAULT_OPTIONS.placeholder || '';
    lazyLoader.observe(img);
  }
}

/**
 * Preload specific images (bypass lazy loading)
 */
export function preloadImages(urls: string[]): Promise<void[]> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to preload: ${url}`));
          img.src = url;
        })
    )
  );
}

export default lazyLoader;
