import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { Addon } from '../types/tauri';
import { Toast } from '../ui-utils';

// This would typically come from a remote API
const CURATED_ADDON_URLS = [
    'https://v3-cinemeta.strem.io/manifest.json',
    'https://watchhub.strem.io/manifest.json',
    'https://94c8cb9f702d-stremio-streaming-catalogs.baby-beamup.club/manifest.json'
];

interface AddonStoreState {
  installedAddons: Addon[];
  storeAddons: Addon[];
  loading: boolean;
  error: string | null;
}

function createAddonStore() {
  const { subscribe, update } = writable<AddonStoreState>({
    installedAddons: [],
    storeAddons: [],
    loading: false,
    error: null,
  });

  const methods = {
    async loadInstalledAddons() {
      update(state => ({ ...state, loading: true }));
      try {
        const addons = await invoke<Addon[]>('get_addons', {});
        update(state => ({ ...state, installedAddons: addons, loading: false }));
      } catch (err) {
        update(state => ({ ...state, error: String(err), loading: false }));
      }
    },

    async loadStoreAddons() {
        update(state => ({ ...state, loading: true }));
        try {
            const manifests = await Promise.all(
                CURATED_ADDON_URLS.map(url => invoke('get_addon_manifest', { url }))
            );
            update(state => ({ ...state, storeAddons: manifests as Addon[], loading: false }));
        } catch (err) {
            update(state => ({ ...state, error: String(err), loading: false }));
        }
    },

    async installAddon(manifestUrl: string) {
      try {
        await invoke('install_addon', { manifestUrl });
        Toast.success('Addon installed successfully!');
        await methods.loadInstalledAddons(); // Refresh the list
      } catch (err) {
        Toast.error(`Failed to install addon: ${err}`);
      }
    },

    async uninstallAddon(addonId: string) {
        try {
            await invoke('uninstall_addon', { addonId });
            Toast.success('Addon uninstalled');
            update(state => ({
                ...state,
                installedAddons: state.installedAddons.filter(a => a.id !== addonId)
            }));
        } catch (err) {
            Toast.error(`Failed to uninstall addon: ${err}`);
        }
    }
  };

  return {
    subscribe,
    ...methods,
  };
}

export const addonStore = createAddonStore();
