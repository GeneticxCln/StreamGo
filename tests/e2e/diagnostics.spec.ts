import { test, expect } from '@playwright/test';
import { dismissOnboardingModal, clearToasts } from './helpers';

test.describe('Diagnostics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri API before loading the page
    await page.addInitScript(() => {
      const mockPerformanceMetrics = {
        total_requests: 150,
        successful_requests: 142,
        failed_requests: 8,
        avg_response_time_ms: 245,
        cache_hits: 89,
        cache_misses: 61
      };

      const mockCacheStats = {
        metadata_total: 120,
        metadata_valid: 100,
        metadata_expired: 20,
        addon_total: 45,
        addon_valid: 40,
        addon_expired: 5
      };

      const mockAddonHealthSummaries = [
        {
          addon_id: 'test-addon-1',
          last_check: Math.floor(Date.now() / 1000),
          success_rate: 0.98,
          avg_response_time_ms: 150,
          total_requests: 100,
          successful_requests: 98,
          failed_requests: 2,
          last_error: null,
          health_score: 98.5
        },
        {
          addon_id: 'test-addon-2',
          last_check: Math.floor(Date.now() / 1000),
          success_rate: 0.65,
          avg_response_time_ms: 850,
          total_requests: 50,
          successful_requests: 33,
          failed_requests: 17,
          last_error: 'Connection timeout',
          health_score: 65.0
        }
      ];

      const mockDiagnostics = {
        timestamp: Math.floor(Date.now() / 1000),
        app_version: '0.2.0',
        os: 'Linux',
        arch: 'x86_64',
        uptime_seconds: 3600,
        log_path: '/home/user/.local/share/StreamGo/logs',
        metrics: mockPerformanceMetrics
      };

      // Mock the Tauri API
      const mockInvoke = async (cmd: string, args?: any) => {
        console.log(`Mock invoke called: ${cmd}`, args);
        
        switch (cmd) {
          case 'get_performance_metrics':
            return mockPerformanceMetrics;
            
          case 'get_cache_stats':
            return mockCacheStats;
            
          case 'get_addon_health_summaries':
            return mockAddonHealthSummaries;
            
          case 'export_diagnostics':
            return mockDiagnostics;
            
          case 'export_diagnostics_file':
            return '/tmp/diagnostics-12345.json';
            
          case 'reset_performance_metrics':
            // Reset metrics to zero
            mockPerformanceMetrics.total_requests = 0;
            mockPerformanceMetrics.successful_requests = 0;
            mockPerformanceMetrics.failed_requests = 0;
            mockPerformanceMetrics.avg_response_time_ms = 0;
            mockPerformanceMetrics.cache_hits = 0;
            mockPerformanceMetrics.cache_misses = 0;
            return {};
            
          case 'clear_cache':
            return 'Cache cleared successfully';
            
          case 'clear_expired_cache':
            return 25; // Number of expired entries cleared
            
          case 'get_addons':
            return [];
            
          case 'get_continue_watching':
            return [];
            
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
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Dismiss onboarding modal if present
    await dismissOnboardingModal(page);
    await clearToasts(page);
    
    // Navigate to diagnostics section
    await page.click('.nav-item[data-section="diagnostics"]');
    await page.waitForTimeout(2000);
    
    // Wait for diagnostics to start loading
    await page.waitForSelector('#diagnostics-container', { state: 'visible', timeout: 5000 });
  });

  test('should display diagnostics section', async ({ page }) => {
    // Check that diagnostics container is visible
    await expect(page.locator('#diagnostics-container')).toBeVisible();
    
    // Wait for dashboard to render or show error
    await page.waitForTimeout(3000);
    
    // Check if dashboard rendered (it might show error or loading state)
    const dashboard = page.locator('.diagnostics-dashboard');
    const hasContent = await dashboard.count() > 0;
    
    if (hasContent) {
      await expect(dashboard).toBeVisible();
    }
  });

  test('should display performance metrics', async ({ page }) => {
    // Check that metrics are displayed
    await expect(page.locator('.diagnostics-card').first()).toBeVisible();
    
    // Verify specific metrics are shown
    const dashboard = page.locator('.diagnostics-dashboard');
    await expect(dashboard).toContainText('150'); // total requests
    await expect(dashboard).toContainText('142'); // successful
    await expect(dashboard).toContainText('245'); // avg response time
  });

  test('should display cache statistics', async ({ page }) => {
    // Check cache stats are displayed
    await expect(page.locator('.cache-stats').first()).toBeVisible();
    
    // Verify cache numbers
    const dashboard = page.locator('.diagnostics-dashboard');
    await expect(dashboard).toContainText('120'); // metadata total
    await expect(dashboard).toContainText('45'); // addon total
  });

  test('should display addon health summaries', async ({ page }) => {
    // Check addon health section
    await expect(page.locator('.health-list')).toBeVisible();
    
    // Verify addon health entries
    await expect(page.locator('.health-item')).toHaveCount(2);
    
    // Check first addon (high score)
    const addon1 = page.locator('.health-item').first();
    await expect(addon1).toContainText('test-addon-1');
    await expect(addon1).toContainText('98'); // health score or success rate
    
    // Check second addon (lower score)
    const addon2 = page.locator('.health-item').nth(1);
    await expect(addon2).toContainText('test-addon-2');
    await expect(addon2).toContainText('65'); // health score
  });

  test('should export diagnostics', async ({ page }) => {
    // Find and click export button
    const exportBtn = page.locator('#export-diagnostics-btn');
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();
    
    // Wait for export to complete (toast or confirmation)
    await expect(page.locator('.toast.success')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.toast.success')).toContainText(/exported|saved/i);
  });

  test('should reset performance metrics', async ({ page }) => {
    // Find and click reset button
    const resetBtn = page.locator('#reset-metrics-btn');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
    
    // Confirm reset (if modal is used)
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }
    
    // Wait for reset confirmation
    await expect(page.locator('.toast.success')).toBeVisible({ timeout: 5000 });
  });

  test('should refresh diagnostics data', async ({ page }) => {
    // Find and click refresh button
    const refreshBtn = page.locator('#refresh-diagnostics-btn');
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    
    // Wait for refresh to complete
    await page.waitForTimeout(1000);
    
    // Dashboard should still be visible
    await expect(page.locator('.diagnostics-dashboard')).toBeVisible();
  });

  test('should calculate and display success rate', async ({ page }) => {
    // Success rate should be visible: 142/150 = 94.67%
    const dashboard = page.locator('.diagnostics-dashboard');
    await expect(dashboard).toContainText(/94|95/); // Accept 94% or 95% (rounding)
  });

  test('should display cache hit rate', async ({ page }) => {
    // Cache hit rate: 89/(89+61) = 59.33%
    const dashboard = page.locator('.diagnostics-dashboard');
    await expect(dashboard).toContainText(/59|60/); // Accept 59% or 60%
  });
});
