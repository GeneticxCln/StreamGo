/**
 * Telemetry System with User Consent
 * 
 * Collects anonymous usage statistics to improve StreamGo
 * All data collection requires explicit user consent
 */

import { errorLogger } from './error-logger';

export interface TelemetryEvent {
    event_type: string;
    timestamp: number;
    properties?: Record<string, any>;
}

export interface TelemetryConfig {
    enabled: boolean;
    anonymousId: string;
    sessionId: string;
}

class TelemetryManager {
    private config: TelemetryConfig | null = null;
    private eventQueue: TelemetryEvent[] = [];
    private flushInterval: number = 30000; // 30 seconds
    private flushTimer: number | null = null;

    constructor() {
        this.loadConfig();
    }

    /**
     * Initialize telemetry system
     */
    async init(): Promise<void> {
        if (!this.isEnabled()) {
            console.log('[Telemetry] Disabled by user preference');
            return;
        }

        this.generateSessionId();
        this.startFlushTimer();
        
        // Track app start
        this.track('app_started', {
            platform: this.getPlatform(),
            version: '0.1.0',
        });

        errorLogger.logInfo('Telemetry initialized', {
            action: 'telemetry_init',
            enabled: true,
        });
    }

    /**
     * Load telemetry configuration
     */
    private loadConfig(): void {
        try {
            const stored = localStorage.getItem('telemetry_config');
            if (stored) {
                this.config = JSON.parse(stored);
            } else {
                // Default: disabled until user opts in
                this.config = {
                    enabled: false,
                    anonymousId: this.generateAnonymousId(),
                    sessionId: '',
                };
                this.saveConfig();
            }
        } catch (error) {
            console.error('[Telemetry] Failed to load config:', error);
            this.config = {
                enabled: false,
                anonymousId: this.generateAnonymousId(),
                sessionId: '',
            };
        }
    }

    /**
     * Save telemetry configuration
     */
    private saveConfig(): void {
        if (!this.config) return;

        try {
            localStorage.setItem('telemetry_config', JSON.stringify(this.config));
        } catch (error) {
            console.error('[Telemetry] Failed to save config:', error);
        }
    }

    /**
     * Generate anonymous user ID
     */
    private generateAnonymousId(): string {
        return 'anon_' + Math.random().toString(36).substring(2, 15) +
               Math.random().toString(36).substring(2, 15);
    }

    /**
     * Generate session ID
     */
    private generateSessionId(): void {
        if (!this.config) return;
        
        this.config.sessionId = 'sess_' + Date.now() + '_' +
                                Math.random().toString(36).substring(2, 9);
        this.saveConfig();
    }

    /**
     * Check if telemetry is enabled
     */
    isEnabled(): boolean {
        return this.config?.enabled ?? false;
    }

    /**
     * Enable telemetry (user opt-in)
     */
    enable(): void {
        if (!this.config) return;

        this.config.enabled = true;
        this.saveConfig();
        this.init();

        errorLogger.logInfo('Telemetry enabled by user', {
            action: 'telemetry_enabled',
        });
    }

    /**
     * Disable telemetry (user opt-out)
     */
    disable(): void {
        if (!this.config) return;

        this.config.enabled = false;
        this.saveConfig();
        this.stopFlushTimer();
        this.eventQueue = [];

        errorLogger.logInfo('Telemetry disabled by user', {
            action: 'telemetry_disabled',
        });
    }

    /**
     * Track an event
     */
    track(eventType: string, properties?: Record<string, any>): void {
        if (!this.isEnabled()) return;

        const event: TelemetryEvent = {
            event_type: eventType,
            timestamp: Date.now(),
            properties: this.sanitizeProperties(properties),
        };

        this.eventQueue.push(event);

        // Flush if queue is large
        if (this.eventQueue.length >= 50) {
            this.flush();
        }
    }

    /**
     * Sanitize properties to remove PII
     */
    private sanitizeProperties(properties?: Record<string, any>): Record<string, any> | undefined {
        if (!properties) return undefined;

        // Remove potentially sensitive keys
        const sanitized = { ...properties };
        const sensitiveKeys = ['email', 'password', 'token', 'api_key', 'username', 'userId'];
        
        sensitiveKeys.forEach(key => {
            if (key in sanitized) {
                delete sanitized[key];
            }
        });

        return sanitized;
    }

