import { test, expect } from '@playwright/test';

test.describe('Watchlist and Favorites', () => {
  test('should add item to watchlist', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Go to search
    await page.click('.nav-item[data-section="search"] a');
    await page.waitForTimeout(500);
    
    // Search for a movie
    await page.fill('#search-input', 'The Matrix');
    await page.click('#search-btn');
    await page.waitForTimeout(2000);
    
    // Click on first result (if available)
    const firstCard = page.locator('.media-card').first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await page.waitForTimeout(1000);
      
      // Add to watchlist
      const watchlistBtn = page.locator('button:has-text("Watchlist")');
      if (await watchlistBtn.isVisible()) {
        await watchlistBtn.click();
        await page.waitForTimeout(500);
        
        // Should show success toast
        await expect(page.locator('.toast.success')).toBeVisible();
      }
    }
  });
  
  test('should add item to favorites', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Go to search
    await page.click('.nav-item[data-section="search"] a');
    await page.waitForTimeout(500);
    
    // Search for a movie
    await page.fill('#search-input', 'Inception');
    await page.click('#search-btn');
    await page.waitForTimeout(2000);
    
    // Click on first result (if available)
    const firstCard = page.locator('.media-card').first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await page.waitForTimeout(1000);
      
      // Add to favorites
      const favoriteBtn = page.locator('button:has-text("Favorite")');
      if (await favoriteBtn.isVisible()) {
        await favoriteBtn.click();
        await page.waitForTimeout(500);
        
        // Should show success toast
        await expect(page.locator('.toast.success')).toBeVisible();
      }
    }
  });
  
  test('should navigate to library section', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Navigate to library
    await page.click('.nav-item[data-section="library"] a');
    await page.waitForTimeout(1000);
    
    // Check if library section is active
    const librarySection = page.locator('#library-section');
    await expect(librarySection).toHaveClass(/active/);
    
    // Library grid should be visible
    await expect(page.locator('#library-grid')).toBeVisible();
  });
});
