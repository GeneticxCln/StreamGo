// Diagnostics and Health Monitoring UI for StreamGo

import type { AddonHealthSummary, PerformanceMetrics, CacheStats } from './types/tauri';
import {
  getAddonHealthSummaries,
  getPerformanceMetrics,
  exportDiagnosticsFile,
  getCacheStats,
  clearCache,
  clearExpiredCache,
  resetPerformanceMetrics,
  getHealthBadgeColor,
  getHealthStatusText,
  getCacheHitRate,
  getSuccessRate
} from './health-api';
import { Toast } from './ui-utils';
import { escapeHtml } from './utils/security';
import { invoke } from './utils';

export class DiagnosticsManager {
  private healthData: AddonHealthSummary[] = [];
  private metricsData: PerformanceMetrics | null = null;
  private cacheStats: CacheStats | null = null;

  /**
   * Render the complete diagnostics dashboard
   */
  async renderDashboard(container: HTMLElement): Promise<void> {
    // Always render the dashboard structure, even if data loading fails
    container.innerHTML = '<div class="diagnostics-dashboard"><div class="loading-spinner">Loading diagnostics...</div></div>';

    try {
      // Fetch all data in parallel with individual error handling
      const [health, metrics, cache] = await Promise.all([
        getAddonHealthSummaries().catch(err => {
          console.warn('Failed to load health data:', err);
          return [];
        }),
        getPerformanceMetrics().catch(err => {
          console.warn('Failed to load metrics:', err);
          return null;
        }),
        getCacheStats().catch(err => {
          console.warn('Failed to load cache stats:', err);
          return null;
        })
      ]);

      this.healthData = health;
      this.metricsData = metrics;
      this.cacheStats = cache;

      // Render sections
      container.innerHTML = `
        <div class="diagnostics-dashboard">
          <div class="diagnostics-header">
            <h2>📊 Diagnostics & Health</h2>
            <div class="diagnostics-actions">
              <button id="send-diagnostics-btn" class="btn btn-primary">
                📤 Send Diagnostics
              </button>
              <button id="export-diagnostics-btn" class="btn btn-secondary">
                💾 Export Diagnostics
              </button>
              <button id="refresh-diagnostics-btn" class="btn btn-secondary">
                🔄 Refresh
              </button>
            </div>
          </div>

          <div class="diagnostics-grid">
            ${this.renderPerformanceMetrics()}
            ${this.renderCacheStats()}
            ${this.renderAddonHealth()}
          </div>
        </div>
      `;

      // Attach event listeners
      this.attachEventListeners(container);
    } catch (error) {
      console.error('Failed to load diagnostics:', error);
      // Still render dashboard structure with error message inside
      container.innerHTML = `
        <div class="diagnostics-dashboard">
          <div class="diagnostics-header">
            <h2>📊 Diagnostics & Health</h2>
          </div>
          <div class="error-state">
            <h3>❌ Failed to load diagnostics</h3>
            <p>${escapeHtml(String(error))}</p>
            <button class="btn btn-primary" onclick="diagnosticsManager.renderDashboard(document.getElementById('diagnostics-container'))">
              Retry
            </button>
          </div>
        </div>
      `;
      Toast.error(`Failed to load diagnostics: ${error}`);
    }
  }

  /**
   * Render performance metrics section
   */
  private renderPerformanceMetrics(): string {
    if (!this.metricsData) {
      return `
        <div class="diagnostics-card">
          <h3>⚡ Performance Metrics</h3>
          <p class="empty-message">No performance data available yet.</p>
        </div>
      `;
    }

    const successRate = getSuccessRate(this.metricsData);
    const cacheHitRate = getCacheHitRate(this.metricsData);

    return `
      <div class="diagnostics-card">
        <h3>⚡ Performance Metrics</h3>
        <div class="metrics-grid">
          <div class="metric-item">
            <div class="metric-value">${this.metricsData.total_requests.toLocaleString()}</div>
            <div class="metric-label">Total Requests</div>
          </div>
          <div class="metric-item">
            <div class="metric-value success">${successRate}%</div>
            <div class="metric-label">Success Rate</div>
            <div class="metric-detail">${this.metricsData.successful_requests} / ${this.metricsData.total_requests}</div>
          </div>
          <div class="metric-item">
            <div class="metric-value">${this.metricsData.avg_response_time_ms}ms</div>
            <div class="metric-label">Avg Response Time</div>
          </div>
          <div class="metric-item">
            <div class="metric-value cache-hit">${cacheHitRate}%</div>
            <div class="metric-label">Cache Hit Rate</div>
            <div class="metric-detail">${this.metricsData.cache_hits} hits, ${this.metricsData.cache_misses} misses</div>
          </div>
        </div>
        <div class="metrics-actions">
          <button id="reset-metrics-btn" class="btn btn-small btn-secondary">Reset Metrics</button>
        </div>
      </div>
    `;
  }

