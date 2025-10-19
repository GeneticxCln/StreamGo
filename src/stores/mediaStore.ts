import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { MediaItem, Stream } from '../types/tauri';

interface MediaState {
  currentItem: MediaItem | null;
  streams: Stream[];
  similarItems: MediaItem[];
  loading: boolean;
  error: string | null;
}

function createMediaStore() {
  const { subscribe, update } = writable<MediaState>({
    currentItem: null,
    streams: [],
    similarItems: [],
    loading: false,
    error: null,
  });

  const methods = {
    async showMediaDetail(mediaId: string) {
      update(state => ({ ...state, loading: true, currentItem: null, streams: [], similarItems: [] }));
      try {
        // This is a simplified approach. A real app might fetch the item from the backend.
        // For now, we assume the item is passed or already available from another store.
        const mediaItem = await invoke<MediaItem>('get_media_item_details', { mediaId });

        update(state => ({ ...state, currentItem: mediaItem, loading: false }));

        // After loading the item, fetch streams and similar content
        methods.loadStreams(mediaId, mediaItem.media_type);
        methods.loadSimilar(mediaItem);
      } catch (err) {
        update(state => ({ ...state, error: String(err), loading: false }));
      }
    },

    async loadStreams(mediaId: string, mediaType: any) {
        try {
            const typeStr = typeof mediaType === 'string' ? mediaType.toLowerCase() : 'movie';
            const streams = await invoke<Stream[]>('get_streams', { contentId: mediaId, mediaType: typeStr });
            update(state => ({ ...state, streams }));
        } catch (err) {
            console.warn('Could not load streams:', err);
            update(state => ({ ...state, streams: [] }));
        }
    },

    async loadSimilar(_mediaItem: MediaItem) {
        // Logic to load similar items, adapted from the old component
    },

    playStream(stream: Stream) {
        // This logic will be moved from app.ts
        console.log('Playing stream:', stream);
        const player = (window as any).player;
        if (player) {
            player.loadVideo(stream.url, stream.title);
        }
    }
  };

  return {
    subscribe,
    ...methods,
  };
}

export const mediaStore = createMediaStore();
