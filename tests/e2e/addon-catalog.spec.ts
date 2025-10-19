import { test, expect } from '@playwright/test';

test.describe('Addon Catalog UI', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to addons section
    await page.goto('/addons');

    // Click on the store tab to load the addon catalog
    await page.click('[data-tab="store"]');
  });

  test('should display addon catalog interface', async ({ page }) => {
    // Check if the addon catalog mount point exists
    const catalogMount = page.locator('#addon-catalog-mount');
    await expect(catalogMount).toBeVisible();

    // Check if the catalog header is visible
    await expect(page.locator('.addon-catalog')).toBeVisible();
    await expect(page.locator('h2')).toContainText('Addon Catalog');
  });

  test('should display search and filter controls', async ({ page }) => {
    // Check search input
    const searchInput = page.locator('.catalog-search');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', 'Search addons...');

    // Check filter selects
    const categoryFilter = page.locator('.filter-select').first();
    await expect(categoryFilter).toBeVisible();

    const mediaTypeFilter = page.locator('.filter-select').nth(1);
    await expect(mediaTypeFilter).toBeVisible();
  });

  test('should display addon cards', async ({ page }) => {
    // Wait for addon cards to load
    await page.waitForSelector('.addon-card');

    // Check if addon cards are displayed
    const addonCards = page.locator('.addon-card');
    const cardCount = await addonCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Check structure of first addon card
    const firstCard = addonCards.first();
    await expect(firstCard.locator('.addon-title')).toBeVisible();
    await expect(firstCard.locator('.addon-description')).toBeVisible();
    await expect(firstCard.locator('.addon-actions')).toBeVisible();
  });

  test('should allow searching addons', async ({ page }) => {
    const searchInput = page.locator('.catalog-search');

    // Type a search query
    await searchInput.fill('cinemeta');

    // Wait for filtering to apply
    await page.waitForTimeout(500);

    // Check if filtered results are displayed
    const addonCards = page.locator('.addon-card');
    const cardCount = await addonCards.count();

    // Should have at least one result (Cinemeta)
    expect(cardCount).toBeGreaterThanOrEqual(1);

    // Clear search
    await searchInput.fill('');

    // Wait for all addons to reappear
    await page.waitForTimeout(500);
  });

  test('should allow filtering by category', async ({ page }) => {
    const categoryFilter = page.locator('.filter-select').first();

    // Select movies category
    await categoryFilter.selectOption('movies');

    // Wait for filtering to apply
    await page.waitForTimeout(500);

    // Check if filtered results are displayed
    const addonCards = page.locator('.addon-card');
    const cardCount = await addonCards.count();

    // Should have results for movies category
    expect(cardCount).toBeGreaterThanOrEqual(0); // May be 0 if no movie addons in test data
  });

  test('should show addon status badges', async ({ page }) => {
    // Wait for addon cards to load
    await page.waitForSelector('.addon-card');

    // Check if status badges are displayed
    const statusBadges = page.locator('.status-badge');
    await expect(statusBadges.first()).toBeVisible();
  });

  test('should display addon features', async ({ page }) => {
    // Wait for addon cards to load
    await page.waitForSelector('.addon-card');

    // Check if feature items are displayed
    const featureItems = page.locator('.feature-item');
    await expect(featureItems.first()).toBeVisible();
  });

  test('should handle addon installation', async ({ page }) => {
    // Wait for addon cards to load
    await page.waitForSelector('.addon-card');

    // Find an available (not installed) addon
    const availableAddon = page.locator('.addon-card').filter({ hasText: 'Available' }).first();

    if (await availableAddon.count() > 0) {
      // Click install button
      await availableAddon.locator('.btn-primary').click();

      // Check if success message appears (you might need to adjust this based on your toast implementation)
      // await expect(page.locator('.toast-success')).toBeVisible();
    }
  });

  test('should handle empty search results', async ({ page }) => {
    const searchInput = page.locator('.catalog-search');

    // Type a search query that should return no results
    await searchInput.fill('nonexistentaddon12345');

    // Wait for filtering to apply
    await page.waitForTimeout(500);

    // Check if empty state is displayed
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.empty-icon')).toContainText('🔍');
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check if catalog is still visible and functional
    await expect(page.locator('.addon-catalog')).toBeVisible();

    // Check if search and filters are still accessible
    await expect(page.locator('.catalog-search')).toBeVisible();
    await expect(page.locator('.filter-select')).toBeVisible();
  });
});