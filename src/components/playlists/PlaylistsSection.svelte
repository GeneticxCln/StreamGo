<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import type { Playlist, MediaItem } from '../../types/tauri';
  import MediaCard from '../shared/MediaCard.svelte';

  let playlists: Playlist[] = [];
  let loading = false;
  let error: string | null = null;

  let viewing: Playlist | null = null;
  let items: MediaItem[] = [];

  onMount(loadPlaylists);

  async function loadPlaylists() {
    loading = true;
    error = null;
    try {
      playlists = await invoke<Playlist[]>('get_playlists', {} as any);
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  async function viewPlaylist(pl: Playlist) {
    viewing = pl;
    items = await invoke<MediaItem[]>('get_playlist_items', { playlistId: pl.id });
  }

  async function backToList() {
    viewing = null;
    items = [];
  }

  async function createPlaylist() {
    const name = prompt('Playlist name');
    if (!name) return;
    await invoke<string>('create_playlist', { name });
    await loadPlaylists();
  }

  async function deletePlaylist(pl: Playlist) {
    if (!confirm(`Delete playlist "${pl.name}"?`)) return;
    await invoke('delete_playlist', { playlistId: pl.id });
    await loadPlaylists();
    if (viewing?.id === pl.id) backToList();
  }
</script>

<div class="playlists-section">
  {#if viewing}
    <button class="back-btn" on:click={backToList}>⟵ Back to Playlists</button>
    <div class="playlist-detail-header">
      <h2>{viewing.name}</h2>
      <p class="playlist-detail-meta">{items.length} items</p>
      <button class="btn btn-danger" on:click={() => deletePlaylist(viewing!)}>Delete Playlist</button>
    </div>
    <div class="movie-grid">
      {#each items as item (item.id)}
        <MediaCard {item} />
      {/each}
    </div>
  {:else}
    <div class="playlists-header">
      <h2>Your Playlists</h2>
      <button class="btn btn-primary" on:click={createPlaylist}>Create Playlist</button>
    </div>

    {#if loading}
      <div class="loading-indicator">Loading playlists...</div>
    {:else if error}
      <div class="error-state">{error}</div>
    {:else if playlists.length === 0}
      <p class="empty-message">No playlists yet. Create one to get started!</p>
    {:else}
      <div class="playlists-grid">
        {#each playlists as pl}
          <div class="playlist-card" on:click={() => viewPlaylist(pl)}>
            <div class="playlist-detail-icon">🎞️</div>
            <div class="playlist-card-body">
              <div class="playlist-card-title">{pl.name}</div>
              <div class="playlist-card-meta">{pl.item_count} items</div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>