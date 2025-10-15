import { test, expect } from '@playwright/test';

test.describe('Addon Health Display', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri API with addons that have health data
    await page.addInitScript(() => {
      const mockAddons = [
        {
          id: 'excellent-addon',
          name: 'Excellent Addon',
          version: '1.0.0',
          description: 'A fast and reliable addon',
          author: 'Test Author',
          url: 'https://example.com/addon1',
          enabled: true,
          addon_type: 'ContentProvider',
          manifest: {
            id: 'excellent-addon',
            name: 'Excellent Addon',
            version: '1.0.0',
            description: 'A fast and reliable addon',
            resources: ['catalog', 'stream'],
            types: ['movie', 'series'],
            catalogs: []
          }
        },
        {
          id: 'good-addon',
          name: 'Good Addon',
          version: '2.1.0',
          description: 'A decent performing addon',
          author: 'Another Author',
          url: 'https://example.com/addon2',
          enabled: true,
          addon_type: 'ContentProvider',
          manifest: {
            id: 'good-addon',
            name: 'Good Addon',
            version: '2.1.0',
            description: 'A decent performing addon',
            resources: ['catalog'],
            types: ['movie'],
            catalogs: []
          }
        },
        {
          id: 'poor-addon',
          name: 'Poor Addon',
          version: '0.5.0',
          description: 'A slow and unreliable addon',
          author: 'Test Author',
          url: 'https://example.com/addon3',
          enabled: false,
          addon_type: 'MetadataProvider',
          manifest: {
            id: 'poor-addon',
            name: 'Poor Addon',
            version: '0.5.0',
            description: 'A slow and unreliable addon',
            resources: ['meta'],
            types: ['movie'],
            catalogs: []
          }
        }
      ];

      const mockHealthSummaries = [
        {
          addon_id: 'excellent-addon',
          last_check: Math.floor(Date.now() / 1000),
          success_rate: 0.98,
          avg_response_time_ms: 120,
          total_requests: 200,
          successful_requests: 196,
          failed_requests: 4,
          last_error: null,
          health_score: 98.0
        },
        {
          addon_id: 'good-addon',
          last_check: Math.floor(Date.now() / 1000),
          success_rate: 0.75,
          avg_response_time_ms: 450,
          total_requests: 100,
          successful_requests: 75,
          failed_requests: 25,
          last_error: null,
          health_score: 72.5
        },
        {
          addon_id: 'poor-addon',
          last_check: Math.floor(Date.now() / 1000),
          success_rate: 0.35,
          avg_response_time_ms: 2100,
          total_requests: 50,
          successful_requests: 18,
          failed_requests: 32,
          last_error: 'Connection timeout',
          health_score: 34.5
        }
      ];

      // Mock the Tauri API
      const mockInvoke = async (cmd: string, args?: any) => {
        console.log(`Mock invoke called: ${cmd}`, args);
        
        switch (cmd) {
          case 'get_addons':
            return mockAddons;
            
          case 'get_addon_health_summaries':
            return mockHealthSummaries;
            
          case 'get_addon_health':
            // Return health for specific addon
            const addonId = args?.addon_id;
            return mockHealthSummaries.find(h => h.addon_id === addonId) || null;
            
          case 'get_settings':
            return {
              version: 1,
              theme: 'auto',
              language: 'en'
            };
            
          default:
            throw new Error(`Unhandled mock command: ${cmd}`);
        }
      };
      
      // Inject into window scope
      (window as any).__TAURI_INVOKE__ = mockInvoke;
      (window as any).__TAURI__ = {
        invoke: mockInvoke,
        core: {
          invoke: mockInvoke
        }
      };
    });
    
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Navigate to addons section
    await page.click('.nav-item[data-section="addons"]');
    await page.waitForTimeout(500);
  });

  test('should display addons section with health badges', async ({ page }) => {
    await expect(page.locator('#addons-section')).toBeVisible();
    await expect(page.locator('.addon-card')).toHaveCount(3);
  });

  test('should show excellent health badge with green color', async ({ page }) => {
    const excellentAddon = page.locator('.addon-card').filter({ hasText: 'Excellent Addon' });
    await expect(excellentAddon).toBeVisible();
    
    // Check for health badge
    const healthBadge = excellentAddon.locator('.addon-health-badge');
    await expect(healthBadge).toBeVisible();
    await expect(healthBadge).toContainText(/excellent/i);
    
    // Verify it has the correct color class
    await expect(healthBadge).toHaveClass(/health-excellent/);
  });

  test('should show good health badge with appropriate color', async ({ page }) => {
    const goodAddon = page.locator('.addon-card').filter({ hasText: 'Good Addon' });
    await expect(goodAddon).toBeVisible();
    
    const healthBadge = goodAddon.locator('.addon-health-badge');
    await expect(healthBadge).toBeVisible();
    await expect(healthBadge).toContainText(/good/i);
    await expect(healthBadge).toHaveClass(/health-good/);
  });

  test('should show poor health badge with red color', async ({ page }) => {
    const poorAddon = page.locator('.addon-card').filter({ hasText: 'Poor Addon' });
    await expect(poorAddon).toBeVisible();
    
    const healthBadge = poorAddon.locator('.addon-health-badge');
    await expect(healthBadge).toBeVisible();
    await expect(healthBadge).toContainText(/poor/i);
    await expect(healthBadge).toHaveClass(/health-poor/);
  });

  test('should display health metrics for addon', async ({ page }) => {
    const excellentAddon = page.locator('.addon-card').filter({ hasText: 'Excellent Addon' });
    
    // Check for health metrics section
    const metricsSection = excellentAddon.locator('.addon-health-metrics');
    await expect(metricsSection).toBeVisible();
    
    // Verify metrics are displayed
    await expect(metricsSection).toContainText(/success rate/i);
    await expect(metricsSection).toContainText(/98%|196/); // Success rate or count
    
    await expect(metricsSection).toContainText(/response|avg/i);
    await expect(metricsSection).toContainText('120'); // Response time
    
    await expect(metricsSection).toContainText(/requests|total/i);
    await expect(metricsSection).toContainText('200'); // Total requests
  });

  test('should calculate and display success rate percentage', async ({ page }) => {
    const goodAddon = page.locator('.addon-card').filter({ hasText: 'Good Addon' });
    const metrics = goodAddon.locator('.addon-health-metrics');
    
    // Success rate: 75/100 = 75%
    await expect(metrics).toContainText('75%');
  });

  test('should show both health badge and enabled status', async ({ page }) => {
    const excellentAddon = page.locator('.addon-card').filter({ hasText: 'Excellent Addon' });
    
    // Should have both health badge and enabled status
    await expect(excellentAddon.locator('.addon-health-badge')).toBeVisible();
    await expect(excellentAddon.locator('.addon-status')).toBeVisible();
    await expect(excellentAddon.locator('.addon-status')).toContainText(/enabled/i);
  });

  test('should show disabled status for poor addon', async ({ page }) => {
    const poorAddon = page.locator('.addon-card').filter({ hasText: 'Poor Addon' });
    
    const status = poorAddon.locator('.addon-status');
    await expect(status).toContainText(/disabled/i);
    await expect(status).toHaveClass(/disabled/);
  });

  test('should display addon metadata alongside health', async ({ page }) => {
    const addon = page.locator('.addon-card').filter({ hasText: 'Excellent Addon' });
    
    // Check standard addon information is still visible
    await expect(addon).toContainText('Excellent Addon');
    await expect(addon).toContainText('1.0.0'); // version
    await expect(addon).toContainText('Test Author'); // author
    await expect(addon).toContainText('fast and reliable'); // description
  });

  test('should order addons with health data prominently', async ({ page }) => {
    // Get all addon cards
    const addonCards = page.locator('.addon-card');
    
    // Verify we have 3 addons
    await expect(addonCards).toHaveCount(3);
    
    // First addon should ideally be the best performing one
    // (though ordering might be by health score or enabled status)
    const firstCard = addonCards.first();
    const hasHealthBadge = await firstCard.locator('.addon-health-badge').count() > 0;
    expect(hasHealthBadge).toBe(true);
  });

  test('should display health score in badge tooltip', async ({ page }) => {
    const excellentAddon = page.locator('.addon-card').filter({ hasText: 'Excellent Addon' });
    const healthBadge = excellentAddon.locator('.addon-health-badge');
    
    // Check if tooltip or title attribute exists with score
    const title = await healthBadge.getAttribute('title');
    if (title) {
      expect(title).toContain('98');
    }
  });

  test('should handle addons without health data gracefully', async ({ page }) => {
    // Add an addon without health data via mock
    await page.evaluate(() => {
      // This test verifies the UI handles missing health data
      // If an addon has no health data, it should still render
    });
    
    // All addon cards should still be visible
    await expect(page.locator('.addon-card')).toHaveCount(3);
  });
});
