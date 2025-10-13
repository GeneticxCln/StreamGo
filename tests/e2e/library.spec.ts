import { test, expect } from '@playwright/test';

test.describe('Library Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test('should display watchlist view', async ({ page }) => {
    // Navigate to watchlist
    await page.click('.sidebar-btn[data-view="watchlist"]');
    await page.waitForTimeout(500);
    
    // Check if watchlist view is active
    const watchlistBtn = page.locator('.sidebar-btn[data-view="watchlist"]');
    await expect(watchlistBtn).toHaveClass(/active/);
    
    // Check for watchlist content area
    const contentArea = page.locator('#content');
    await expect(contentArea).toBeVisible();
  });

  test('should display favorites view', async ({ page }) => {
    // Navigate to favorites
    await page.click('.sidebar-btn[data-view="favorites"]');
    await page.waitForTimeout(500);
    
    // Check if favorites view is active
    const favoritesBtn = page.locator('.sidebar-btn[data-view="favorites"]');
    await expect(favoritesBtn).toHaveClass(/active/);
    
    // Check for favorites content area
    const contentArea = page.locator('#content');
    await expect(contentArea).toBeVisible();
  });

  test('should display continue watching view', async ({ page }) => {
    // Navigate to continue watching
    await page.click('.sidebar-btn[data-view="continue-watching"]');
    await page.waitForTimeout(500);
    
    // Check if continue watching view is active
    const continueBtn = page.locator('.sidebar-btn[data-view="continue-watching"]');
    await expect(continueBtn).toHaveClass(/active/);
    
    // Check for continue watching content area
    const contentArea = page.locator('#content');
    await expect(contentArea).toBeVisible();
  });

  test('should display library view', async ({ page }) => {
    // Navigate to library
    await page.click('.sidebar-btn[data-view="library"]');
    await page.waitForTimeout(500);
    
    // Check if library view is active
    const libraryBtn = page.locator('.sidebar-btn[data-view="library"]');
    await expect(libraryBtn).toHaveClass(/active/);
    
    // Check for library content area
    const contentArea = page.locator('#content');
    await expect(contentArea).toBeVisible();
  });
});

test.describe('Detail Page Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test('should have action buttons in detail view', async ({ page }) => {
    // Note: This test assumes there's media to select
    // In a real scenario, you might need to mock data or ensure test data exists
    
    // Check if detail view elements exist when needed
    const detailView = page.locator('#detail-view');
    
    // These buttons should exist in the DOM (even if not visible initially)
    const addToWatchlistBtn = page.locator('#add-to-watchlist-btn');
    const toggleFavoriteBtn = page.locator('#toggle-favorite-btn');
    
    // Verify buttons exist in DOM structure
    await expect(addToWatchlistBtn).toBeAttached();
    await expect(toggleFavoriteBtn).toBeAttached();
  });
});
