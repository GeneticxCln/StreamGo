/**
 * External Player Integration
 * 
 * Allows opening video streams in external players like VLC and MPV
 */

import { invoke } from './utils';
import { Modal, Toast } from './ui-utils';

export interface ExternalPlayer {
    VLC?: null;
    MPV?: null;
    IINA?: null;
    Custom?: {
        name: string;
        command: string;
        args: string[];
    };
}

export class ExternalPlayerManager {
    private availablePlayers: ExternalPlayer[] = [];
    private currentStreamUrl: string | null = null;

    /**
     * Initialize external player manager
     */
    async init(): Promise<void> {
        await this.refreshAvailablePlayers();
    }

    /**
     * Refresh list of available external players
     */
    async refreshAvailablePlayers(): Promise<void> {
        try {
            this.availablePlayers = await invoke<ExternalPlayer[]>('get_available_players');
            console.log('Available players:', this.availablePlayers);
        } catch (error) {
            console.error('Error getting available players:', error);
            this.availablePlayers = [];
        }
    }

    /**
     * Get display name for player
     */
    getPlayerName(player: ExternalPlayer): string {
        if ('VLC' in player) return 'VLC Media Player';
        if ('MPV' in player) return 'MPV Player';
        if ('IINA' in player) return 'IINA';
        if ('Custom' in player && player.Custom) return player.Custom.name;
        return 'Unknown Player';
    }

    /**
     * Check if any external players are available
     */
    hasAvailablePlayers(): boolean {
        return this.availablePlayers.length > 0;
    }

    /**
     * Set current stream URL
     */
    setCurrentStream(url: string): void {
        this.currentStreamUrl = url;
    }

    /**
     * Show player selection dialog and launch
     */
    async openInExternalPlayer(): Promise<void> {
        if (!this.currentStreamUrl) {
            Toast.error('No video loaded');
            return;
        }

        if (this.availablePlayers.length === 0) {
            await this.refreshAvailablePlayers();
            
            if (this.availablePlayers.length === 0) {
                Modal.alert(
                    'No external players found. Please install VLC or MPV to use this feature.',
                    'No External Players'
                );
                return;
            }
        }

        // If only one player available, use it directly
        if (this.availablePlayers.length === 1) {
            await this.launchPlayer(this.availablePlayers[0]);
            return;
        }

        // Multiple players - show selection dialog
        await this.showPlayerSelectionDialog();
    }

    /**
     * Show dialog to select which player to use
     */
    private async showPlayerSelectionDialog(): Promise<void> {
        const playerOptions = this.availablePlayers.map((player, index) => ({
            value: index.toString(),
            label: this.getPlayerName(player)
        }));

        const selectedIndex = await Modal.select(
            'Choose an external player to open this video:',
            'Open in External Player',
            playerOptions
        );

        if (selectedIndex !== null) {
            const player = this.availablePlayers[parseInt(selectedIndex)];
            await this.launchPlayer(player);
        }
    }

    /**
     * Launch external player with current stream
     */
    private async launchPlayer(player: ExternalPlayer): Promise<void> {
        if (!this.currentStreamUrl) {
            Toast.error('No video URL available');
            return;
        }

        try {
            Toast.info(`Opening in ${this.getPlayerName(player)}...`);
            await invoke('launch_external_player', {
                player,
                url: this.currentStreamUrl,
                subtitle: null
            });
            Toast.success(`Opened in ${this.getPlayerName(player)}!`);
        } catch (error) {
            console.error('Error launching external player:', error);
            Toast.error(`Failed to launch player: ${error}`);
        }
    }

    /**
     * Show button state based on availability
     */
    updateButtonState(buttonElement: HTMLElement): void {
        if (this.hasAvailablePlayers()) {
            buttonElement.style.display = 'block';
            buttonElement.title = 'Open in External Player (VLC/MPV)';
        } else {
            buttonElement.style.display = 'none';
        }
    }
}

// Export singleton instance
export const externalPlayerManager = new ExternalPlayerManager();
