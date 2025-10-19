import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { Playlist, MediaItem } from '../types/tauri';
import { Toast, Modal } from '../ui-utils';

interface PlaylistState {
  playlists: Playlist[];
  currentPlaylist: Playlist | null;
  currentPlaylistItems: MediaItem[];
  loading: boolean;
  error: string | null;
}

function createPlaylistStore() {
  const { subscribe, update } = writable<PlaylistState>({
    playlists: [],
    currentPlaylist: null,
    currentPlaylistItems: [],
    loading: false,
    error: null,
  });

  const methods = {
    async loadPlaylists() {
      update(state => ({ ...state, loading: true }));
      try {
        const playlists = await invoke<Playlist[]>('get_playlists', {});
        update(state => ({ ...state, playlists, loading: false }));
      } catch (err) {
        console.error('Failed to load playlists:', err);
        update(state => ({ ...state, error: String(err), loading: false }));
      }
    },

    async createPlaylist(name: string, description?: string) {
      try {
        const newPlaylist = await invoke<Playlist>('create_playlist', { name, description });
        update(state => ({ ...state, playlists: [...state.playlists, newPlaylist] }));
        Toast.success('Playlist created successfully');
        return newPlaylist;
      } catch (err) {
        console.error('Failed to create playlist:', err);
        Toast.error(`Failed to create playlist: ${err}`);
        return null;
      }
    },

    async deletePlaylist(playlistId: string) {
      const confirmed = await Modal.confirm('Are you sure you want to delete this playlist?');
      if (!confirmed) return;

      try {
        await invoke('delete_playlist', { playlistId });
        update(state => ({
          ...state,
          playlists: state.playlists.filter(p => p.id !== playlistId),
        }));
        Toast.success('Playlist deleted');
      } catch (err) {
        console.error('Failed to delete playlist:', err);
        Toast.error(`Failed to delete playlist: ${err}`);
      }
    },

    async viewPlaylist(playlistId: string) {
      update(state => ({ ...state, loading: true }));
      try {
        const playlist = await invoke<Playlist>('get_playlist', { playlistId });
        const items = await invoke<MediaItem[]>('get_playlist_items', { playlistId });
        update(state => ({
          ...state,
          currentPlaylist: playlist,
          currentPlaylistItems: items,
          loading: false,
        }));
      } catch (err) {
        console.error('Failed to view playlist:', err);
        update(state => ({ ...state, error: String(err), loading: false }));
      }
    },

    async addItemToPlaylist(playlistId: string, mediaId: string) {
        try {
            await invoke('add_item_to_playlist', { playlistId, mediaId });
            Toast.success('Added to playlist');
            // Refresh data
            update(state => {
                if (state.currentPlaylist?.id === playlistId) {
                    methods.viewPlaylist(playlistId);
                }
                return state;
            });
            methods.loadPlaylists(); // To update item count
        } catch (err) {
            console.error('Failed to add item:', err);
            Toast.error(`Failed to add item: ${err}`);
        }
    },

    async removeItemFromPlaylist(playlistId: string, mediaId: string) {
        try {
            await invoke('remove_from_playlist', { playlistId, mediaId });
            Toast.success('Removed from playlist');
            update(state => ({
                ...state,
                currentPlaylistItems: state.currentPlaylistItems.filter(item => item.id !== mediaId)
            }));
            methods.loadPlaylists(); // To update item count
        } catch (err) {
            console.error('Failed to remove item:', err);
            Toast.error(`Failed to remove item: ${err}`);
        }
    },

    async reorderPlaylist(playlistId: string, mediaIds: string[]) {
        try {
            await invoke('reorder_playlist', { playlistId, mediaIds });
            Toast.success('Playlist order saved');
        } catch (err) {
            console.error('Failed to reorder playlist:', err);
            Toast.error(`Failed to save order: ${err}`);
        }
    }
  };

  return {
    subscribe,
    ...methods,
  };
}

export const playlistStore = createPlaylistStore();
