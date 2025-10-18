/**
 * Casting Integration
 * 
 * Mounts and wires casting Svelte components to the video player
 */
import CastButton from './components/CastButton.svelte';
import DevicePicker from './components/DevicePicker.svelte';

interface CastingComponents {
  castButton: CastButton | null;
  devicePicker: DevicePicker | null;
}

let components: CastingComponents = {
  castButton: null,
  devicePicker: null,
};

/**
 * Initialize casting components
 */
export function initializeCasting(): void {
  const castButtonMount = document.getElementById('cast-button-mount');
  const devicePickerMount = document.getElementById('device-picker-mount');

  if (!castButtonMount || !devicePickerMount) {
    console.warn('Casting mount points not found, skipping casting initialization');
    return;
  }

  try {
    // Mount CastButton component
    components.castButton = new CastButton({
      target: castButtonMount,
      props: {
        currentMediaUrl: '',
        currentTitle: '',
        compact: true, // Compact mode for player controls
      },
    });

    // Mount DevicePicker component
    components.devicePicker = new DevicePicker({
      target: devicePickerMount,
      props: {
        mediaUrl: '',
        title: '',
        subtitleUrl: '',
      },
    });

    console.log('✅ Casting components initialized');
  } catch (error) {
    console.error('Failed to initialize casting components:', error);
  }
}

/**
 * Update casting components with current video info
 */
export function updateCastingInfo(mediaUrl: string, title: string, subtitleUrl?: string): void {
  if (!components.castButton || !components.devicePicker) {
    return;
  }

  try {
    // Update CastButton props
    components.castButton.$set({
      currentMediaUrl: mediaUrl,
      currentTitle: title,
    });

    // Update DevicePicker props
    components.devicePicker.$set({
      mediaUrl,
      title,
      subtitleUrl: subtitleUrl || '',
    });
  } catch (error) {
    console.error('Failed to update casting info:', error);
  }
}

/**
 * Cleanup casting components
 */
export function destroyCasting(): void {
  try {
    if (components.castButton) {
      components.castButton.$destroy();
      components.castButton = null;
    }

    if (components.devicePicker) {
      components.devicePicker.$destroy();
      components.devicePicker = null;
    }

    console.log('Casting components destroyed');
  } catch (error) {
    console.error('Failed to destroy casting components:', error);
  }
}

/**
 * Check if casting is initialized
 */
export function isCastingInitialized(): boolean {
  return components.castButton !== null && components.devicePicker !== null;
}
