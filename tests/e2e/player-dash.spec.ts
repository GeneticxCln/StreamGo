import { test, expect } from '@playwright/test';

test.describe('DASH Player Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const mockInvoke = async (cmd: string, args?: any) => {
        if (cmd === 'get_settings') {
          return {
            version: 1,
            theme: 'dark',
            language: 'en',
          };
        }
        throw new Error(`Unhandled mock command: ${cmd}`);
      };

      (window as any).__TAURI_INVOKE__ = mockInvoke;
    });

    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('should initialize DASH player for .mpd URLs', async ({ page }) => {
    // Mock the app.playVideo call to use a DASH URL
    await page.evaluate(() => {
      (window as any).app.playVideo('https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd', 'Test DASH Stream');
    });

    // Wait for player to become visible
    const playerContainer = page.locator('#video-player-container');
    await expect(playerContainer).toBeVisible({ timeout: 10000 });

    // Check if the video source is set correctly
    const videoSource = page.locator('#video-player');
    const src = await videoSource.getAttribute('src');
    expect(src).not.toContain('manifest.mpd'); // dash.js handles the source

    // Check that the player title is updated
    await expect(page.locator('#player-title')).toHaveText('Now Playing: Test DASH Stream');
  });

  test('should show quality selector for DASH streams', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).app.playVideo('https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd', 'Test DASH Stream');
    });

    await expect(page.locator('#video-player-container')).toBeVisible({ timeout: 10000 });

    // The quality selector should be populated by dash-player.ts
    const qualitySelector = page.locator('#quality-selector');
    await expect(qualitySelector).toBeVisible();

    // Wait for options to be populated
    await page.waitForFunction(() => document.querySelector('#quality-selector select')?.options.length > 1);

    const optionsCount = await page.locator('#quality-selector select option').count();
    expect(optionsCount).toBeGreaterThan(1); // Should have 'Auto' plus at least one quality level
  });
});
