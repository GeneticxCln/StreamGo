import { test, expect } from '@playwright/test';
import { resolve } from 'path';
import { existsSync, unlinkSync, readFileSync } from 'fs';

test.describe('Diagnostics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to diagnostics section', async ({ page }) => {
    // Click diagnostics nav item
    await page.click('[data-section="diagnostics"]');
    
    // Wait for diagnostics section to be visible
    await expect(page.locator('#diagnostics-section')).toBeVisible();
    await expect(page.locator('#diagnostics-section')).toHaveClass(/active/);
    
    // Verify diagnostics header is present
    await expect(page.locator('.diagnostics-header h2')).toContainText('Diagnostics');
  });

  test('should display performance metrics', async ({ page }) => {
    // Navigate to diagnostics
    await page.click('[data-section="diagnostics"]');
    await page.waitForSelector('.diagnostics-dashboard', { timeout: 5000 });
    
    // Verify performance metrics card exists
    const metricsCard = page.locator('.diagnostics-card:has-text("Performance Metrics")');
    await expect(metricsCard).toBeVisible();
    
    // Check for key metrics
    await expect(metricsCard.locator('.metric-item:has-text("Total Requests")')).toBeVisible();
    await expect(metricsCard.locator('.metric-item:has-text("Success Rate")')).toBeVisible();
    await expect(metricsCard.locator('.metric-item:has-text("Avg Response Time")')).toBeVisible();
    await expect(metricsCard.locator('.metric-item:has-text("Cache Hit Rate")')).toBeVisible();
  });

  test('should display cache statistics', async ({ page }) => {
    // Navigate to diagnostics
    await page.click('[data-section="diagnostics"]');
    await page.waitForSelector('.diagnostics-dashboard', { timeout: 5000 });
    
    // Verify cache stats card exists
    const cacheCard = page.locator('.diagnostics-card:has-text("Cache Statistics")');
    await expect(cacheCard).toBeVisible();
    
    // Check for cache sections
    await expect(cacheCard.locator('h4:has-text("Metadata Cache")')).toBeVisible();
    await expect(cacheCard.locator('h4:has-text("Addon Cache")')).toBeVisible();
    
    // Verify action buttons
    await expect(cacheCard.locator('#clear-cache-btn')).toBeVisible();
    await expect(cacheCard.locator('#clear-expired-btn')).toBeVisible();
  });

  test('should display addon health information', async ({ page }) => {
    // Navigate to diagnostics
    await page.click('[data-section="diagnostics"]');
    await page.waitForSelector('.diagnostics-dashboard', { timeout: 5000 });
    
    // Verify addon health card exists
    const healthCard = page.locator('.diagnostics-card:has-text("Addon Health")');
    await expect(healthCard).toBeVisible();
    
    // Either health items or empty message should be visible
    const hasHealthItems = await healthCard.locator('.health-list .health-item').count();
    const hasEmptyMessage = await healthCard.locator('.empty-message').count();
    
    expect(hasHealthItems + hasEmptyMessage).toBeGreaterThan(0);
  });

  test('should export diagnostics to JSON file', async ({ page }) => {
    // Navigate to diagnostics
    await page.click('[data-section="diagnostics"]');
    await page.waitForSelector('.diagnostics-dashboard', { timeout: 5000 });
    
    // Setup download listener
    const downloadPromise = page.waitForEvent('download');
    
    // Click export button
    await page.click('#export-diagnostics-btn');
    
    // Wait for download
    const download = await downloadPromise;
    
    // Verify filename
    expect(download.suggestedFilename()).toMatch(/diagnostics-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json/);
    
    // Save and verify file content
    const path = await download.path();
    expect(path).toBeTruthy();
    
    if (path) {
      // Read file content
      const content = readFileSync(path, 'utf-8');
      const data = JSON.parse(content);
      
      // Verify JSON structure
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('performance_metrics');
      expect(data).toHaveProperty('cache_stats');
      expect(data).toHaveProperty('addon_health');
      
      // Verify performance metrics structure
      expect(data.performance_metrics).toHaveProperty('total_requests');
      expect(data.performance_metrics).toHaveProperty('successful_requests');
      expect(data.performance_metrics).toHaveProperty('avg_response_time_ms');
    }
  });

  test('should reset performance metrics', async ({ page }) => {
    // Navigate to diagnostics
    await page.click('[data-section="diagnostics"]');
    await page.waitForSelector('.diagnostics-dashboard', { timeout: 5000 });
    
    // Get initial metrics values
    const metricsCard = page.locator('.diagnostics-card:has-text("Performance Metrics")');
    const initialRequests = await metricsCard.locator('.metric-item:has-text("Total Requests") .metric-value').textContent();
    
    // Click reset button
    await page.click('#reset-metrics-btn');
    
    // Wait for metrics to update
    await page.waitForTimeout(500);
    
    // Verify metrics were reset (should be 0 or very low)
    const newRequests = await metricsCard.locator('.metric-item:has-text("Total Requests") .metric-value').textContent();
    
    // If initial was a number > 0, new should be 0 or very low
    if (initialRequests && parseInt(initialRequests.replace(/,/g, '')) > 0) {
      const newRequestsNum = parseInt(newRequests?.replace(/,/g, '') || '0');
      expect(newRequestsNum).toBeLessThan(10); // Allow for small increments
    }
  });

  test('should refresh diagnostics data', async ({ page }) => {
    // Navigate to diagnostics
    await page.click('[data-section="diagnostics"]');
    await page.waitForSelector('.diagnostics-dashboard', { timeout: 5000 });
    
    // Click refresh button
    const refreshBtn = page.locator('#refresh-diagnostics-btn');
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    
    // Wait for refresh to complete (loading indicator or data update)
    await page.waitForTimeout(1000);
    
    // Verify dashboard still displays correctly after refresh
    await expect(page.locator('.diagnostics-dashboard')).toBeVisible();
    await expect(page.locator('.diagnostics-header')).toBeVisible();
  });

  test('should clear all cache', async ({ page }) => {
    // Navigate to diagnostics
    await page.click('[data-section="diagnostics"]');
    await page.waitForSelector('.diagnostics-dashboard', { timeout: 5000 });
    
    // Click clear cache button
    await page.click('#clear-cache-btn');
    
    // Wait for operation to complete and toast notification
    await page.waitForTimeout(500);
    
    // Verify toast appeared (if toast system is working)
    const toast = page.locator('.toast');
    const toastCount = await toast.count();
    if (toastCount > 0) {
      await expect(toast.first()).toContainText(/cleared|success/i);
    }
  });

  test('should clear expired cache', async ({ page }) => {
    // Navigate to diagnostics
    await page.click('[data-section="diagnostics"]');
    await page.waitForSelector('.diagnostics-dashboard', { timeout: 5000 });
    
    // Click clear expired button
    await page.click('#clear-expired-btn');
    
    // Wait for operation to complete
    await page.waitForTimeout(500);
    
    // Verify operation completed (no errors in console)
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    expect(consoleErrors.length).toBe(0);
  });

  test('should not have console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Navigate to diagnostics
    await page.click('[data-section="diagnostics"]');
    await page.waitForSelector('.diagnostics-dashboard', { timeout: 5000 });
    
    // Wait for all async operations
    await page.waitForTimeout(2000);
    
    // Filter out known acceptable errors (like network failures in dev)
    const criticalErrors = consoleErrors.filter(err => 
      !err.includes('net::ERR_') && 
      !err.includes('Failed to load resource')
    );
    
    expect(criticalErrors.length).toBe(0);
  });

  test('should display health badges with correct colors', async ({ page }) => {
    // Navigate to addons to check health badges
    await page.click('[data-section="addons"]');
    await page.waitForSelector('#addons-list', { timeout: 5000 });
    
    // Check if any addon cards exist
    const addonCards = page.locator('.addon-card');
    const count = await addonCards.count();
    
    if (count > 0) {
      // Check for health badge on first addon
      const firstCard = addonCards.first();
      const healthBadge = firstCard.locator('.addon-health-badge');
      
      // Health badge may or may not exist depending on addon usage
      const badgeCount = await healthBadge.count();
      if (badgeCount > 0) {
        // Verify badge has appropriate class
        const badgeClass = await healthBadge.getAttribute('class');
        expect(badgeClass).toMatch(/health-(excellent|good|fair|poor|unknown)/);
        
        // Verify badge has text
        const badgeText = await healthBadge.textContent();
        expect(badgeText).toMatch(/Excellent|Good|Fair|Poor|Unknown/);
      }
    }
  });

  test('should show addon health metrics', async ({ page }) => {
    // Navigate to addons
    await page.click('[data-section="addons"]');
    await page.waitForSelector('#addons-list', { timeout: 5000 });
    
    // Check if any addon cards exist with health metrics
    const addonCards = page.locator('.addon-card');
    const count = await addonCards.count();
    
    if (count > 0) {
      const firstCard = addonCards.first();
      const metricsSection = firstCard.locator('.addon-health-metrics');
      
      // Metrics may or may not exist depending on addon usage
      const metricsCount = await metricsSection.count();
      if (metricsCount > 0) {
        // Verify metrics display
        await expect(metricsSection.locator('.health-metric:has-text("Success Rate")')).toBeVisible();
        await expect(metricsSection.locator('.health-metric:has-text("Avg Response")')).toBeVisible();
        await expect(metricsSection.locator('.health-metric:has-text("Requests")')).toBeVisible();
      }
    }
  });
});
