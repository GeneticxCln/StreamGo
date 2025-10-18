import { invoke } from '@tauri-apps/api/core';

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

class I18nManager {
  private currentLocale: string = 'en';
  private translations: Map<string, Record<string, string>> = new Map();
  private fallbackLocale: string = 'en';
  private listeners: Set<(locale: string) => void> = new Set();

  constructor(options: I18nOptions = {}) {
    this.fallbackLocale = options.fallbackLocale || 'en';
    if (options.onLocaleChange) {
      this.listeners.add(options.onLocaleChange);
    }
  }

  async init(): Promise<void> {
    try {
      // Get current locale from backend
      this.currentLocale = await invoke<string>('i18n_get_current_locale');
      
      // Load translations for current locale
      await this.loadLocale(this.currentLocale);
      
      // Apply RTL if needed
      this.applyDirection();
    } catch (error) {
      console.error('Failed to initialize i18n:', error);
    }
  }

  async loadLocale(locale: string): Promise<void> {
    try {
      const response = await fetch(`/locales/${locale}.json`);
      if (response.ok) {
        const translations = await response.json();
        this.translations.set(locale, translations);
      }
    } catch (error) {
      console.warn(`Failed to load translations for ${locale}:`, error);
    }
  }

  async setLocale(locale: string): Promise<void> {
    try {
      await invoke('i18n_set_locale', { locale });
      this.currentLocale = locale;
      
      // Load translations if not already loaded
      if (!this.translations.has(locale)) {
        await this.loadLocale(locale);
      }
      
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

  t(key: string, params?: Record<string, string | number>): string {
    const localeTranslations = this.translations.get(this.currentLocale);
    let translation = localeTranslations?.[key];

    // Fallback to default locale
    if (!translation && this.currentLocale !== this.fallbackLocale) {
      const fallbackTranslations = this.translations.get(this.fallbackLocale);
      translation = fallbackTranslations?.[key];
    }

    // Ultimate fallback: return the key
    if (!translation) {
      return key;
    }

    // Simple parameter substitution
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        translation = translation!.replace(
          new RegExp(`\\{\\s*\\$${paramKey}\\s*\\}`, 'g'),
          String(value)
        );
      });
    }

    return translation;
  }

  // Pluralization helper
  plural(key: string, count: number, params?: Record<string, string | number>): string {
    const pluralKey = count === 1 ? `${key}.one` : `${key}.other`;
    const mergedParams = { ...params, count };
    return this.t(pluralKey, mergedParams);
  }

  onLocaleChange(callback: (locale: string) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentLocale));
  }

  private applyDirection(): void {
    const localeInfo = this.getLocaleInfo(this.currentLocale);
    document.documentElement.dir = localeInfo?.rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = this.currentLocale;
  }

  private getLocaleInfo(locale: string): LocaleInfo | null {
    // This is synchronous, so we need to cache locale info
    // For now, return a basic structure using the locale
    console.warn(`getLocaleInfo is a stub and does not properly resolve locale: ${locale}. Returning default.`);
    return {
      code: locale,
      name: locale,
      native_name: locale,
      rtl: false,
    };
  }
}

// Export singleton instance
export const i18n = new I18nManager();

// Auto-initialize when module loads
i18n.init();

// Utility function for templates
export function t(key: string, params?: Record<string, string | number>): string {
  return i18n.t(key, params);
}

export function plural(key: string, count: number, params?: Record<string, string | number>): string {
  return i18n.plural(key, count, params);
}