    /**
     * Get platform information
     */
    private getPlatform(): string {
        const ua = navigator.userAgent;
        if (ua.includes('Win')) return 'windows';
        if (ua.includes('Mac')) return 'macos';
        if (ua.includes('Linux')) return 'linux';
        return 'unknown';
    }

    /**
     * Start automatic flush timer
     */
    private startFlushTimer(): void {
        if (this.flushTimer) return;

        this.flushTimer = window.setInterval(() => {
            this.flush();
        }, this.flushInterval);
    }

    /**
     * Stop automatic flush timer
     */
    private stopFlushTimer(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
    }

    /**
     * Flush events to server
     */
    private async flush(): Promise<void> {
        if (this.eventQueue.length === 0) return;
        if (!this.isEnabled()) return;

        const events = [...this.eventQueue];
        this.eventQueue = [];

        try {
            // In production, send to analytics endpoint
            // For now, just log to console (development)
            if (process.env.NODE_ENV === 'development') {
                console.log('[Telemetry] Would send events:', events);
            } else {
                // TODO: Send to actual analytics endpoint
                // await fetch('https://analytics.streamgo.app/events', {
                //     method: 'POST',
                //     headers: { 'Content-Type': 'application/json' },
                //     body: JSON.stringify({
                //         anonymous_id: this.config?.anonymousId,
                //         session_id: this.config?.sessionId,
                //         events,
                //     }),
                // });
            }
        } catch (error) {
            console.error('[Telemetry] Failed to flush events:', error);
            // Put events back in queue
            this.eventQueue.unshift(...events);
        }
    }

    /**
     * Show consent dialog
     */
    showConsentDialog(): Promise<boolean> {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'telemetry-consent-dialog';
            dialog.innerHTML = `
                <div class="consent-overlay"></div>
                <div class="consent-modal">
                    <h2>Help Improve StreamGo</h2>
                    <p>
                        We'd like to collect anonymous usage data to help improve StreamGo.
                        This helps us understand which features are used and identify bugs.
                    </p>
                    <h3>What we collect:</h3>
                    <ul>
                        <li>Feature usage (what you click, what you watch)</li>
                        <li>Performance metrics (load times, errors)</li>
                        <li>Device information (OS, screen size)</li>
                    </ul>
                    <h3>What we DON'T collect:</h3>
                    <ul>
                        <li>❌ Personal information (name, email)</li>
                        <li>❌ Passwords or authentication tokens</li>
                        <li>❌ Specific content you watch</li>
                        <li>❌ IP addresses or location data</li>
                    </ul>
                    <p>
                        You can change this setting anytime in Settings > Privacy.
                    </p>
                    <div class="consent-actions">
                        <button class="secondary-btn" id="consent-decline">No Thanks</button>
                        <button class="primary-btn" id="consent-accept">Accept</button>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);

            const acceptBtn = dialog.querySelector('#consent-accept');
            const declineBtn = dialog.querySelector('#consent-decline');

            const cleanup = () => {
                dialog.remove();
            };

            acceptBtn?.addEventListener('click', () => {
                this.enable();
                cleanup();
                resolve(true);
            });

            declineBtn?.addEventListener('click', () => {
                this.disable();
                cleanup();
                resolve(false);
            });
        });
    }

    /**
     * Check if user needs to be asked for consent
     */
    needsConsent(): boolean {
        return this.config !== null && this.config.enabled === false && 
               !localStorage.getItem('telemetry_consent_shown');
    }

    /**
     * Mark consent dialog as shown
     */
    markConsentShown(): void {
        localStorage.setItem('telemetry_consent_shown', 'true');
    }
}

// Export singleton instance
export const telemetry = new TelemetryManager();

// Convenience functions for common events
export const trackPageView = (pageName: string) => {
    telemetry.track('page_view', { page: pageName });
};

export const trackFeatureUsage = (feature: string, details?: Record<string, any>) => {
    telemetry.track('feature_used', { feature, ...details });
};

export const trackError = (error: Error, context?: Record<string, any>) => {
    telemetry.track('error_occurred', {
        error_message: error.message,
        error_stack: error.stack?.split('\n')[0], // Only first line
        ...context,
    });
};

export const trackPerformance = (metric: string, value: number, unit: string = 'ms') => {
    telemetry.track('performance_metric', {
        metric,
        value,
        unit,
    });
};
