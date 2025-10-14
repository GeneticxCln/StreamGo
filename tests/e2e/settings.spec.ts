
import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri API before loading the page
    await page.addInitScript(() => {
      // Default settings
      const defaultSettings = {
        version: 1,
        theme: 'auto',
        language: 'en',
        notifications_enabled: true,
        auto_update: true,
        autoplay: true,
        quality: 'auto',
        playback_speed: 1.0,
        volume: 1.0,
        subtitle_language: 'en',
        telemetry_enabled: false
      };
      
      // Mock the Tauri API
      const mockInvoke = async (cmd: string, args?: any) => {
        console.log(`Mock invoke called: ${cmd}`, args);
        
        switch (cmd) {
          case 'get_settings':
            // Return saved settings from sessionStorage or defaults
            const saved = sessionStorage.getItem('mock_settings');
            return saved ? JSON.parse(saved) : defaultSettings;
            
          case 'save_settings':
            console.log('Mock save_settings:', args);
            // Store settings in sessionStorage
            if (args && args.settings) {
              sessionStorage.setItem('mock_settings', JSON.stringify(args.settings));
            }
            return {};
            
          case 'get_playlists':
            return [];
            
          case 'get_addons':
            return [];
            
          default:
            throw new Error(`Unhandled mock command: ${cmd}`);
        }
      };
      
      // Inject into window scope
      (window as any).__TAURI_INVOKE__ = mockInvoke;
      
      // Also provide the import path that the app uses
      (window as any).__TAURI__ = {
        invoke: mockInvoke,
        core: {
          invoke: mockInvoke
        }
      };
    });
    
    await page.goto('/');
    // Wait for app to load
    await page.waitForTimeout(1000);
    // Click settings button
    await page.click('a.nav-item[data-section="settings"]');
    await page.waitForTimeout(500);
  });

  test('should display the settings panel', async ({ page }) => {
    await expect(page.locator('#settings-section')).toBeVisible();
    await expect(page.locator('h2:has-text("Settings")')).toBeVisible();
  });

  test('should save and restore settings', async ({ page }) => {
    // Check initial value
    const themeSelect = page.locator('#theme-select');
    await expect(themeSelect).toHaveValue('auto');

    // Change the theme
    await themeSelect.selectOption('light');
    await expect(themeSelect).toHaveValue('light');

    // Save the settings
    await page.evaluate(async () => {
      await (window as any).app.saveSettings();
    });

    // Wait for success toast
    await expect(page.locator('.toast.success')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.toast.success')).toContainText('Settings saved successfully');

    // Reload the page
    await page.reload();
    await page.waitForTimeout(1000);

    // Re-open settings
    await page.click('a.nav-item[data-section="settings"]');
    await page.waitForTimeout(500);

    // Verify the setting is restored
    const themeSelectAfterReload = page.locator('#theme-select');
    await expect(themeSelectAfterReload).toHaveValue('light');

    // Reset the value
    await themeSelectAfterReload.selectOption('auto');
    await page.evaluate(async () => {
      await (window as any).app.saveSettings();
    });
    await expect(page.locator('.toast.success')).toBeVisible({ timeout: 5000 });
  });
});
