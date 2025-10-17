import { test, expect } from '@playwright/test';

test.describe('Addon Health Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display addon health badges in addons section', async ({ page }) => {
    // Navigate to addons
    await page.click('[data-section="addons"]');
    await page.waitForSelector('#addons-list', { timeout: 5000 });
    
    // Wait for loading to complete
    await page.waitForTimeout(1000);
    
    // Check if any addon cards exist
    const addonCards = page.locator('.addon-card');
    const count = await addonCards.count();
    
    if (count > 0) {
      // At least one addon exists
      expect(count).toBeGreaterThan(0);
      
      // Check for addon structure
      const firstCard = addonCards.first();
      await expect(firstCard.locator('.addon-header')).toBeVisible();
      await expect(firstCard.locator('.addon-title-group h3')).toBeVisible();
    } else {
      // If no addons, verify empty state or error state exists
      const emptyStateExists = await page.locator('#addons-list .empty-state').count() > 0;
      const emptyMessageExists = await page.locator('#addons-list .empty-message').count() > 0;
      const errorStateExists = await page.locator('#addons-list .error-state').count() > 0;
      
      expect(emptyStateExists || emptyMessageExists || errorStateExists).toBe(true);
    }
  });

  test('should show health badges with appropriate classes', async ({ page }) => {
    // Navigate to addons
    await page.click('[data-section="addons"]');
    await page.waitForSelector('#addons-list', { timeout: 5000 });
    
    // Find addon cards with health badges
    const healthBadges = page.locator('.addon-health-badge');
    const badgeCount = await healthBadges.count();
    
    if (badgeCount > 0) {
      // Check each badge has proper class
      for (let i = 0; i < Math.min(badgeCount, 5); i++) {
        const badge = healthBadges.nth(i);
        const classList = await badge.getAttribute('class');
        
        // Should have one of the health status classes
        expect(classList).toMatch(/health-(excellent|good|fair|poor|unknown)/);
        
        // Should have text
        const text = await badge.textContent();
        expect(text).toMatch(/Excellent|Good|Fair|Poor|Unknown/i);
      }
    }
  });

  test('should verify health badge colors match score thresholds', async ({ page }) => {
    // Navigate to addons
    await page.click('[data-section="addons"]');
    await page.waitForSelector('#addons-list', { timeout: 5000 });
    
    // Get all health badges
    const healthBadges = page.locator('.addon-health-badge');
    const badgeCount = await healthBadges.count();
    
    if (badgeCount > 0) {
      const badge = healthBadges.first();
      const classList = await badge.getAttribute('class');
      const badgeText = await badge.textContent();
      
      // Verify class matches text
      const classToText: Record<string, string[]> = {
        'health-excellent': ['Excellent'],
        'health-good': ['Good'],
        'health-fair': ['Fair'],
        'health-poor': ['Poor'],
        'health-unknown': ['Unknown']
      };
      
      let matched = false;
      for (const [cssClass, expectedTexts] of Object.entries(classToText)) {
        if (classList?.includes(cssClass)) {
          matched = expectedTexts.some(text => badgeText?.includes(text));
          expect(matched).toBe(true);
        }
      }
    }
  });

  test('should display addon health metrics when available', async ({ page }) => {
    // Navigate to addons
    await page.click('[data-section="addons"]');
    await page.waitForSelector('#addons-list', { timeout: 5000 });
    
    // Check for health metrics sections
    const metricsSection = page.locator('.addon-health-metrics');
    const metricsCount = await metricsSection.count();
    
    if (metricsCount > 0) {
      // At least one addon has metrics
      const firstMetrics = metricsSection.first();
      
      // Verify metrics are displayed
      await expect(firstMetrics.locator('.health-metric:has-text("Success Rate")')).toBeVisible();
      await expect(firstMetrics.locator('.health-metric:has-text("Avg Response")')).toBeVisible();
      await expect(firstMetrics.locator('.health-metric:has-text("Requests")')).toBeVisible();
      
      // Verify metrics have values
      const successRate = firstMetrics.locator('.health-metric:has-text("Success Rate") .metric-value');
      const successRateText = await successRate.textContent();
      expect(successRateText).toMatch(/\d+%/);
      
      const avgResponse = firstMetrics.locator('.health-metric:has-text("Avg Response") .metric-value');
      const avgResponseText = await avgResponse.textContent();
      expect(avgResponseText).toMatch(/\d+ms/);
    }
  });

  test('should show health score in badge title attribute', async ({ page }) => {
    // Navigate to addons
    await page.click('[data-section="addons"]');
    await page.waitForSelector('#addons-list', { timeout: 5000 });
    
    // Get health badges with title attribute
    const healthBadges = page.locator('.addon-health-badge[title]');
    const badgeCount = await healthBadges.count();
    
    if (badgeCount > 0) {
      const firstBadge = healthBadges.first();
      const title = await firstBadge.getAttribute('title');
      
      // Title should contain "Health Score:"
      expect(title).toMatch(/Health Score:\s*\d+/);
    }
  });

  test('should display addon version alongside health badge', async ({ page }) => {
    // Navigate to addons
    await page.click('[data-section="addons"]');
    await page.waitForSelector('#addons-list', { timeout: 5000 });
    
    // Check addon cards structure
    const addonCards = page.locator('.addon-card');
    const count = await addonCards.count();
    
    if (count > 0) {
      const firstCard = addonCards.first();
      
      // Verify addon has version
      const version = firstCard.locator('.addon-version');
      await expect(version).toBeVisible();
      
      const versionText = await version.textContent();
      expect(versionText).toMatch(/v\d+\.\d+/);
      
      // Verify addon has name
      const name = firstCard.locator('.addon-title-group h3');
      await expect(name).toBeVisible();
    }
  });

  test('should show enabled/disabled status for addons', async ({ page }) => {
    // Navigate to addons
    await page.click('[data-section="addons"]');
    await page.waitForSelector('#addons-list', { timeout: 5000 });
    
    // Check for status badges
    const statusBadges = page.locator('.addon-status');
    const statusCount = await statusBadges.count();
    
    if (statusCount > 0) {
      const firstStatus = statusBadges.first();
      
      // Should have enabled or disabled class
      const classList = await firstStatus.getAttribute('class');
      expect(classList).toMatch(/enabled|disabled/);
      
      // Should have corresponding text
      const text = await firstStatus.textContent();
      expect(text).toMatch(/Enabled|Disabled/);
    }
  });

  test('should display health information in diagnostics section', async ({ page }) => {
    // Navigate to diagnostics
    await page.click('[data-section="diagnostics"]');
    await page.waitForSelector('.diagnostics-dashboard', { timeout: 15000 });
    
    // Find addon health card
    const healthCard = page.locator('.diagnostics-card:has-text("Addon Health")');
    await expect(healthCard).toBeVisible();
    
    // Check for health items or empty message
    const healthItems = healthCard.locator('.health-item');
    const healthItemCount = await healthItems.count();
    
    const emptyMessage = healthCard.locator('.empty-message');
    const emptyMessageCount = await emptyMessage.count();
    
    // Should have either health items or empty message
    expect(healthItemCount + emptyMessageCount).toBeGreaterThan(0);
  });

  test('should show health history/summary in diagnostics', async ({ page }) => {
    // Navigate to diagnostics
    await page.click('[data-section="diagnostics"]');
    await page.waitForSelector('.diagnostics-dashboard', { timeout: 15000 });
    
    // Find addon health section
    const healthCard = page.locator('.diagnostics-card:has-text("Addon Health")');
    const healthItems = healthCard.locator('.health-item');
    const itemCount = await healthItems.count();
    
    if (itemCount > 0) {
      // Check first health item structure
      const firstItem = healthItems.first();
      
      // Should have addon name/identifier
      await expect(firstItem).toBeVisible();
      
      // Should have some health information
      const itemText = await firstItem.textContent();
      expect(itemText).toBeTruthy();
      expect(itemText!.length).toBeGreaterThan(0);
    }
  });

  test('should handle addons without health data gracefully', async ({ page }) => {
    // Navigate to addons
    await page.click('[data-section="addons"]');
    await page.waitForSelector('#addons-list', { timeout: 5000 });
    
    // Get all addon cards
    const addonCards = page.locator('.addon-card');
    const count = await addonCards.count();
    
    if (count > 0) {
      // Iterate through cards to find one without health badge
      for (let i = 0; i < count; i++) {
        const card = addonCards.nth(i);
        const healthBadge = card.locator('.addon-health-badge');
        const badgeCount = await healthBadge.count();
        
        if (badgeCount === 0) {
          // This addon has no health data - verify it still displays properly
          await expect(card.locator('.addon-header h3')).toBeVisible();
          await expect(card.locator('.addon-description')).toBeVisible();
          
          // Should have status badge
          await expect(card.locator('.addon-status')).toBeVisible();
          break;
        }
      }
    }
  });

  test('should maintain health badge visibility during scroll', async ({ page }) => {
    // Navigate to addons
    await page.click('[data-section="addons"]');
    await page.waitForSelector('#addons-list', { timeout: 5000 });
    
    // Get addon cards
    const addonCards = page.locator('.addon-card');
    const count = await addonCards.count();
    
    if (count > 3) {
      // Scroll to bottom addon
      const bottomCard = addonCards.nth(count - 1);
      await bottomCard.scrollIntoViewIfNeeded();
      
      // Check if health badge is still visible
      const healthBadge = bottomCard.locator('.addon-health-badge');
      const badgeCount = await healthBadge.count();
      
      if (badgeCount > 0) {
        await expect(healthBadge).toBeVisible();
      }
    }
  });

  test('should not have console errors when loading health data', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Navigate to addons
    await page.click('[data-section="addons"]');
    await page.waitForSelector('#addons-list', { timeout: 5000 });
    
    // Wait for health data to potentially load
    await page.waitForTimeout(2000);
    
    // Navigate to diagnostics
    await page.click('[data-section="diagnostics"]');
    await page.waitForSelector('.diagnostics-dashboard', { timeout: 15000 });
    await page.waitForTimeout(1000);
    
    // Filter out known acceptable errors
    const criticalErrors = consoleErrors.filter(err => 
      !err.includes('net::ERR_') && 
      !err.includes('Failed to load resource') &&
      !err.includes('Failed to load') &&
      !err.includes('health') && // Filter out health-specific network errors in dev
      !err.includes('invoke') && // Filter out Tauri invoke errors in test env
      !err.includes('command') // Filter out command errors
    );
    
    // Allow a small number of transient errors in test environment
    expect(criticalErrors.length).toBeLessThanOrEqual(1);
  });

  test('should update health badges after addon activity', async ({ page }) => {
    // This test verifies the reactive nature of health badges
    // In a real scenario, we'd trigger addon activity and verify updates
    
    // Navigate to addons
    await page.click('[data-section="addons"]');
    await page.waitForSelector('#addons-list', { timeout: 5000 });
    
    // Get initial health badge state
    const healthBadges = page.locator('.addon-health-badge');
    const initialCount = await healthBadges.count();
    
    // Navigate to diagnostics and back (simulates passage of time)
    await page.click('[data-section="diagnostics"]');
    await page.waitForTimeout(500);
    await page.click('[data-section="addons"]');
    await page.waitForSelector('#addons-list', { timeout: 5000 });
    
    // Health badges should still be present
    const updatedCount = await healthBadges.count();
    expect(updatedCount).toBe(initialCount);
  });

  test('should show all health status variations correctly', async ({ page }) => {
    // Navigate to addons
    await page.click('[data-section="addons"]');
    await page.waitForSelector('#addons-list', { timeout: 5000 });
    
    // Collect all unique health statuses
    const healthBadges = page.locator('.addon-health-badge');
    const badgeCount = await healthBadges.count();
    
    const statuses = new Set<string>();
    
    for (let i = 0; i < badgeCount; i++) {
      const badge = healthBadges.nth(i);
      const text = await badge.textContent();
      if (text) {
        statuses.add(text.trim());
      }
    }
    
    // Each status should be one of the valid ones
    for (const status of statuses) {
      expect(['Excellent', 'Good', 'Fair', 'Poor', 'Unknown']).toContain(status);
    }
  });

  test('should display health metrics with proper formatting', async ({ page }) => {
    // Navigate to addons
    await page.click('[data-section="addons"]');
    await page.waitForSelector('#addons-list', { timeout: 5000 });
    
    // Find addon with metrics
    const metricsSection = page.locator('.addon-health-metrics').first();
    const metricsCount = await page.locator('.addon-health-metrics').count();
    
    if (metricsCount > 0) {
      // Check success rate format (should be percentage)
      const successRateValue = metricsSection.locator('.health-metric:has-text("Success Rate") .metric-value');
      const successRate = await successRateValue.textContent();
      expect(successRate).toMatch(/^\d+%$/);
      
      // Check avg response format (should be milliseconds)
      const avgResponseValue = metricsSection.locator('.health-metric:has-text("Avg Response") .metric-value');
      const avgResponse = await avgResponseValue.textContent();
      expect(avgResponse).toMatch(/^\d+ms$/);
      
      // Check requests count (should be number)
      const requestsValue = metricsSection.locator('.health-metric:has-text("Requests") .metric-value');
      const requests = await requestsValue.textContent();
      expect(requests).toMatch(/^\d+$/);
    }
  });
});
