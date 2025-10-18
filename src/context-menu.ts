// Context Menu Manager for Media Cards
import { invoke } from './utils';
import { Toast, Modal } from './ui-utils';
import type { Playlist } from './types/tauri';

export class ContextMenuManager {
    private menu: HTMLElement | null = null;
    private submenu: HTMLElement | null = null;
    private currentTarget: HTMLElement | null = null;
    private currentMediaId: string | null = null;

    constructor() {
        this.init();
    }

    private init() {
        this.menu = document.getElementById('media-context-menu');
        this.submenu = document.getElementById('playlist-submenu');
        
        if (!this.menu) return;

        // Add listeners to all media cards
        this.attachToCards();

        // Setup menu item listeners
        this.setupMenuListeners();

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.menu?.contains(e.target as Node) && e.target !== this.currentTarget) {
                this.hide();
            }
        });

        // Close menu on scroll
        window.addEventListener('scroll', () => this.hide(), true);
    }

    attachToCards() {
        document.querySelectorAll('[data-context-menu="true"]').forEach(card => {
            // Right-click
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.show(card as HTMLElement, e as MouseEvent);
            });

            // Long press for touch devices
            let pressTimer: number;
            card.addEventListener('touchstart', (e) => {
                pressTimer = window.setTimeout(() => {
                    const touch = (e as TouchEvent).touches[0];
                    this.show(card as HTMLElement, {
                        clientX: touch.clientX,
                        clientY: touch.clientY
                    } as MouseEvent);
                }, 500);
            });

            card.addEventListener('touchend', () => {
                clearTimeout(pressTimer);
            });

            card.addEventListener('touchmove', () => {
                clearTimeout(pressTimer);
            });
        });
    }

    private async show(target: HTMLElement, event: MouseEvent) {
        if (!this.menu) return;

        this.currentTarget = target;
        this.currentMediaId = target.dataset.mediaId || null;

        if (!this.currentMediaId) {
            console.error('No media ID found');
            return;
        }

        // Position the menu
        this.menu.style.display = 'block';
        this.menu.style.left = `${event.clientX}px`;
        this.menu.style.top = `${event.clientY}px`;

        // Ensure menu stays in viewport
        const menuRect = this.menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (menuRect.right > viewportWidth) {
            this.menu.style.left = `${viewportWidth - menuRect.width - 10}px`;
        }

        if (menuRect.bottom > viewportHeight) {
            this.menu.style.top = `${viewportHeight - menuRect.height - 10}px`;
        }

        // Hide submenu initially
        if (this.submenu) {
            this.submenu.style.display = 'none';
        }
    }

    hide() {
        if (this.menu) {
            this.menu.style.display = 'none';
        }
        if (this.submenu) {
            this.submenu.style.display = 'none';
        }
        this.currentTarget = null;
        this.currentMediaId = null;
    }

    private setupMenuListeners() {
        // Add to Library
        document.getElementById('context-add-to-library')?.addEventListener('click', async () => {
            await this.addToLibrary();
            this.hide();
        });

        // Add to Watchlist
        document.getElementById('context-add-to-watchlist')?.addEventListener('click', async () => {
            await this.addToWatchlist();
            this.hide();
        });

        // Add to Playlist (show submenu)
        document.getElementById('context-add-to-playlist')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.showPlaylistSubmenu();
        });

        // Create New Playlist
        document.getElementById('context-create-new-playlist')?.addEventListener('click', async () => {
            await this.createNewPlaylist();
            this.hide();
        });
    }

    private async addToLibrary() {
        if (!this.currentMediaId) return;

        try {
            const app = (window as any).app;
            const media = app?.mediaMap?.[this.currentMediaId];
            
            if (!media) {
                Toast.error('Media item not found');
                return;
            }

            await invoke('add_to_library', { item: media });
            Toast.success('Added to library');
        } catch (err) {
            console.error('Failed to add to library:', err);
            Toast.error(`Failed to add: ${err}`);
        }
    }

    private async addToWatchlist() {
        if (!this.currentMediaId) return;

        try {
            await invoke('add_to_watchlist', { mediaId: this.currentMediaId });
            Toast.success('Added to watchlist');
        } catch (err) {
            console.error('Failed to add to watchlist:', err);
            Toast.error(`Failed to add: ${err}`);
        }
    }

    private async showPlaylistSubmenu() {
        if (!this.submenu || !this.menu) return;

        try {
            // Load playlists
            const playlists = await invoke<Playlist[]>('get_playlists');

            const itemsContainer = document.getElementById('playlist-submenu-items');
            if (!itemsContainer) return;

            if (playlists.length === 0) {
                itemsContainer.innerHTML = '<div class=\"context-menu-item\" style=\"opacity: 0.5;\">No playlists</div>';
            } else {
                itemsContainer.innerHTML = playlists.map(playlist => `
                    <div class=\"context-menu-item playlist-item\" data-playlist-id="${playlist.id}">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"currentColor\">
                            <path d=\"M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2z\"/>
                        </svg>
                        <span>${playlist.name}</span>
                    </div>
                `).join('');

                // Attach listeners
                itemsContainer.querySelectorAll('.playlist-item').forEach(item => {
                    item.addEventListener('click', async () => {
                        const playlistId = (item as HTMLElement).dataset.playlistId;
                        if (playlistId) {
                            await this.addToPlaylist(playlistId);
                            this.hide();
                        }
                    });
                });
            }

            // Position submenu
            const menuRect = this.menu.getBoundingClientRect();
            this.submenu.style.display = 'block';
            this.submenu.style.left = `${menuRect.right}px`;
            this.submenu.style.top = `${menuRect.top}px`;

            // Adjust if off-screen
            const submenuRect = this.submenu.getBoundingClientRect();
            if (submenuRect.right > window.innerWidth) {
                this.submenu.style.left = `${menuRect.left - submenuRect.width}px`;
            }
            if (submenuRect.bottom > window.innerHeight) {
                this.submenu.style.top = `${window.innerHeight - submenuRect.height - 10}px`;
            }
        } catch (err) {
            console.error('Failed to load playlists:', err);
            Toast.error('Failed to load playlists');
        }
    }

    private async addToPlaylist(playlistId: string) {
        if (!this.currentMediaId) return;

        try {
            await invoke('add_to_playlist', {
                playlistId: playlistId,
                mediaId: this.currentMediaId
            });
            Toast.success('Added to playlist');
        } catch (err) {
            console.error('Failed to add to playlist:', err);
            Toast.error(`Failed to add: ${err}`);
        }
    }

    private async createNewPlaylist() {
        const name = await Modal.prompt(
            'Enter a name for your new playlist',
            'Create Playlist',
            'My Playlist'
        );

        if (!name) return;

        try {
            const playlistId = await invoke<string>('create_playlist', { name, description: undefined });
            Toast.success('Playlist created');

            // Add current item to it
            if (this.currentMediaId) {
                await this.addToPlaylist(playlistId);
            }
        } catch (err) {
            console.error('Failed to create playlist:', err);
            Toast.error(`Failed to create: ${err}`);
        }
    }
}

// Export global instance
declare global {
    interface Window {
        contextMenuManager?: ContextMenuManager;
    }
}
