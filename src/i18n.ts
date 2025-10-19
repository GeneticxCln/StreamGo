// Fluent-based i18n manager for StreamGo frontend
// - Loads .ftl resources using Vite's import.meta.glob (as raw text)
// - Uses @fluent/bundle to format messages
// - Integrates with Tauri backend commands to get/set current locale

import { invoke } from '@tauri-apps/api/core';
import { FluentBundle, FluentResource } from '@fluent/bundle';

export interface LocaleInfo {
  code: string;
  name: string;
  native_name: string;
  rtl: boolean;
}

export interface I18nOptions {
  fallbackLocale?: string;
  onLocaleChange?: (locale: string) => void;
}

// Vite will include these resources at build time
// Keyed by relative path from this file, e.g. '../locales/en.ftl'
const ftlModules: Record<string, () => Promise<string>> = import.meta.glob('../locales/*.ftl', {
  as: 'raw'
});

class I18nManager {
  private currentLocale: string = 'en';
  private fallbackLocale: string = 'en';
  private listeners: Set<(locale: string) => void> = new Set();

  // Cache of FluentBundle per locale
  private bundles: Map<string, FluentBundle> = new Map();

  constructor(options: I18nOptions = {}) {
    this.fallbackLocale = options.fallbackLocale || 'en';
    if (options.onLocaleChange) this.listeners.add(options.onLocaleChange);
  }

  async init(): Promise<void> {
    try {
      const locale = await invoke<string>('i18n_get_current_locale');
      this.currentLocale = locale || this.fallbackLocale;
    } catch {
      this.currentLocale = this.fallbackLocale;
    }

    // Preload current + fallback bundles
    await this.ensureBundle(this.currentLocale);
    if (this.currentLocale !== this.fallbackLocale) {
      await this.ensureBundle(this.fallbackLocale);
    }

    // Apply direction and language attributes
    this.applyDirection();
  }

  async setLocale(locale: string): Promise<void> {
    try {
      await invoke('i18n_set_locale', { locale });
      this.currentLocale = locale;
      await this.ensureBundle(locale);
      this.applyDirection();
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to set locale:', error);
      throw error;
    }
  }

  getLocale(): string {
    return this.currentLocale;
  }

  async getSupportedLocales(): Promise<LocaleInfo[]> {
    try {
      return await invoke<LocaleInfo[]>('i18n_get_supported_locales');
    } catch (error) {
      console.error('Failed to get supported locales:', error);
      return [];
    }
  }

  // Subscribe to locale changes; returns an unsubscribe function
  onLocaleChange(callback: (locale: string) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // Translate a message by key with optional params
  t(key: string, params?: Record<string, string | number>): string {
    const bundle = this.bundles.get(this.currentLocale);
    const fbBundle = this.bundles.get(this.fallbackLocale);

    const args = params ? this.toFluentArgs(params) : undefined;

    const tryFormat = (b?: FluentBundle): string | null => {
      if (!b) return null;
      const msg = b.getMessage(key);
      if (!msg || !msg.value) return null;
      try {
        return b.formatPattern(msg.value, args);
      } catch {
        return null;
      }
    };

    const primary = tryFormat(bundle);
    if (primary != null) return primary;

    const fallback = tryFormat(fbBundle);
    if (fallback != null) return fallback;

    return key; // ultimate fallback
  }

  // Rudimentary plural helper using Fluent keys with .one/.other suffixes
  plural(key: string, count: number, params?: Record<string, string | number>): string {
    const pluralKey = `${key}${count === 1 ? '.one' : '.other'}`;
    const mergedParams = { ...(params || {}), count };
    return this.t(pluralKey, mergedParams);
  }

  // Translate DOM elements with data-i18n attributes
  translateDOM(container?: Element | Document): void {
    const root = container || document;
    const elements = root.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = (el as HTMLElement).getAttribute('data-i18n');
      if (!key) return;

      const argsRaw = (el as HTMLElement).getAttribute('data-i18n-args');
      let args: Record<string, string | number> | undefined;
      if (argsRaw) {
        try { args = JSON.parse(argsRaw); } catch {}
      }

      const text = this.t(key, args);
      el.textContent = text;
    });
  }

  // Ensure a bundle is loaded for a locale
  private async ensureBundle(locale: string): Promise<void> {
    if (this.bundles.has(locale)) return;

    const path = `../locales/${locale}.ftl`;
    const loader = ftlModules[path];
    if (!loader) {
      console.warn(`FTL not found for locale: ${locale} at ${path}`);
      // Create empty bundle to avoid repeated lookups
      this.bundles.set(locale, new FluentBundle(locale));
      return;
    }

    try {
      const source = await loader();
      const resource = new FluentResource(source);
      const bundle = new FluentBundle(locale);
      const errors = bundle.addResource(resource);
      if (errors && errors.length > 0) {
        console.warn(`Fluent parsing errors for ${locale}:`, errors);
      }
      this.bundles.set(locale, bundle);
    } catch (error) {
      console.error(`Failed to load FTL for ${locale}:`, error);
      this.bundles.set(locale, new FluentBundle(locale));
    }
  }

  private toFluentArgs(params: Record<string, string | number>) {
    // @fluent/bundle accepts regular objects as args
    return params as any;
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentLocale));
  }

  private async applyDirection(): Promise<void> {
    // Optionally fetch locale metadata from backend
    try {
      const locales = await this.getSupportedLocales();
      const info = locales.find(l => l.code === this.currentLocale);
      document.documentElement.dir = info?.rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = this.currentLocale;
    } catch {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = this.currentLocale;
    }
  }
}

// Singleton instance
export const i18n = new I18nManager();

// Auto-initialize and expose helpers
void i18n.init().then(() => {
  // Initial translation pass can be deferred to app code as needed
}).catch(err => console.error('i18n init failed:', err));

export function t(key: string, params?: Record<string, string | number>): string {
  return i18n.t(key, params);
}

export function plural(key: string, count: number, params?: Record<string, string | number>): string {
  return i18n.plural(key, count, params);
}

export function translateDOM(container?: Element | Document): void {
  i18n.translateDOM(container);
}
