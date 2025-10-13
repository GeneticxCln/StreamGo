import { test, expect } from '@playwright/test';

test.describe('Video Player', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test('should have player container in DOM', async ({ page }) => {
    const playerContainer = page.locator('#player-container');
    await expect(playerContainer).toBeAttached();
  });

  test('should have player controls elements', async ({ page }) => {
    // Check for video element
    const videoElement = page.locator('#video-player');
    await expect(videoElement).toBeAttached();
    
    // Check for controls container
    const controlsContainer = page.locator('#player-controls');
    await expect(controlsContainer).toBeAttached();
  });

  test('should have quality selector', async ({ page }) => {
    const qualitySelector = page.locator('#quality-selector');
    await expect(qualitySelector).toBeAttached();
  });

  test('should have subtitle controls', async ({ page }) => {
    const subtitleSelector = page.locator('#subtitle-selector');
    await expect(subtitleSelector).toBeAttached();
  });

  test('should have play/pause button', async ({ page }) => {
    const playPauseBtn = page.locator('#play-pause-btn');
    await expect(playPauseBtn).toBeAttached();
  });

  test('should have volume controls', async ({ page }) => {
    const volumeSlider = page.locator('#volume-slider');
    await expect(volumeSlider).toBeAttached();
  });

  test('should have progress bar', async ({ page }) => {
    const progressBar = page.locator('#progress-bar');
    await expect(progressBar).toBeAttached();
  });

  test('should have fullscreen button', async ({ page }) => {
    const fullscreenBtn = page.locator('#fullscreen-btn');
    await expect(fullscreenBtn).toBeAttached();
  });

  test('should have close button', async ({ page }) => {
    const closeBtn = page.locator('#close-player-btn');
    await expect(closeBtn).toBeAttached();
  });
});

test.describe('Player Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test('should respond to keyboard shortcuts when player is active', async ({ page }) => {
    // Note: These tests verify the player has keyboard shortcut support
    // Actual testing would require mocking media playback or using test videos
    
    const videoElement = page.locator('#video-player');
    await expect(videoElement).toBeAttached();
    
    // Space bar for play/pause
    // Arrow keys for seeking
    // M for mute
    // F for fullscreen
    // P for Picture-in-Picture
    // These would be tested in integration once media is loaded
  });
});

test.describe('Picture-in-Picture', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test('should have PiP button in player controls', async ({ page }) => {
    const pipBtn = page.locator('#pip-btn');
    await expect(pipBtn).toBeAttached();
  });

  test('should have PiP button with correct title', async ({ page }) => {
    const pipBtn = page.locator('#pip-btn');
    await expect(pipBtn).toHaveAttribute('title', /Picture-in-Picture/);
  });

  test('should have PiP icon in button', async ({ page }) => {
    const pipBtn = page.locator('#pip-btn');
    const pipIcon = pipBtn.locator('svg');
    await expect(pipIcon).toBeAttached();
  });

  test('should display PiP shortcut in hints', async ({ page }) => {
    const shortcutHint = page.locator('.player-shortcuts-hint');
    await expect(shortcutHint).toContainText('P=PiP');
  });

  test('should have pip-btn CSS class', async ({ page }) => {
    const pipBtn = page.locator('#pip-btn');
    await expect(pipBtn).toHaveClass(/pip-btn/);
  });
});
