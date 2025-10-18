import { Page } from '@playwright/test';

/**
 * Dismiss the onboarding modal if it's visible
 * IMPORTANT: Call this BEFORE page.goto() for best results
 */
export async function dismissOnboardingModal(page: Page): Promise<void> {
  // Set localStorage flag before page navigation to prevent modal from showing
  await page.addInitScript(() => {
    localStorage.setItem('onboarding_complete', 'true');
  });
}

/**
 * Clear all visible toasts
 */
export async function clearToasts(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      const toasts = document.querySelectorAll('.toast');
      toasts.forEach(toast => toast.remove());
    });
    await page.waitForTimeout(100);
  } catch (error) {
    // Silently fail
  }
}

/**
 * Setup common mocks for Tauri API
 */
export async function setupTauriMocks(page: Page, customMocks?: Record<string, any>): Promise<void> {
  await page.addInitScript((mocks) => {
    const mockInvoke = async (cmd: string, args?: any) => {
      // Check custom mocks first
      if (mocks && cmd in mocks) {
        return typeof mocks[cmd] === 'function' ? mocks[cmd](args) : mocks[cmd];
      }
      
      // Default mocks
      switch (cmd) {
        case 'get_settings':
          return {
            version: 1,
            theme: 'dark',
            language: 'en',
          };
        case 'get_addons':
          return [];
        case 'get_addon_health_summaries':
          return [];
        default:
          console.log(`Unhandled mock command: ${cmd}`);
          return null;
      }
    };

    (window as any).__TAURI_INVOKE__ = mockInvoke;
    (window as any).__TAURI__ = {
      invoke: mockInvoke,
      core: {
        invoke: mockInvoke
      }
    };
  }, customMocks);
}

/**
 * Setup window.app mock for player tests
 */
export async function setupAppMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Override playVideo before app loads
    Object.defineProperty(window, 'app', {
      value: {
        playVideo: (url: string, title: string) => {
          console.log(`Mock playVideo called: ${url}, ${title}`);
          const playerContainer = document.getElementById('video-player-container');
          const playerTitle = document.getElementById('player-title');
          const videoPlayer = document.getElementById('video-player') as HTMLVideoElement;
          
          if (playerContainer) {
            playerContainer.style.display = 'flex';
            playerContainer.style.visibility = 'visible';
          }
          if (playerTitle) {
            playerTitle.textContent = `Now Playing: ${title}`;
          }
          if (videoPlayer) {
            videoPlayer.src = url;
          }
        },
        updateWatchProgress: () => {
          console.log('Mock updateWatchProgress called');
        }
      },
      writable: true,
      configurable: true
    });
  });
}
