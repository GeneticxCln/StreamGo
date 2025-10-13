import { test, expect } from '@playwright/test';

test.describe('StreamGo App', () => {
  test('should load the app and display sidebar', async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to load
    await page.waitForTimeout(1000);
    
    // Check if sidebar elements are present
    await expect(page.locator('#sidebar')).toBeVisible();
    await expect(page.locator('.sidebar-btn[data-view="home"]')).toBeVisible();
    await expect(page.locator('.sidebar-btn[data-view="library"]')).toBeVisible();
    await expect(page.locator('.sidebar-btn[data-view="watchlist"]')).toBeVisible();
  });

  test('should navigate between views', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Click library button
    await page.click('.sidebar-btn[data-view="library"]');
    await page.waitForTimeout(500);
    
    // Check if library view is active
    const libraryBtn = page.locator('.sidebar-btn[data-view="library"]');
    await expect(libraryBtn).toHaveClass(/active/);
    
    // Click home button
    await page.click('.sidebar-btn[data-view="home"]');
    await page.waitForTimeout(500);
    
    // Check if home view is active
    const homeBtn = page.locator('.sidebar-btn[data-view="home"]');
    await expect(homeBtn).toHaveClass(/active/);
  });

  test('should display search input', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Check if search input exists
    await expect(page.locator('#searchInput')).toBeVisible();
    
    // Type in search
    await page.fill('#searchInput', 'test movie');
    const searchValue = await page.inputValue('#searchInput');
    expect(searchValue).toBe('test movie');
  });

  test('should have player controls', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Check player container exists (even if hidden initially)
    const playerContainer = page.locator('#player-container');
    await expect(playerContainer).toBeAttached();
  });
});
