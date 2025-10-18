import { test, expect } from '@playwright/test';
import { dismissOnboardingModal } from './helpers';

test.describe('StreamGo App', () => {
  test('should load the app and display sidebar', async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to load
    await page.waitForTimeout(1000);
    await dismissOnboardingModal(page);
    
    // Check if sidebar elements are present
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.nav-item[data-section="home"]')).toBeVisible();
    await expect(page.locator('.nav-item[data-section="library"]')).toBeVisible();
    await expect(page.locator('.nav-item[data-section="addons"]')).toBeVisible();
  });

  test('should navigate between views', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await dismissOnboardingModal(page);
    
    // Click library button
    await page.click('.nav-item[data-section="library"] a');
    await page.waitForTimeout(500);
    
    // Check if library view is visible
    const librarySection = page.locator('#library-section');
    await expect(librarySection).toBeVisible();
    
    // Click home button
    await page.click('.nav-item[data-section="home"] a');
    await page.waitForTimeout(500);
    
    // Check if home view is visible
    const homeSection = page.locator('#home-section');
    await expect(homeSection).toBeVisible();
  });

  test('should display search input', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await dismissOnboardingModal(page);
    
    // Check if search input exists (global header search)
    await expect(page.locator('#global-search')).toBeVisible();
    
    // Type in search
    await page.fill('#global-search', 'test movie');
    const searchValue = await page.inputValue('#global-search');
    expect(searchValue).toBe('test movie');
  });

  test('should have player controls', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await dismissOnboardingModal(page);
    
    // Check player container exists (even if hidden initially)
    const playerContainer = page.locator('#video-player-container');
    await expect(playerContainer).toBeAttached();
  });
});
