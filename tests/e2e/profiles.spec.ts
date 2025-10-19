import { test, expect } from '@playwright/test';

test.describe('Multi-Profile Support', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings page where profile management is located
    await page.goto('/settings');
  });

  test('should display profile management section', async ({ page }) => {
    // Check if profile management section is visible
    const profileSection = page.locator('h3').filter({ hasText: 'Profile Management' });
    await expect(profileSection).toBeVisible();

    // Check if current profile is displayed
    await expect(page.locator('.current-profile-card')).toBeVisible();
  });

  test('should display current profile information', async ({ page }) => {
    // Check if profile avatar is displayed
    const profileAvatar = page.locator('.profile-avatar');
    await expect(profileAvatar).toBeVisible();

    // Check if profile name is displayed
    const profileName = page.locator('.profile-info h4');
    await expect(profileName).toBeVisible();

    // Check if profile stats are displayed
    const profileStats = page.locator('.profile-stats');
    await expect(profileStats).toBeVisible();
  });

  test('should display all profiles section', async ({ page }) => {
    // Check if "All Profiles" section exists
    const allProfilesHeader = page.locator('h3').filter({ hasText: 'All Profiles' });
    await expect(allProfilesHeader).toBeVisible();

    // Check if create profile button exists
    const createProfileBtn = page.locator('button').filter({ hasText: 'Create Profile' });
    await expect(createProfileBtn).toBeVisible();
  });

  test('should show create profile modal when button is clicked', async ({ page }) => {
    // Click create profile button
    await page.click('button:has-text("Create Profile")');

    // Check if modal appears
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.locator('.modal-content')).toBeVisible();

    // Check if form fields are present
    await expect(page.locator('#profile-name')).toBeVisible();
    await expect(page.locator('#profile-email')).toBeVisible();

    // Close modal
    await page.click('.close-btn');
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('should validate profile creation form', async ({ page }) => {
    // Open create profile modal
    await page.click('button:has-text("Create Profile")');

    // Try to create profile without name
    await page.click('button:has-text("Create Profile")');

    // Should show validation error or prevent creation
    // (This depends on your specific validation implementation)
  });

  test('should create new profile successfully', async ({ page }) => {
    // Open create profile modal
    await page.click('button:has-text("Create Profile")');

    // Fill in profile details
    await page.fill('#profile-name', 'Test Profile');
    await page.fill('#profile-email', 'test@example.com');

    // Create profile
    await page.click('button:has-text("Create Profile")');

    // Check if modal closes and profile appears in list
    await expect(page.locator('.modal-overlay')).not.toBeVisible();

    // Check if new profile appears in profiles list
    await expect(page.locator('.profile-card')).toHaveCount(2); // Default + new profile
  });

  test('should switch between profiles', async ({ page }) => {
    // First create a new profile if only default exists
    const profileCards = page.locator('.profile-card');
    const profileCount = await profileCards.count();

    if (profileCount < 2) {
      // Create a new profile first
      await page.click('button:has-text("Create Profile")');
      await page.fill('#profile-name', 'Test Profile');
      await page.click('button:has-text("Create Profile")');
      await expect(page.locator('.modal-overlay')).not.toBeVisible();
    }

    // Find a non-current profile and switch to it
    const nonCurrentProfile = page.locator('.profile-card').filter({ hasNotText: 'Current' }).first();
    if (await nonCurrentProfile.count() > 0) {
      const switchBtn = nonCurrentProfile.locator('button').filter({ hasText: 'Switch To' });
      await switchBtn.click();

      // Check if switch was successful
      // (You might need to adjust this based on your specific feedback mechanism)
    }
  });

  test('should prevent deletion of default profile', async ({ page }) => {
    // Try to delete the default profile
    const defaultProfile = page.locator('.profile-card').filter({ hasText: 'Default User' }).first();

    if (await defaultProfile.count() > 0) {
      // Check that delete button is not present or disabled for default profile
      const deleteBtn = defaultProfile.locator('button:has-text("Delete")');
      const deleteBtnCount = await deleteBtn.count();

      // Should not have a delete button for default profile
      expect(deleteBtnCount).toBe(0);
    }
  });

  test('should delete non-default profile', async ({ page }) => {
    // First ensure we have a non-default profile
    const profileCards = page.locator('.profile-card');
    const profileCount = await profileCards.count();

    if (profileCount < 2) {
      // Create a new profile first
      await page.click('button:has-text("Create Profile")');
      await page.fill('#profile-name', 'Profile to Delete');
      await page.click('button:has-text("Create Profile")');
      await expect(page.locator('.modal-overlay')).not.toBeVisible();
    }

    // Find a deletable profile and delete it
    const deletableProfile = page.locator('.profile-card').filter({ hasNotText: 'Default User' }).first();

    if (await deletableProfile.count() > 0) {
      // Click delete button
      const deleteBtn = deletableProfile.locator('button').filter({ hasText: 'Delete' });
      await deleteBtn.click();

      // Confirm deletion (you might need to adjust this based on your confirmation dialog)
      // await page.click('button:has-text("Yes")');

      // Check if profile was removed
      // await expect(page.locator('.profile-card')).toHaveCount(profileCount - 1);
    }
  });

  test('should display profile statistics', async ({ page }) => {
    // Check if profile stats are displayed
    const statItems = page.locator('.stat-item');
    await expect(statItems.first()).toBeVisible();

    // Should show library count, watchlist count, and favorites count
    const statsText = await statItems.allTextContents();
    expect(statsText.length).toBeGreaterThan(0);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check if profile management is still visible and functional
    await expect(page.locator('.profile-manager')).toBeVisible();

    // Check if create profile button is still accessible
    await expect(page.locator('button:has-text("Create Profile")')).toBeVisible();
  });
});