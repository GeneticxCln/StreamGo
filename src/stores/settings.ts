/**
 * Settings Store - Svelte reactive state management
 * 
 * Manages user preferences and settings state
 */

import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { UserPreferences } from '../types/tauri';

export interface SettingsState {
  settings: UserPreferences | null;
  loading: boolean;
  error: string | null;
  hasChanges: boolean;
}

// Default settings
const DEFAULT_SETTINGS: UserPreferences = {
  version: 1,
  theme: 'dark',
  language: 'en',
  ui_language: 'en',
  region: 'auto',
  autoplay: true,
  quality: 'auto',
  subtitle_language: 'en',
  playback_speed: 1.0,
  volume: 0.8,
  notifications_enabled: true,
  auto_update: true,
  telemetry_enabled: false,
  tmdb_api_key: '',
} as any;

// Create the writable store
function createSettingsStore() {
  const { subscribe, set, update } = writable<SettingsState>({
    settings: null,
    loading: false,
    error: null,
    hasChanges: false,
  });

  return {
    subscribe,
    
    /**
     * Load settings from backend
     */
    async load() {
      update(state => ({ ...state, loading: true, error: null }));
      
      try {
        const settings = await invoke<UserPreferences>('get_settings');
        update(state => ({
          ...state,
          settings,
          loading: false,
          hasChanges: false,
        }));
      } catch (error) {
        console.error('Failed to load settings:', error);
        update(state => ({
          ...state,
          settings: DEFAULT_SETTINGS,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load settings',
        }));
      }
    },
    
    /**
     * Update a single setting
     */
    updateSetting<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
      update(state => {
        if (!state.settings) return state;
        
        return {
          ...state,
          settings: {
            ...state.settings,
            [key]: value,
          },
          hasChanges: true,
        };
      });
    },
    
    /**
     * Save settings to backend
     */
    async save() {
      let currentSettings: UserPreferences | null = null;
      
      update(state => {
        currentSettings = state.settings;
        return { ...state, loading: true, error: null };
      });
      
      if (!currentSettings) {
        update(state => ({ ...state, loading: false, error: 'No settings to save' }));
        return false;
      }
      
      try {
        await invoke('save_settings', { settings: currentSettings });
        update(state => ({
          ...state,
          loading: false,
          hasChanges: false,
        }));
        return true;
      } catch (error) {
        console.error('Failed to save settings:', error);
        update(state => ({
          ...state,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to save settings',
        }));
        return false;
      }
    },
    
    /**
     * Reset settings to defaults
     */
    reset() {
      update(state => ({
        ...state,
        settings: DEFAULT_SETTINGS,
        hasChanges: true,
      }));
    },
    
    /**
     * Reset state (for testing or reloading)
     */
    clear() {
      set({
        settings: null,
        loading: false,
        error: null,
        hasChanges: false,
      });
    },
  };
}

// Export the store instance
export const settingsStore = createSettingsStore();

// Derived stores for convenience
export const currentTheme = derived(
  settingsStore,
  $store => $store.settings?.theme || 'dark'
);

export const isLoading = derived(
  settingsStore,
  $store => $store.loading
);

export const hasUnsavedChanges = derived(
  settingsStore,
  $store => $store.hasChanges
);
