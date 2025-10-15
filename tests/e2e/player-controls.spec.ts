import { test, expect } from '@playwright/test';

test.describe('Player Controls', () => {
  test('should have all player control buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Player container should exist (even if hidden)
    const playerContainer = page.locator('#video-player-container');
    await expect(playerContainer).toBeAttached();
    
    // Check for control buttons
    await expect(page.locator('#pip-btn')).toBeAttached();
    await expect(page.locator('.close-player-btn')).toBeAttached();
    await expect(page.locator('#external-player-btn')).toBeAttached();
  });
  
  test('should have quality selector', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Quality selector should exist
    await expect(page.locator('#quality-selector')).toBeAttached();
  });
  
  test('should have subtitle selector', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Subtitle selector should exist
    await expect(page.locator('#subtitle-selector')).toBeAttached();
    await expect(page.locator('#subtitle-toggle-btn')).toBeAttached();
  });
  
  test('should display player shortcuts hint', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Shortcuts hint should be visible in the player
    const shortcutsHint = page.locator('.player-shortcuts-hint');
    await expect(shortcutsHint).toBeAttached();
    
    // Should contain keyboard shortcut information
    const hintText = await shortcutsHint.textContent();
    expect(hintText).toContain('Space');
    expect(hintText).toContain('Fullscreen');
  });
  
  test('should have video player element', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Video player element should exist
    const videoPlayer = page.locator('#video-player');
    await expect(videoPlayer).toBeAttached();
    
    // Should have controls attribute
    await expect(videoPlayer).toHaveAttribute('controls', '');
  });
  
  test('should have player title element', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Player title should exist
    await expect(page.locator('#player-title')).toBeAttached();
  });
});