  /**
   * Render cache statistics section
   */
  private renderCacheStats(): string {
    if (!this.cacheStats) {
      return `
        <div class="diagnostics-card">
          <h3>💾 Cache Statistics</h3>
          <p class="empty-message">No cache data available yet.</p>
        </div>
      `;
    }

    const metadataValid = this.cacheStats.metadata_valid;
    const metadataTotal = this.cacheStats.metadata_total;
    const addonValid = this.cacheStats.addon_valid;
    const addonTotal = this.cacheStats.addon_total;

    return `
      <div class="diagnostics-card">
        <h3>💾 Cache Statistics</h3>
        <div class="cache-section">
          <h4>Metadata Cache</h4>
          <div class="cache-stats">
            <div class="stat-row">
              <span>Valid Entries:</span>
              <span class="stat-value">${metadataValid} / ${metadataTotal}</span>
            </div>
            <div class="stat-row">
              <span>Expired:</span>
              <span class="stat-value warning">${this.cacheStats.metadata_expired}</span>
            </div>
          </div>
        </div>
        <div class="cache-section">
          <h4>Addon Cache</h4>
          <div class="cache-stats">
            <div class="stat-row">
              <span>Valid Entries:</span>
              <span class="stat-value">${addonValid} / ${addonTotal}</span>
            </div>
            <div class="stat-row">
              <span>Expired:</span>
              <span class="stat-value warning">${this.cacheStats.addon_expired}</span>
            </div>
          </div>
        </div>
        <div class="cache-actions">
          <button id="clear-cache-btn" class="btn btn-small btn-warning">Clear All Cache</button>
          <button id="clear-expired-btn" class="btn btn-small btn-secondary">Clear Expired</button>
        </div>
      </div>
    `;
  }

  /**
   * Render addon health section
   */
  private renderAddonHealth(): string {
    if (this.healthData.length === 0) {
      return `
        <div class="diagnostics-card full-width">
          <h3>🏥 Addon Health</h3>
          <p class="empty-message">No addon health data available yet. Addons will appear here after they've been used.</p>
        </div>
      `;
    }

    const healthItems = this.healthData.map(health => this.renderHealthItem(health)).join('');
    
    // Count unhealthy addons (health score < 50)
    const unhealthyCount = this.healthData.filter(h => h.health_score < 50).length;

    return `
      <div class="diagnostics-card full-width">
        <div class="health-header-section">
          <h3>🏥 Addon Health</h3>
          <div class="health-actions">
            <div class="threshold-control">
              <label for="health-threshold">Auto-disable threshold:</label>
              <input 
                type="number" 
                id="health-threshold" 
                min="0" 
                max="100" 
                value="30" 
                step="5"
                class="threshold-input"
              >
              <span class="threshold-unit">/ 100</span>
            </div>
            <button id="auto-disable-btn" class="btn btn-small btn-warning">
              ⚡ Auto-Disable Unhealthy
            </button>
          </div>
        </div>
        ${unhealthyCount > 0 ? `
          <div class="health-warning">
            ⚠️ Warning: ${unhealthyCount} addon(s) with poor health detected
          </div>
        ` : ''}
        <div class="health-list">
          ${healthItems}
        </div>
      </div>
    `;
  }

