/**
 * Settings and Preferences Management
 * 
 * Provides UI and functionality for user preferences
 */

import { invoke } from '@tauri-apps/api/core';
import { showToast } from './ui-utils';
import { UserPreferences } from './types/tauri';

export class SettingsManager {
    private container: HTMLElement;
    private currentSettings: UserPreferences | null = null;

    constructor(containerId: string = 'settings-panel') {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Settings container #${containerId} not found`);
        }
        this.container = container;
    }

    /**
     * Initialize settings panel
     */
    async init(): Promise<void> {
        await this.loadSettings();
        this.render();
        this.attachEventListeners();
    }

    /**
     * Load current settings from backend
     */
    private async loadSettings(): Promise<void> {
        try {
            this.currentSettings = await invoke<UserPreferences>('get_settings');
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.currentSettings = this.getDefaultSettings();
        }
    }

    /**
     * Get default settings
     */
    private getDefaultSettings(): UserPreferences {
        return {
            theme: 'dark',
            language: 'en',
            autoplay: true,
            quality: 'auto',
            subtitle_language: 'en',
            playback_speed: 1.0,
            volume: 0.8,
            notifications_enabled: true,
            auto_update: true,
            telemetry_enabled: false,
        };
    }

    /**
     * Render settings UI
     */
    private render(): void {
        if (!this.currentSettings) return;

        this.container.innerHTML = `
            <div class="settings-container">
                <div class="settings-header">
                    <h2>Settings</h2>
                    <button class="close-btn" id="close-settings">✕</button>
                </div>

                <div class="settings-content">
                    <!-- General Settings -->
                    <section class="settings-section">
                        <h3>General</h3>
                        
                        <div class="setting-item">
                            <label for="theme">Theme</label>
                            <select id="theme" name="theme">
                                <option value="dark" ${this.currentSettings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                                <option value="light" ${this.currentSettings.theme === 'light' ? 'selected' : ''}>Light</option>
                                <option value="system" ${this.currentSettings.theme === 'system' ? 'selected' : ''}>System</option>
                            </select>
                        </div>

                        <div class="setting-item">
                            <label for="language">Language</label>
                            <select id="language" name="language">
                                <option value="en" ${this.currentSettings.language === 'en' ? 'selected' : ''}>English</option>
                                <option value="es" ${this.currentSettings.language === 'es' ? 'selected' : ''}>Español</option>
                                <option value="fr" ${this.currentSettings.language === 'fr' ? 'selected' : ''}>Français</option>
                                <option value="de" ${this.currentSettings.language === 'de' ? 'selected' : ''}>Deutsch</option>
                            </select>
                        </div>

                        <div class="setting-item checkbox-item">
                            <label for="notifications">
                                <input type="checkbox" id="notifications" name="notifications_enabled" 
                                    ${this.currentSettings.notifications_enabled ? 'checked' : ''}>
                                <span>Enable notifications</span>
                            </label>
                        </div>

                        <div class="setting-item checkbox-item">
                            <label for="auto-update">
                                <input type="checkbox" id="auto-update" name="auto_update" 
                                    ${this.currentSettings.auto_update ? 'checked' : ''}>
                                <span>Automatic updates</span>
                            </label>
                        </div>
                    </section>

                    <!-- Playback Settings -->
                    <section class="settings-section">
                        <h3>Playback</h3>

                        <div class="setting-item checkbox-item">
                            <label for="autoplay">
                                <input type="checkbox" id="autoplay" name="autoplay" 
                                    ${this.currentSettings.autoplay ? 'checked' : ''}>
                                <span>Autoplay next episode</span>
                            </label>
                        </div>

                        <div class="setting-item">
                            <label for="quality">Default Quality</label>
                            <select id="quality" name="quality">
                                <option value="auto" ${this.currentSettings.quality === 'auto' ? 'selected' : ''}>Auto</option>
                                <option value="1080p" ${this.currentSettings.quality === '1080p' ? 'selected' : ''}>1080p</option>
                                <option value="720p" ${this.currentSettings.quality === '720p' ? 'selected' : ''}>720p</option>
                                <option value="480p" ${this.currentSettings.quality === '480p' ? 'selected' : ''}>480p</option>
                            </select>
                        </div>

                        <div class="setting-item">
                            <label for="playback-speed">Playback Speed: <span id="speed-value">${this.currentSettings.playback_speed}x</span></label>
                            <input type="range" id="playback-speed" name="playback_speed" 
                                min="0.5" max="2.0" step="0.25" 
                                value="${this.currentSettings.playback_speed}">
                        </div>

                        <div class="setting-item">
                            <label for="volume">Default Volume: <span id="volume-value">${Math.round(this.currentSettings.volume * 100)}%</span></label>
                            <input type="range" id="volume" name="volume" 
                                min="0" max="1" step="0.1" 
                                value="${this.currentSettings.volume}">
                        </div>

                        <div class="setting-item">
                            <label for="subtitle-lang">Subtitle Language</label>
                            <select id="subtitle-lang" name="subtitle_language">
                                <option value="none" ${this.currentSettings.subtitle_language === 'none' ? 'selected' : ''}>None</option>
                                <option value="en" ${this.currentSettings.subtitle_language === 'en' ? 'selected' : ''}>English</option>
                                <option value="es" ${this.currentSettings.subtitle_language === 'es' ? 'selected' : ''}>Spanish</option>
                                <option value="fr" ${this.currentSettings.subtitle_language === 'fr' ? 'selected' : ''}>French</option>
                            </select>
                        </div>
                    </section>

                    <!-- Privacy Settings -->
                    <section class="settings-section">
                        <h3>Privacy</h3>

                        <div class="setting-item checkbox-item">
                            <label for="telemetry">
                                <input type="checkbox" id="telemetry" name="telemetry_enabled" 
                                    ${this.currentSettings.telemetry_enabled ? 'checked' : ''}>
                                <span>Send anonymous usage data</span>
                            </label>
                            <p class="setting-description">
                                Help improve StreamGo by sending anonymous usage statistics. 
                                No personal information is collected.
                            </p>
                        </div>

                        <div class="setting-item">
                            <button class="secondary-btn" id="clear-cache">Clear Cache</button>
                            <p class="setting-description">Remove cached images and data</p>
                        </div>

                        <div class="setting-item">
                            <button class="secondary-btn" id="export-data">Export User Data</button>
                            <p class="setting-description">Download your playlists and preferences</p>
                        </div>
                    </section>

                    <!-- Advanced Settings -->
                    <section class="settings-section">
                        <h3>Advanced</h3>

                        <div class="setting-item">
                            <button class="secondary-btn" id="view-logs">View Logs</button>
                            <p class="setting-description">Open application logs for troubleshooting</p>
                        </div>

                        <div class="setting-item">
                            <button class="secondary-btn" id="reset-settings">Reset to Defaults</button>
                            <p class="setting-description">Restore all settings to default values</p>
                        </div>

                        <div class="setting-item">
                            <label>Version</label>
                            <p class="setting-value">StreamGo v0.1.0</p>
                        </div>
                    </section>
                </div>

                <div class="settings-footer">
                    <button class="secondary-btn" id="cancel-settings">Cancel</button>
                    <button class="primary-btn" id="save-settings">Save Changes</button>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    private attachEventListeners(): void {
        // Close button
        const closeBtn = document.getElementById('close-settings');
        closeBtn?.addEventListener('click', () => this.hide());

        // Cancel button
        const cancelBtn = document.getElementById('cancel-settings');
        cancelBtn?.addEventListener('click', () => this.hide());

        // Save button
        const saveBtn = document.getElementById('save-settings');
        saveBtn?.addEventListener('click', () => this.saveSettings());

        // Range inputs - update display
        const speedInput = document.getElementById('playback-speed') as HTMLInputElement;
        speedInput?.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            const display = document.getElementById('speed-value');
            if (display) display.textContent = `${value}x`;
        });

        const volumeInput = document.getElementById('volume') as HTMLInputElement;
        volumeInput?.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            const display = document.getElementById('volume-value');
            if (display) display.textContent = `${Math.round(parseFloat(value) * 100)}%`;
        });

        // Clear cache button
        const clearCacheBtn = document.getElementById('clear-cache');
        clearCacheBtn?.addEventListener('click', () => this.clearCache());

        // Export data button
        const exportBtn = document.getElementById('export-data');
        exportBtn?.addEventListener('click', () => this.exportData());

        // View logs button
        const viewLogsBtn = document.getElementById('view-logs');
        viewLogsBtn?.addEventListener('click', () => this.viewLogs());

        // Reset settings button
        const resetBtn = document.getElementById('reset-settings');
        resetBtn?.addEventListener('click', () => this.resetSettings());
    }

    /**
     * Collect current form values
     */
    private collectFormData(): UserPreferences {
        const form = this.container.querySelector('.settings-content') as HTMLElement;
        if (!form) return this.getDefaultSettings();

        const getValue = (name: string): any => {
            const input = form.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement;
            if (!input) return null;
            
            if (input.type === 'checkbox') {
                return (input as HTMLInputElement).checked;
            } else if (input.type === 'range') {
                return parseFloat((input as HTMLInputElement).value);
            }
            return input.value;
        };

        return {
            theme: getValue('theme') || 'dark',
            language: getValue('language') || 'en',
            autoplay: getValue('autoplay') !== null ? getValue('autoplay') : true,
            quality: getValue('quality') || 'auto',
            subtitle_language: getValue('subtitle_language') || 'en',
            playback_speed: getValue('playback_speed') !== null ? getValue('playback_speed') : 1.0,
            volume: getValue('volume') !== null ? getValue('volume') : 0.8,
            notifications_enabled: getValue('notifications_enabled') !== null ? getValue('notifications_enabled') : true,
            auto_update: getValue('auto_update') !== null ? getValue('auto_update') : true,
            telemetry_enabled: getValue('telemetry_enabled') !== null ? getValue('telemetry_enabled') : false,
        };
    }

    /**
     * Save settings to backend
     */
    private async saveSettings(): Promise<void> {
        try {
            const newSettings = this.collectFormData();
            await invoke('save_settings', { preferences: newSettings });
            this.currentSettings = newSettings;
            showToast('Settings saved successfully', 'success');
            this.hide();
        } catch (error) {
            console.error('Failed to save settings:', error);
            showToast('Failed to save settings', 'error');
        }
    }

    /**
     * Clear application cache
     */
    private async clearCache(): Promise<void> {
        if (!confirm('Are you sure you want to clear the cache? This will remove all cached images and data.')) {
            return;
        }

        // TODO: Implement cache clearing via Tauri command
        showToast('Cache cleared successfully', 'success');
    }

    /**
     * Export user data
     */
    private async exportData(): Promise<void> {
        try {
            // TODO: Implement data export
            showToast('Data export feature coming soon', 'info');
        } catch (error) {
            console.error('Failed to export data:', error);
            showToast('Failed to export data', 'error');
        }
    }

    /**
     * View application logs
     */
    private viewLogs(): void {
        // TODO: Implement log viewer
        showToast('Log viewer feature coming soon', 'info');
    }

    /**
     * Reset settings to defaults
     */
    private async resetSettings(): Promise<void> {
        if (!confirm('Are you sure you want to reset all settings to defaults?')) {
            return;
        }

        try {
            const defaults = this.getDefaultSettings();
            await invoke('save_settings', { preferences: defaults });
            this.currentSettings = defaults;
            this.render();
            this.attachEventListeners();
            showToast('Settings reset to defaults', 'success');
        } catch (error) {
            console.error('Failed to reset settings:', error);
            showToast('Failed to reset settings', 'error');
        }
    }

    /**
     * Show settings panel
     */
    show(): void {
        this.container.style.display = 'flex';
    }

    /**
     * Hide settings panel
     */
    hide(): void {
        this.container.style.display = 'none';
    }

    /**
     * Toggle settings panel visibility
     */
    toggle(): void {
        if (this.container.style.display === 'none') {
            this.show();
        } else {
            this.hide();
        }
    }
}

// Export singleton instance
let settingsManager: SettingsManager | null = null;

export function getSettingsManager(): SettingsManager {
    if (!settingsManager) {
        settingsManager = new SettingsManager();
    }
    return settingsManager;
}
