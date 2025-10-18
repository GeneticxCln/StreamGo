import { test, expect } from '@playwright/test';
import { dismissOnboardingModal } from './helpers';

test.describe('Library Features', () => {
  test.beforeEach(async ({ page }) => {
    await dismissOnboardingModal(page); // Call before goto
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test('should display library view', async ({ page }) => {
    // Navigate to library
    await page.click('.nav-item[data-section="library"] a');
    await page.waitForTimeout(500);
    
    // Check if library view is active
    const libraryBtn = page.locator('.nav-item[data-section="library"]');
    await expect(libraryBtn).toBeVisible();
    
    // Check for library content area
    const librarySection = page.locator('#library-section');
    await expect(librarySection).toBeVisible();
    
    // Check for library grid
    const libraryGrid = page.locator('#library-grid');
    await expect(libraryGrid).toBeVisible();
  });

  test('should display playlists view', async ({ page }) => {
    // Navigate to playlists
    await page.click('.nav-item[data-section="playlists"] a');
    await page.waitForTimeout(500);
    
    // Check if playlists view is active
    const playlistsBtn = page.locator('.nav-item[data-section="playlists"]');
    await expect(playlistsBtn).toBeVisible();
    
    // Check for playlists content area
    const playlistsSection = page.locator('#playlists-section');
    await expect(playlistsSection).toBeVisible();
  });

  test('should display search view', async ({ page }) => {
    // Navigate to search
    await page.click('.nav-item[data-section="search"] a');
    await page.waitForTimeout(500);
    
    // Check if search view is active
    const searchBtn = page.locator('.nav-item[data-section="search"]');
    await expect(searchBtn).toBeVisible();
    
    // Check for search section
    const searchSection = page.locator('#search-section');
    await expect(searchSection).toBeVisible();
    
    // Check for search input
    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();
  });

  test('should display home section by default', async ({ page }) => {
    //The HTML has home section active by default, but check that app doesn't break that
    await page.waitForTimeout(500);
    
    // Home section should exist in DOM
    const homeSection = page.locator('#home-section');
    await expect(homeSection).toBeAttached();
    
    // Check for hero section
    const heroSection = page.locator('.hero-section');
    await expect(heroSection).toBeAttached();
  });
});

test.describe('Detail Page Actions', () => {
  test.beforeEach(async ({ page }) => {
    await dismissOnboardingModal(page); // Call before goto
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test('should have detail section in DOM', async ({ page }) => {
    // Check if detail section exists
    const detailSection = page.locator('#detail-section');
    await expect(detailSection).toBeAttached();
    
    // Check for detail container
    const detailContainer = page.locator('.detail-container');
    await expect(detailContainer).toBeAttached();
    
    // Check for back button
    const backBtn = page.locator('.detail-container .back-btn');
    await expect(backBtn).toBeAttached();
  });
});
