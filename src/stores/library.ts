import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { MediaItem } from '../types/tauri';

interface LibraryState {
  items: MediaItem[];
  loading: boolean;
  error: string | null;
}

const initialState: LibraryState = {
  items: [],
  loading: false,
  error: null,
};

function createLibraryStore() {
  const { subscribe, set, update } = writable<LibraryState>(initialState);

  return {
    subscribe,
    
    async load() {
      update(state => ({ ...state, loading: true, error: null }));
      
      try {
        const items = await invoke<MediaItem[]>('get_library_items');
        update(state => ({
          ...state,
          items,
          loading: false,
          error: null,
        }));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        update(state => ({
          ...state,
          loading: false,
          error: errorMessage,
        }));
        throw err;
      }
    },

    async addItem(item: MediaItem) {
      try {
        await invoke('add_to_library', { item });
        // Reload library after adding
        await this.load();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        update(state => ({ ...state, error: errorMessage }));
        throw err;
      }
    },

    async removeItem(itemId: string) {
      try {
        await invoke('remove_from_library', { mediaId: itemId });
        // Remove from local state immediately for better UX
        update(state => ({
          ...state,
          items: state.items.filter(item => item.id !== itemId),
        }));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        update(state => ({ ...state, error: errorMessage }));
        throw err;
      }
    },

    clearError() {
      update(state => ({ ...state, error: null }));
    },

    reset() {
      set(initialState);
    },
  };
}

export const libraryStore = createLibraryStore();

// Derived store for library count
export const libraryCount = derived(
  libraryStore,
  $library => $library.items.length
);
