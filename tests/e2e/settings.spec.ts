
import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await page.waitForTimeout(1000);
    // Click settings button
    await page.click('.nav-item[data-section="settings"] a');
    await page.waitForTimeout(500);
  });

  test('should display the settings panel', async ({ page }) => {
    await expect(page.locator('#settings-section')).toBeVisible();
    await expect(page.locator('h2:has-text("Settings")')).toBeVisible();
  });

  test('should save and restore settings', async ({ page }) => {
    // Check initial value
    const themeSelect = page.locator('#theme');
    await expect(themeSelect).toHaveValue('dark');

    // Change the theme
    await themeSelect.selectOption('light');
    await expect(themeSelect).toHaveValue('light');

    // Save the settings
    await page.click('#save-settings');

    // Wait for toast
    await expect(page.locator('.toast.success')).toBeVisible();
    await expect(page.locator('.toast.success')).toContainText('Settings saved successfully');

    // Reload the page
    await page.reload();
    await page.waitForTimeout(1000);

    // Re-open settings
    await page.click('.nav-item[data-section="settings"] a');
    await page.waitForTimeout(500);

    // Verify the setting is restored
    await expect(themeSelect).toHaveValue('light');

    // Reset the value
    await themeSelect.selectOption('dark');
    await page.click('#save-settings');
    await expect(page.locator('.toast.success')).toBeVisible();
  });
});
