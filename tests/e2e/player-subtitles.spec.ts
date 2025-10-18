import { test, expect } from '@playwright/test';
import { dismissOnboardingModal } from './helpers';

test.describe('Player Subtitle Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss onboarding modal before navigation
    await dismissOnboardingModal(page);
    
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test('should have subtitle toggle button in the DOM', async ({ page }) => {
    // Check that subtitle UI elements exist in the DOM (even if player isn't open)
    const subtitleToggleBtn = page.locator('#subtitle-toggle-btn');
    await expect(subtitleToggleBtn).toBeAttached();
  });

  test('should have subtitle selector container in the DOM', async ({ page }) => {
    // Check that the subtitle selector container exists
    const subtitleSelector = page.locator('#subtitle-selector');
    await expect(subtitleSelector).toBeAttached();
  });

  test('should have video player container in the DOM', async ({ page }) => {
    // Verify the video player container exists (even if hidden by default)
    const playerContainer = page.locator('#video-player-container');
    await expect(playerContainer).toBeAttached();
    
    // Check that it has the video element
    const videoPlayer = page.locator('#video-player');
    await expect(videoPlayer).toBeAttached();
  });
});