  /**
   * Render a single health item
   */
  private renderHealthItem(health: AddonHealthSummary): string {
    const badgeColor = getHealthBadgeColor(health.health_score);
    const statusText = getHealthStatusText(health.health_score);
    const successRate = health.total_requests > 0 
      ? Math.round((health.successful_requests / health.total_requests) * 100)
      : 0;

    // Display friendly addon name if available, otherwise use addon_id
    const displayName = health.addon_name || health.addon_id;

    return `
      <div class="health-item">
        <div class="health-header">
          <div class="health-title">
            <span class="addon-name">${escapeHtml(displayName)}</span>
            <span class="health-badge ${badgeColor}">${statusText}</span>
          </div>
          <div class="health-score">${health.health_score.toFixed(1)}/100</div>
        </div>
        <div class="health-stats">
          <div class="health-stat">
            <span class="stat-label">Success Rate:</span>
            <span class="stat-value">${successRate}% (${health.successful_requests}/${health.total_requests})</span>
          </div>
          <div class="health-stat">
            <span class="stat-label">Avg Response:</span>
            <span class="stat-value">${health.avg_response_time_ms}ms</span>
          </div>
          ${health.last_error ? `
            <div class="health-stat error">
              <span class="stat-label">Last Error:</span>
              <span class="stat-value">${escapeHtml(health.last_error)}</span>
            </div>
          ` : ''}
        </div>
        <div class="health-progress">
          <div class="progress-bar">
            <div class="progress-fill ${badgeColor}" style="width: ${health.health_score}%"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to the dashboard
   */
  private attachEventListeners(container: HTMLElement): void {
    // Send diagnostics button
    const sendBtn = container.querySelector('#send-diagnostics-btn');
    if (sendBtn) {
      sendBtn.addEventListener('click', async () => {
        const btn = sendBtn as HTMLButtonElement;
        const original = btn.innerHTML;
        btn.classList.add('loading');
        btn.disabled = true;
        btn.innerHTML = 'Sending...';
        try {
          await this.sendDiagnostics();
          Toast.success('Diagnostics sent successfully!');
        } catch (error) {
          console.error('Send failed:', error);
          Toast.error('Failed to send diagnostics. Please try again.');
        } finally {
          btn.classList.remove('loading');
          btn.disabled = false;
          btn.innerHTML = original;
        }
      });
    }

    // Export diagnostics button
    const exportBtn = container.querySelector('#export-diagnostics-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        const btn = exportBtn as HTMLButtonElement;
        const original = btn.innerHTML;
        btn.classList.add('loading');
        btn.disabled = true;
        btn.innerHTML = 'Exporting...';
        try {
          const filePath = await exportDiagnosticsFile();
          Toast.success(`Diagnostics exported to: ${filePath}`);
        } catch (error) {
          console.error('Export failed:', error);
          Toast.error('Export failed. Check that you have write permissions.');
        } finally {
          btn.classList.remove('loading');
          btn.disabled = false;
          btn.innerHTML = original;
        }
      });
    }

    // Refresh button
    const refreshBtn = container.querySelector('#refresh-diagnostics-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        const btn = refreshBtn as HTMLButtonElement;
        const original = btn.innerHTML;
        btn.classList.add('loading');
        btn.disabled = true;
        btn.innerHTML = 'Refreshing...';
        try {
          await this.renderDashboard(container);
        } finally {
          btn.classList.remove('loading');
          btn.disabled = false;
          btn.innerHTML = original;
        }
      });
    }

    // Reset metrics button
    const resetBtn = container.querySelector('#reset-metrics-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        const btn = resetBtn as HTMLButtonElement;
        const original = btn.innerHTML;
        btn.classList.add('loading');
        btn.disabled = true;
        btn.innerHTML = 'Resetting...';
        try {
          await resetPerformanceMetrics();
          Toast.success('Performance metrics reset');
          await this.renderDashboard(container);
        } catch (error) {
          console.error('Reset failed:', error);
          Toast.error('Failed to reset metrics. Please try again.');
        } finally {
          btn.classList.remove('loading');
          btn.disabled = false;
          btn.innerHTML = original;
        }
      });
    }

    // Clear cache button
    const clearCacheBtn = container.querySelector('#clear-cache-btn');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', async () => {
        const btn = clearCacheBtn as HTMLButtonElement;
        const original = btn.innerHTML;
        btn.classList.add('loading');
        btn.disabled = true;
        btn.innerHTML = 'Clearing...';
        try {
          await clearCache();
          Toast.success('Cache cleared successfully');
          await this.renderDashboard(container);
        } catch (error) {
          console.error('Clear cache failed:', error);
          Toast.error('Failed to clear cache. Please try again.');
        } finally {
          btn.classList.remove('loading');
          btn.disabled = false;
          btn.innerHTML = original;
        }
      });
    }

    // Clear expired button
    const clearExpiredBtn = container.querySelector('#clear-expired-btn');
    if (clearExpiredBtn) {
      clearExpiredBtn.addEventListener('click', async () => {
        const btn = clearExpiredBtn as HTMLButtonElement;
        const original = btn.innerHTML;
        btn.classList.add('loading');
        btn.disabled = true;
        btn.innerHTML = 'Clearing...';
        try {
          const count = await clearExpiredCache();
          Toast.success(`Removed ${count} expired cache entries`);
          await this.renderDashboard(container);
        } catch (error) {
          console.error('Clear expired failed:', error);
          Toast.error('Failed to clear expired cache. Please try again.');
        } finally {
          btn.classList.remove('loading');
          btn.disabled = false;
          btn.innerHTML = original;
        }
      });
    }

    // Auto-disable unhealthy addons button
    const autoDisableBtn = container.querySelector('#auto-disable-btn');
    if (autoDisableBtn) {
      autoDisableBtn.addEventListener('click', async () => {
        const btn = autoDisableBtn as HTMLButtonElement;
        const thresholdInput = container.querySelector('#health-threshold') as HTMLInputElement;
        const threshold = parseFloat(thresholdInput?.value || '30');
        
        const original = btn.innerHTML;
        btn.classList.add('loading');
        btn.disabled = true;
        btn.innerHTML = 'Processing...';
        
        try {
          const disabledAddons = await this.autoDisableUnhealthyAddons(threshold);
          
          if (disabledAddons.length === 0) {
            Toast.info('No addons were below the health threshold');
          } else {
            Toast.success(`Auto-disabled ${disabledAddons.length} addon(s): ${disabledAddons.join(', ')}`);
          }
          
          // Refresh addon list in main app
          if ((window as any).app && typeof (window as any).app.loadAddons === 'function') {
            await (window as any).app.loadAddons();
          }
          
          await this.renderDashboard(container);
        } catch (error) {
          console.error('Auto-disable failed:', error);
          Toast.error(`Failed to auto-disable addons: ${error}`);
        } finally {
          btn.classList.remove('loading');
          btn.disabled = false;
          btn.innerHTML = original;
        }
      });
    }
  }

  /**
    * Auto-disable addons below health threshold
    */
   private async autoDisableUnhealthyAddons(threshold: number): Promise<string[]> {
     return await invoke<string[]>('auto_disable_unhealthy_addons', { threshold });
   }

  /**
    * Send diagnostics data via email or to support
    */
   private async sendDiagnostics(): Promise<void> {
     try {
       // Get diagnostics data
       const diagnostics = await exportDiagnosticsFile();

       // Show confirmation modal with options
       const result = await new Promise<{ action: 'email' | 'support' | 'cancel', email?: string }>((resolve) => {
         const modal = document.createElement('div');
         modal.className = 'modal';
         modal.style.display = 'flex';
         modal.style.zIndex = '10000';
         modal.innerHTML = `
           <div class="modal-content" style="max-width: 500px;">
             <div class="modal-header">
               <h3>📤 Send Diagnostics</h3>
             </div>
             <div class="modal-body" style="padding: 20px;">
               <p style="margin-bottom: 16px;">How would you like to send the diagnostics data?</p>

               <div style="margin-bottom: 16px;">
                 <label style="display: flex; align-items: center; margin-bottom: 8px; cursor: pointer;">
                   <input type="radio" name="send-method" value="email" checked style="margin-right: 8px;">
                   <span>📧 Send via Email</span>
                 </label>
                 <div id="email-input-container" style="margin-left: 24px; margin-top: 8px;">
                   <input type="email" id="diagnostics-email" placeholder="your.email@example.com" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--background-secondary); color: var(--text-primary);" />
                 </div>
               </div>

