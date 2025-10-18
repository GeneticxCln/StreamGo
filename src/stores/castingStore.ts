/**
 * Casting Store
 * 
 * Manages casting devices, sessions, and state
 */
import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { CastDevice, CastSession } from '../types/tauri';

interface CastingState {
  devices: CastDevice[];
  activeSession: CastSession | null;
  isDiscovering: boolean;
  showDevicePicker: boolean;
  error: string | null;
}

const initialState: CastingState = {
  devices: [],
  activeSession: null,
  isDiscovering: false,
  showDevicePicker: false,
  error: null,
};

// Main casting store
function createCastingStore() {
  const { subscribe, set, update } = writable<CastingState>(initialState);

  return {
    subscribe,
    
    // Discover devices on the network
    async discoverDevices(timeoutSecs: number = 5): Promise<void> {
      update(state => ({ ...state, isDiscovering: true, error: null }));
      
      try {
        const devices = await invoke<CastDevice[]>('discover_cast_devices', { timeoutSecs });
        update(state => ({ 
          ...state, 
          devices, 
          isDiscovering: false,
          error: devices.length === 0 ? 'No devices found on network' : null,
        }));
      } catch (error) {
        console.error('Failed to discover cast devices:', error);
        update(state => ({ 
          ...state, 
          isDiscovering: false,
          error: `Discovery failed: ${error}`,
        }));
      }
    },

    // Get previously discovered devices
    async getDevices(): Promise<void> {
      try {
        const devices = await invoke<CastDevice[]>('get_cast_devices');
        update(state => ({ ...state, devices }));
      } catch (error) {
        console.error('Failed to get cast devices:', error);
      }
    },

    // Start casting to a device
    async startCasting(
      deviceId: string,
      mediaUrl: string,
      title?: string,
      subtitleUrl?: string,
    ): Promise<void> {
      update(state => ({ ...state, error: null }));

      try {
        const session = await invoke<CastSession>('start_casting', {
          deviceId,
          mediaUrl,
          title,
          subtitleUrl,
        });

        update(state => ({ 
          ...state, 
          activeSession: session,
          showDevicePicker: false,
        }));

        console.log('Cast session started:', session);
      } catch (error) {
        console.error('Failed to start casting:', error);
        update(state => ({ 
          ...state, 
          error: `Failed to start casting: ${error}`,
        }));
        throw error;
      }
    },

    // Stop current cast session
    async stopCasting(): Promise<void> {
      const state = get({ subscribe });
      if (!state.activeSession) return;

      try {
        await invoke('stop_casting', {
          sessionId: state.activeSession.session_id,
        });

        update(state => ({ ...state, activeSession: null }));
        console.log('Cast session stopped');
      } catch (error) {
        console.error('Failed to stop casting:', error);
        update(state => ({ 
          ...state, 
          error: `Failed to stop casting: ${error}`,
        }));
      }
    },

    // Get active sessions
    async getSessions(): Promise<void> {
      try {
        const sessions = await invoke<CastSession[]>('get_cast_sessions');
        if (sessions.length > 0) {
          update(state => ({ ...state, activeSession: sessions[0] }));
        }
      } catch (error) {
        console.error('Failed to get cast sessions:', error);
      }
    },

    // Show/hide device picker
    toggleDevicePicker(): void {
      update(state => ({ ...state, showDevicePicker: !state.showDevicePicker }));
    },

    openDevicePicker(): void {
      update(state => ({ ...state, showDevicePicker: true }));
    },

    closeDevicePicker(): void {
      update(state => ({ ...state, showDevicePicker: false }));
    },

    // Clear error
    clearError(): void {
      update(state => ({ ...state, error: null }));
    },

    // Reset store
    reset(): void {
      set(initialState);
    },
  };
}

export const castingStore = createCastingStore();

// Derived stores for convenience
export const hasActiveSession = derived(
  castingStore,
  $casting => $casting.activeSession !== null
);

export const isCasting = derived(
  castingStore,
  $casting => $casting.activeSession?.state === 'PLAYING' || $casting.activeSession?.state === 'BUFFERING'
);

export const currentDevice = derived(
  castingStore,
  $casting => {
    if (!$casting.activeSession) return null;
    return $casting.devices.find(d => d.id === $casting.activeSession?.device_id) || null;
  }
);

export const dlnaDevices = derived(
  castingStore,
  $casting => $casting.devices.filter(d => d.protocol === 'dlna')
);

export const chromecastDevices = derived(
  castingStore,
  $casting => $casting.devices.filter(d => d.protocol === 'chromecast')
);

// Auto-refresh devices periodically when device picker is open
export function startDeviceRefresh() {
  const interval = setInterval(() => {
    const state = get(castingStore);
    if (state.showDevicePicker && !state.isDiscovering) {
      castingStore.discoverDevices(3);
    }
  }, 10000); // Refresh every 10 seconds

  return () => clearInterval(interval);
}
