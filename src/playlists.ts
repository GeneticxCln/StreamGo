// Playlist Management Module
import type { MediaItem, Playlist } from './types/tauri';
import { invoke } from './utils';
import { escapeHtml } from './utils/security';
import { Toast, Modal } from './ui-utils';
import { setupLazyLoading } from './utils/imageLazyLoad';

export class PlaylistManager {
    private playlists: Playlist[] = [];
    private currentPlaylist: Playlist | null = null;
    private currentPlaylistItems: MediaItem[] = [];
    private draggedElement: HTMLElement | null = null;

    constructor() {
        this.init();
    }

    async init() {
        await this.loadPlaylists();
        this.setupEventListeners();
    }

    private setupEventListeners() {
        // Create playlist button
        const createBtn = document.getElementById('create-playlist-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.showCreatePlaylistDialog());
        }

        // Back to playlists list button
        const backBtn = document.getElementById('playlist-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.showPlaylistsList());
        }
    }

    async loadPlaylists() {
        try {
            this.playlists = await invoke<Playlist[]>('get_playlists', {});
            this.renderPlaylists();
        } catch (err) {
            console.error('Failed to load playlists:', err);
            Toast.error(`Failed to load playlists: ${err}`);
        }
    }

    private renderPlaylists() {
        const container = document.getElementById('playlists-grid');
        if (!container) return;

        if (this.playlists.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎵</div>
                    <h3>No Playlists Yet</h3>
                    <p>Create your first playlist to organize your media</p>
                    <button class="btn btn-primary" onclick="window.playlistManager?.showCreatePlaylistDialog()">
                        Create Playlist
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.playlists
            .map(playlist => this.renderPlaylistCard(playlist))
            .join('');

        // Attach event listeners
        this.attachPlaylistCardListeners();
    }

    private renderPlaylistCard(playlist: Playlist): string {
        const updatedDate = new Date(playlist.updated_at).toLocaleDateString();
        return `
            <div class="playlist-card" data-playlist-id="${playlist.id}">
                <div class="playlist-card-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 18V5l12-2v13M9 18l-4 1V6l4-1M9 18l12-2M9 9l12-2"/>
                    </svg>
                </div>
                <div class="playlist-card-info">
                    <h3 class="playlist-card-title">${escapeHtml(playlist.name)}</h3>
                    ${playlist.description ? `<p class="playlist-card-description">${escapeHtml(playlist.description)}</p>` : ''}
                    <div class="playlist-card-meta">
                        <span>${playlist.item_count} item${playlist.item_count !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span>Updated ${updatedDate}</span>
                    </div>
                </div>
                <div class="playlist-card-actions">
                    <button class="btn-icon playlist-play-btn" title="Play all" data-playlist-id="${playlist.id}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </button>
                    <button class="btn-icon playlist-edit-btn" title="Edit" data-playlist-id="${playlist.id}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn-icon playlist-delete-btn" title="Delete" data-playlist-id="${playlist.id}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    private attachPlaylistCardListeners() {
        // Click on card to view details
        document.querySelectorAll('.playlist-card').forEach(card => {
            const cardEl = card as HTMLElement;
            const playlistId = cardEl.dataset.playlistId;
            if (!playlistId) return;

            cardEl.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                // Don't trigger if clicking on buttons
                if (target.closest('.playlist-card-actions')) return;
                this.viewPlaylist(playlistId);
            });
        });

        // Play buttons
        document.querySelectorAll('.playlist-play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const playlistId = (btn as HTMLElement).dataset.playlistId;
                if (playlistId) this.playPlaylist(playlistId);
            });
        });

        // Edit buttons
        document.querySelectorAll('.playlist-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const playlistId = (btn as HTMLElement).dataset.playlistId;
                if (playlistId) this.editPlaylist(playlistId);
            });
        });

        // Delete buttons
        document.querySelectorAll('.playlist-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const playlistId = (btn as HTMLElement).dataset.playlistId;
                if (playlistId) this.deletePlaylist(playlistId);
            });
        });
    }

    async showCreatePlaylistDialog() {
        const name = await Modal.prompt(
            'Enter a name for your new playlist',
            'Create Playlist',
            'My Playlist'
        );

        if (!name) return;

        try {
            const playlistId = await invoke<string>('create_playlist', { name, description: undefined });
            Toast.success('Playlist created successfully');
            await this.loadPlaylists();
            this.viewPlaylist(playlistId);
        } catch (err) {
            console.error('Failed to create playlist:', err);
            Toast.error(`Failed to create playlist: ${err}`);
        }
    }

    async viewPlaylist(playlistId: string) {
        try {
            const playlist = await invoke<Playlist | null>('get_playlist', { playlist_id: playlistId });
            if (!playlist) {
                Toast.error('Playlist not found');
                return;
            }

            this.currentPlaylist = playlist;
            this.currentPlaylistItems = await invoke<MediaItem[]>('get_playlist_items', { playlist_id: playlistId });
            
            this.showPlaylistDetail();
        } catch (err) {
            console.error('Failed to load playlist:', err);
            Toast.error(`Failed to load playlist: ${err}`);
        }
    }

    private showPlaylistsList() {
        const listView = document.getElementById('playlists-list-view');
        const detailView = document.getElementById('playlist-detail-view');
        
        if (listView) listView.style.display = 'block';
        if (detailView) detailView.style.display = 'none';
        
        this.currentPlaylist = null;
        this.currentPlaylistItems = [];
    }

    private showPlaylistDetail() {
        const listView = document.getElementById('playlists-list-view');
        const detailView = document.getElementById('playlist-detail-view');
        
        if (listView) listView.style.display = 'none';
        if (detailView) detailView.style.display = 'block';
        
        this.renderPlaylistDetail();
    }

    private renderPlaylistDetail() {
        if (!this.currentPlaylist) return;

        const titleEl = document.getElementById('playlist-detail-title');
        const descEl = document.getElementById('playlist-detail-description');
        const countEl = document.getElementById('playlist-detail-count');
        const itemsEl = document.getElementById('playlist-detail-items');

        if (titleEl) titleEl.textContent = this.currentPlaylist.name;
        if (descEl) {
            descEl.textContent = this.currentPlaylist.description || '';
            descEl.style.display = this.currentPlaylist.description ? 'block' : 'none';
        }
        if (countEl) {
            countEl.textContent = `${this.currentPlaylist.item_count} item${this.currentPlaylist.item_count !== 1 ? 's' : ''}`;
        }

        if (itemsEl) {
            if (this.currentPlaylistItems.length === 0) {
                itemsEl.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📝</div>
                        <h3>No Items Yet</h3>
                        <p>Add media items to this playlist from your library</p>
                    </div>
                `;
            } else {
                itemsEl.innerHTML = this.currentPlaylistItems
                    .map((item, index) => this.renderPlaylistItem(item, index))
                    .join('');
                
                // Initialize lazy loading for playlist item images
                setupLazyLoading('.playlist-item-poster[data-src]');
                
                this.attachPlaylistItemListeners();
            }
        }
    }

    private renderPlaylistItem(item: MediaItem, index: number): string {
        const posterUrl = item.poster_url || 'https://via.placeholder.com/92x138?text=No+Image';
        const year = item.year ? ` (${item.year})` : '';
        
        return `
            <div class="playlist-item" 
                 data-media-id="${item.id}" 
                 data-position="${index}"
                 draggable="true">
                <div class="playlist-item-drag-handle">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="9" cy="5" r="1.5"/>
                        <circle cx="9" cy="12" r="1.5"/>
                        <circle cx="9" cy="19" r="1.5"/>
                        <circle cx="15" cy="5" r="1.5"/>
                        <circle cx="15" cy="12" r="1.5"/>
                        <circle cx="15" cy="19" r="1.5"/>
                    </svg>
                </div>
                <div class="playlist-item-number">${index + 1}</div>
                <img 
                  data-src="${posterUrl}"
                  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 90'%3E%3Crect fill='%232a2a2a' width='60' height='90'/%3E%3C/svg%3E"
                  alt="${escapeHtml(item.title)}"
                  class="playlist-item-poster lazy-img"
                >
                <div class="playlist-item-info">
                    <div class="playlist-item-title">${escapeHtml(item.title)}${year}</div>
                    <div class="playlist-item-meta">
                        ${item.genre.slice(0, 3).join(', ')}
                    </div>
                </div>
                <div class="playlist-item-actions">
                    <button class="btn-icon playlist-item-play-btn" title="Play" data-media-id="${item.id}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </button>
                    <button class="btn-icon playlist-item-remove-btn" title="Remove" data-media-id="${item.id}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    private attachPlaylistItemListeners() {
        // Drag and drop handlers
        const items = document.querySelectorAll('.playlist-item');
        items.forEach(item => {
            const itemEl = item as HTMLElement;
            
            itemEl.addEventListener('dragstart', (e) => this.handleDragStart(e as DragEvent));
            itemEl.addEventListener('dragover', (e) => this.handleDragOver(e as DragEvent));
            itemEl.addEventListener('drop', (e) => this.handleDrop(e as DragEvent));
            itemEl.addEventListener('dragend', (e) => this.handleDragEnd(e as DragEvent));
        });

        // Play buttons
        document.querySelectorAll('.playlist-item-play-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mediaId = (btn as HTMLElement).dataset.mediaId;
                if (mediaId) this.playMedia(mediaId);
            });
        });

        // Remove buttons
        document.querySelectorAll('.playlist-item-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mediaId = (btn as HTMLElement).dataset.mediaId;
                if (mediaId && this.currentPlaylist) {
                    this.removeFromPlaylist(this.currentPlaylist.id, mediaId);
                }
            });
        });
    }

    private handleDragStart(e: DragEvent) {
        const target = e.target as HTMLElement;
        this.draggedElement = target;
        
        target.classList.add('dragging');
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', target.innerHTML);
        }
    }

    private handleDragOver(e: DragEvent) {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const itemEl = target.closest('.playlist-item') as HTMLElement;
        
        if (itemEl && itemEl !== this.draggedElement) {
            const rect = itemEl.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            if (e.clientY < midpoint) {
                itemEl.classList.add('drag-over-top');
                itemEl.classList.remove('drag-over-bottom');
            } else {
                itemEl.classList.add('drag-over-bottom');
                itemEl.classList.remove('drag-over-top');
            }
        }
        
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
    }

    private async handleDrop(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        
        const target = e.target as HTMLElement;
        const dropTarget = target.closest('.playlist-item') as HTMLElement;
        
        if (!dropTarget || !this.draggedElement || dropTarget === this.draggedElement) {
            this.clearDragStyles();
            return;
        }

        const container = dropTarget.parentElement;
        if (!container) return;

        // Calculate new order
        const allItems = Array.from(container.querySelectorAll('.playlist-item'));
        const draggedIndex = allItems.indexOf(this.draggedElement);
        const dropIndex = allItems.indexOf(dropTarget);

        if (draggedIndex === dropIndex) {
            this.clearDragStyles();
            return;
        }

        // Determine if inserting before or after
        const rect = dropTarget.getBoundingClientRect();
        const insertBefore = e.clientY < rect.top + rect.height / 2;

        // Reorder in DOM
        if (insertBefore) {
            container.insertBefore(this.draggedElement, dropTarget);
        } else {
            container.insertBefore(this.draggedElement, dropTarget.nextSibling);
        }

        // Get new order
        const newOrder = Array.from(container.querySelectorAll('.playlist-item'))
            .map(item => (item as HTMLElement).dataset.mediaId)
            .filter((id): id is string => id !== undefined);

        // Save to backend
        await this.savePlaylistOrder(newOrder);
        
        this.clearDragStyles();
    }

    private handleDragEnd(e: DragEvent) {
        const target = e.target as HTMLElement;
        target.classList.remove('dragging');
        this.clearDragStyles();
    }

    private clearDragStyles() {
        document.querySelectorAll('.playlist-item').forEach(item => {
            item.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging');
        });
    }

    private async savePlaylistOrder(mediaIds: string[]) {
        if (!this.currentPlaylist) return;

        try {
            await invoke('reorder_playlist', {
                playlist_id: this.currentPlaylist.id,
                media_ids: mediaIds
            });
            Toast.success('Playlist order updated');
        } catch (err) {
            console.error('Failed to reorder playlist:', err);
            Toast.error(`Failed to save order: ${err}`);
            // Reload to restore correct order
            await this.viewPlaylist(this.currentPlaylist.id);
        }
    }

    async addToPlaylist(playlistId: string, mediaId: string) {
        try {
            await invoke('add_to_playlist', { playlist_id: playlistId, media_id: mediaId });
            Toast.success('Added to playlist');
            
            // Refresh if viewing this playlist
            if (this.currentPlaylist?.id === playlistId) {
                await this.viewPlaylist(playlistId);
            }
            await this.loadPlaylists();
        } catch (err) {
            console.error('Failed to add to playlist:', err);
            Toast.error(`Failed to add to playlist: ${err}`);
        }
    }

    async removeFromPlaylist(playlistId: string, mediaId: string) {
        const confirmed = await Modal.confirm(
            'Are you sure you want to remove this item from the playlist?',
            'Remove Item'
        );

        if (!confirmed) return;

        try {
            await invoke('remove_from_playlist', { playlist_id: playlistId, media_id: mediaId });
            Toast.success('Removed from playlist');
            
            if (this.currentPlaylist?.id === playlistId) {
                await this.viewPlaylist(playlistId);
            }
            await this.loadPlaylists();
        } catch (err) {
            console.error('Failed to remove from playlist:', err);
            Toast.error(`Failed to remove: ${err}`);
        }
    }

    async editPlaylist(playlistId: string) {
        const playlist = this.playlists.find(p => p.id === playlistId);
        if (!playlist) return;

        const name = await Modal.prompt(
            'Enter new name for the playlist',
            'Edit Playlist',
            playlist.name,
            playlist.name
        );

        if (!name || name === playlist.name) return;

        try {
            await invoke('update_playlist', {
                playlist_id: playlistId,
                name,
                description: playlist.description || undefined
            });
            Toast.success('Playlist updated');
            await this.loadPlaylists();
            
            if (this.currentPlaylist?.id === playlistId) {
                await this.viewPlaylist(playlistId);
            }
        } catch (err) {
            console.error('Failed to update playlist:', err);
            Toast.error(`Failed to update playlist: ${err}`);
        }
    }

    async deletePlaylist(playlistId: string) {
        const confirmed = await Modal.confirm(
            'Are you sure you want to delete this playlist? This action cannot be undone.',
            'Delete Playlist'
        );

        if (!confirmed) return;

        try {
            await invoke('delete_playlist', { playlist_id: playlistId });
            Toast.success('Playlist deleted');
            
            if (this.currentPlaylist?.id === playlistId) {
                this.showPlaylistsList();
            }
            await this.loadPlaylists();
        } catch (err) {
            console.error('Failed to delete playlist:', err);
            Toast.error(`Failed to delete playlist: ${err}`);
        }
    }

    private async playMedia(mediaId: string) {
        if (!this.currentPlaylist || !this.currentPlaylistItems.length) {
            // Not in playlist context, play normally
            const app = (window as any).app;
            if (app && typeof app.showMediaDetail === 'function' && typeof app.playMedia === 'function') {
                app.showMediaDetail(mediaId);
                app.playMedia(mediaId);
            }
            return;
        }

        // Find the index of the item in the current playlist
        const index = this.currentPlaylistItems.findIndex(item => item.id === mediaId);
        if (index === -1) {
            console.error('Media item not found in playlist');
            return;
        }

        // Play with playlist context
        const app = (window as any).app;
        if (app && typeof app.playMediaFromPlaylist === 'function') {
            await app.playMediaFromPlaylist(this.currentPlaylistItems, index);
        } else if (app && typeof app.showMediaDetail === 'function' && typeof app.playMedia === 'function') {
            // Fallback
            app.showMediaDetail(mediaId);
            app.playMedia(mediaId);
        }
    }

    private async playPlaylist(playlistId: string) {
        try {
            const items = await invoke<MediaItem[]>('get_playlist_items', { playlist_id: playlistId });
            if (items.length === 0) {
                Toast.warning('This playlist is empty');
                return;
            }

            const app = (window as any).app;
            if (app && typeof app.playMediaFromPlaylist === 'function') {
                // Play first item with full playlist context
                await app.playMediaFromPlaylist(items, 0);
            } else if (app && typeof app.showMediaDetail === 'function' && typeof app.playMedia === 'function') {
                // Fallback to old behavior
                const firstItem = items[0];
                app.showMediaDetail(firstItem.id);
                await app.playMedia(firstItem.id);
            }
        } catch (err) {
            console.error('Failed to play playlist:', err);
            Toast.error(`Failed to play playlist: ${err}`);
        }
    }

}

// Export global instance
declare global {
    interface Window {
        playlistManager?: PlaylistManager;
    }
}