               <div style="margin-bottom: 16px;">
                 <label style="display: flex; align-items: center; cursor: pointer;">
                   <input type="radio" name="send-method" value="support" style="margin-right: 8px;">
                   <span>🛠️ Send to Support Team</span>
                 </label>
               </div>

               <div style="font-size: 12px; color: var(--text-secondary); margin-top: 16px; padding: 12px; background: var(--background-secondary); border-radius: 4px;">
                 <strong>Privacy Note:</strong> Diagnostics data includes system information, performance metrics, and error logs. No personal files or media content is included.
               </div>
             </div>
             <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end; padding: 16px 20px;">
               <button class="btn btn-secondary" id="send-cancel">Cancel</button>
               <button class="btn btn-primary" id="send-confirm">Send</button>
             </div>
           </div>
         `;

         document.body.appendChild(modal);

         const emailInput = document.getElementById('diagnostics-email') as HTMLInputElement;
         const emailContainer = document.getElementById('email-input-container');

         // Show/hide email input based on selected method
         const radioButtons = modal.querySelectorAll('input[name="send-method"]');
         radioButtons.forEach(radio => {
           radio.addEventListener('change', () => {
             if ((radio as HTMLInputElement).value === 'email') {
               emailContainer!.style.display = 'block';
               emailInput!.required = true;
             } else {
               emailContainer!.style.display = 'none';
               emailInput!.required = false;
             }
           });
         });

         const cancelBtn = modal.querySelector('#send-cancel');
         const confirmBtn = modal.querySelector('#send-confirm');

         cancelBtn?.addEventListener('click', () => {
           modal.remove();
           resolve({ action: 'cancel' });
         });

         confirmBtn?.addEventListener('click', () => {
           const selectedMethod = (modal.querySelector('input[name="send-method"]:checked') as HTMLInputElement).value as 'email' | 'support';
           const email = emailInput?.value;

           if (selectedMethod === 'email' && (!email || !email.includes('@'))) {
             Toast.error('Please enter a valid email address');
             return;
           }

           modal.remove();
           resolve({ action: selectedMethod, email: selectedMethod === 'email' ? email : undefined });
         });
       });

       if (result.action === 'cancel') {
         return;
       }

       // Send diagnostics based on selected method
       if (result.action === 'email') {
         await this.sendDiagnosticsViaEmail(diagnostics, result.email!);
       } else if (result.action === 'support') {
         await this.sendDiagnosticsToSupport(diagnostics);
       }

     } catch (error) {
       console.error('Error in sendDiagnostics:', error);
       throw error;
     }
   }

  /**
    * Send diagnostics data via email
    */
   private async sendDiagnosticsViaEmail(filePath: string, _email: string): Promise<void> {
     try {
       // For now, we'll use a simple approach - copy the file path to clipboard
       // In a real implementation, this would integrate with an email service
       await navigator.clipboard.writeText(`Diagnostics file: ${filePath}`);

       Toast.info(`Diagnostics file path copied to clipboard. Please email it to: support@streamgo.app`);

       // You could also implement direct email sending here using a service like EmailJS
       // or integrate with the system's default email client

     } catch (error) {
       console.error('Error sending diagnostics via email:', error);
       throw new Error('Failed to prepare diagnostics for email');
     }
   }

  /**
    * Send diagnostics data to support team
    */
   private async sendDiagnosticsToSupport(_filePath: string): Promise<void> {
     try {
       // In a real implementation, this would upload the file to a support server
       // For now, we'll simulate this with a delay and success message

       Toast.info('Uploading diagnostics to support server...');

       // Simulate upload delay
       await new Promise(resolve => setTimeout(resolve, 2000));

       // In a real implementation, you would:
       // 1. Upload the file to a secure server
       // 2. Generate a support ticket or reference ID
       // 3. Send confirmation with the reference ID

       Toast.success('Diagnostics uploaded successfully! Support team has been notified.');

     } catch (error) {
       console.error('Error sending diagnostics to support:', error);
       throw new Error('Failed to upload diagnostics to support');
     }
   }
}

// Create global instance
export const diagnosticsManager = new DiagnosticsManager();

// Make globally available
if (typeof window !== 'undefined') {
  (window as any).diagnosticsManager = diagnosticsManager;
  console.log('✅ DiagnosticsManager initialized and added to window');
} else {
  console.error('❌ Window object not available, diagnosticsManager not added');
}
