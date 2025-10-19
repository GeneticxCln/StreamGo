<script lang="ts">
  import { onMount } from 'svelte';
  import { playlistStore } from '@/stores/playlistStore';
  import MediaCard from '../shared/MediaCard.svelte';
  import { Modal } from '../../ui-utils';

  onMount(() => {
    if ($playlistStore.playlists.length === 0) {
      playlistStore.loadPlaylists();
    }
  });

  async function handleCreatePlaylist() {
    const name = await Modal.prompt('Enter playlist name');
    if (!name) return;
    const newPlaylist = await playlistStore.createPlaylist(name);
    if (newPlaylist) {
      playlistStore.viewPlaylist(newPlaylist.id);
    }
  }

  function handleDragStart(e: DragEvent, itemId: string) {
    e.dataTransfer?.setData('text/plain', itemId);
  }

  function handleDrop(e: DragEvent, targetItemId: string) {
    const draggedItemId = e.dataTransfer?.getData('text/plain');
    if (!draggedItemId || draggedItemId === targetItemId) return;

    const items = $playlistStore.currentPlaylistItems;
    const draggedIndex = items.findIndex(i => i.id === draggedItemId);
    const targetIndex = items.findIndex(i => i.id === targetItemId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newItems = [...items];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, draggedItem);

    $playlistStore.currentPlaylistItems = newItems; // Optimistic update
    const newOrderIds = newItems.map(i => i.id);
    playlistStore.reorderPlaylist($playlistStore.currentPlaylist!.id, newOrderIds);
  }
</script>

<div class="playlists-section">
  {#if $playlistStore.currentPlaylist}
    <button class="back-btn" on:click={() => playlistStore.viewPlaylist('')}>⟵ Back to Playlists</button>
    <div class="playlist-detail-header">
      <h2>{$playlistStore.currentPlaylist.name}</h2>
      <p class="playlist-detail-meta">{$playlistStore.currentPlaylistItems.length} items</p>
      <button class="btn btn-danger" on:click={() => playlistStore.deletePlaylist($playlistStore.currentPlaylist!.id)}>Delete Playlist</button>
    </div>
    <div class="movie-grid" on:dragover|preventDefault={() => {}}>
      {#each $playlistStore.currentPlaylistItems as item (item.id)}
        <div draggable="true" on:dragstart={(e) => handleDragStart(e, item.id)} on:drop|preventDefault={(e) => handleDrop(e, item.id)}>
            <MediaCard {item} />
        </div>
      {/each}
    </div>
  {:else}
    <div class="playlists-header">
      <h2>Your Playlists</h2>
      <button class="btn btn-primary" on:click={handleCreatePlaylist}>Create Playlist</button>
    </div>

    {#if $playlistStore.loading}
      <div class="loading-indicator">Loading playlists...</div>
    {:else if $playlistStore.error}
      <div class="error-state">{$playlistStore.error}</div>
    {:else if $playlistStore.playlists.length === 0}
      <div class="empty-state">
        <h3>No Playlists</h3>
        <p>Create a playlist to organize your favorite media.</p>
        <button class="btn btn-primary" on:click={handleCreatePlaylist}>Create First Playlist</button>
      </div>
    {:else}
      <div class="playlists-grid">
        {#each $playlistStore.playlists as pl}
          <div class="playlist-card" on:click={() => playlistStore.viewPlaylist(pl.id)}>
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