import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { UserPreferences } from '../types/tauri';
import { Toast } from '../ui-utils';

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
  default_quality: 'auto',
  video_codec: 'auto',
  max_bitrate: 'auto',
  hardware_accel: true,
  audio_codec: 'auto',
  audio_channels: 'auto',
  volume_normalize: false,
  autoplay_next: true,
  skip_intro: false,
  resume_playback: true,
  subtitles_enabled: false,
  subtitle_size: 'medium',
  buffer_size: 'medium',
  preload_next: true,
  torrent_connections: '100',
  cache_size: '1024',
  player_engine: 'auto',
  debug_logging: false,
  analytics: false
};

function createSettingsStore() {
  const { subscribe, set, update } = writable<UserPreferences>(DEFAULT_SETTINGS);

  return {
    subscribe,

    async loadSettings() {
      try {
        const settings = await invoke<UserPreferences>('get_settings');
        set(settings);
      } catch (error) {
        console.error('Failed to load settings:', error);
        set(DEFAULT_SETTINGS);
      }
    },

    async saveSettings() {
      try {
        update(state => {
          invoke('save_settings', { settings: state });
          return state;
        });
        Toast.success('Settings saved successfully!');
      } catch (error) {
        console.error('Failed to save settings:', error);
        Toast.error(`Error saving settings: ${error}`);
      }
    },

    async resetSettings() {
      set(DEFAULT_SETTINGS);
      await this.saveSettings();
      Toast.success('Settings have been reset to defaults.');
    },

    // Allow direct update for bind: directives
    update,
    set,
  };
}

export const settingsStore = createSettingsStore();
