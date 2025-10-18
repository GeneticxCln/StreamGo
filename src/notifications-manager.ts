import { invoke } from '@tauri-apps/api/core';
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';

export interface Notification {
  id: string;
  type: 'new_episode' | 'addon_update' | 'system' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
  metadata?: {
    showId?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    addonId?: string;
  };
}

export interface NotificationPreferences {
  enabled: boolean;
  newEpisodesEnabled: boolean;
  addonUpdatesEnabled: boolean;
  systemNotificationsEnabled: boolean;
  soundEnabled: boolean;
  checkFrequencyMinutes: number;
  perShowPreferences: Record<string, boolean>;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  newEpisodesEnabled: true,
  addonUpdatesEnabled: true,
  systemNotificationsEnabled: true,
  soundEnabled: true,
  checkFrequencyMinutes: 60,
  perShowPreferences: {},
};

class NotificationsManager {
  private notifications: Notification[] = [];
  private preferences: NotificationPreferences = DEFAULT_PREFERENCES;
  private listeners: Set<() => void> = new Set();
  private checkInterval: number | null = null;

  constructor() {
    this.loadFromStorage();
    this.requestPermissions();
  }

  async requestPermissions(): Promise<boolean> {
    try {
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }
      return permissionGranted;
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return false;
    }
  }

  async init(): Promise<void> {
    // Start checking for new episodes
    this.startPeriodicCheck();
  }

  private startPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    if (!this.preferences.enabled || !this.preferences.newEpisodesEnabled) {
      return;
    }

    const intervalMs = this.preferences.checkFrequencyMinutes * 60 * 1000;
    this.checkInterval = window.setInterval(() => {
      this.checkForNewEpisodes();
    }, intervalMs);

    // Check immediately on startup
    this.checkForNewEpisodes();
  }

  async checkForNewEpisodes(): Promise<void> {
    try {
      const newEpisodes = await invoke<Array<{
        show_id: string;
        show_name: string;
        season_number: number;
        episode_number: number;
        episode_name: string;
        air_date: string;
      }>>('check_new_episodes');

      for (const episode of newEpisodes) {
        // Check per-show preferences
        if (this.preferences.perShowPreferences[episode.show_id] === false) {
          continue;
        }

        const notification: Notification = {
          id: `episode_${episode.show_id}_${episode.season_number}_${episode.episode_number}`,
          type: 'new_episode',
          title: 'New Episode Available',
          message: `${episode.show_name} - S${episode.season_number}E${episode.episode_number}: ${episode.episode_name}`,
          timestamp: Date.now(),
          read: false,
          actionUrl: `/media/${episode.show_id}`,
          metadata: {
            showId: episode.show_id,
            seasonNumber: episode.season_number,
            episodeNumber: episode.episode_number,
          },
        };

        this.addNotification(notification);
        await this.sendDesktopNotification(notification);
      }
    } catch (error) {
      console.error('Failed to check for new episodes:', error);
    }
  }

  async sendDesktopNotification(notification: Notification): Promise<void> {
    if (!this.preferences.enabled || !this.preferences.systemNotificationsEnabled) {
      return;
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      return;
    }

    try {
      await sendNotification({
        title: notification.title,
        body: notification.message,
      });
    } catch (error) {
      console.error('Failed to send desktop notification:', error);
    }
  }

  addNotification(notification: Notification): void {
    // Check if notification already exists
    const exists = this.notifications.some(n => n.id === notification.id);
    if (exists) {
      return;
    }

    this.notifications.unshift(notification);
    this.saveToStorage();
    this.notifyListeners();
  }

  getNotifications(): Notification[] {
    return [...this.notifications];
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  markAsRead(id: string): void {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  markAllAsRead(): void {
    this.notifications.forEach(n => (n.read = true));
    this.saveToStorage();
    this.notifyListeners();
  }

  clearNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.saveToStorage();
    this.notifyListeners();
  }

  clearAllNotifications(): void {
    this.notifications = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  clearReadNotifications(): void {
    this.notifications = this.notifications.filter(n => !n.read);
    this.saveToStorage();
    this.notifyListeners();
  }

  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  updatePreferences(preferences: Partial<NotificationPreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
    this.saveToStorage();
    this.startPeriodicCheck(); // Restart check interval with new settings
    this.notifyListeners();
  }

  setShowNotifications(showId: string, enabled: boolean): void {
    this.preferences.perShowPreferences[showId] = enabled;
    this.saveToStorage();
    this.notifyListeners();
  }

  isShowNotificationsEnabled(showId: string): boolean {
    return this.preferences.perShowPreferences[showId] !== false;
  }

  onChange(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  private loadFromStorage(): void {
    try {
      const notificationsJson = localStorage.getItem('notifications');
      if (notificationsJson) {
        this.notifications = JSON.parse(notificationsJson);
      }

      const preferencesJson = localStorage.getItem('notification_preferences');
      if (preferencesJson) {
        this.preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(preferencesJson) };
      }
    } catch (error) {
      console.error('Failed to load notifications from storage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('notifications', JSON.stringify(this.notifications));
      localStorage.setItem('notification_preferences', JSON.stringify(this.preferences));
    } catch (error) {
      console.error('Failed to save notifications to storage:', error);
    }
  }

  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const notificationsManager = new NotificationsManager();

// Initialize on module load
notificationsManager.init();
