/**
 * Frontend Error Logging and Handling System
 * 
 * Provides centralized error handling, logging, and user notifications
 */

export enum ErrorLevel {
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
    FATAL = 'fatal'
}

export interface ErrorContext {
    component?: string;
    action?: string;
    userId?: string;
    [key: string]: any;
}

export interface ErrorLog {
    timestamp: number;
    level: ErrorLevel;
    message: string;
    error?: Error;
    context?: ErrorContext;
    stack?: string;
}

class ErrorLogger {
    private logs: ErrorLog[] = [];
    private maxLogs = 100;
    private enableConsoleLogging = true;

    constructor() {
        this.setupGlobalErrorHandlers();
    }

    /**
     * Setup global error handlers
     */
    private setupGlobalErrorHandlers(): void {
        // Handle uncaught errors
        window.addEventListener('error', (event) => {
            this.logError('Uncaught error', event.error, {
                component: 'global',
                action: 'uncaught_error',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Unhandled promise rejection', event.reason, {
                component: 'global',
                action: 'unhandled_rejection'
            });
        });

        // Log page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.logInfo('Page hidden', { action: 'visibility_change' });
            } else {
                this.logInfo('Page visible', { action: 'visibility_change' });
            }
        });
    }

    /**
     * Log an info message
     */
    public logInfo(message: string, context?: ErrorContext): void {
        this.log(ErrorLevel.INFO, message, undefined, context);
    }

    /**
     * Log a warning
     */
    public logWarning(message: string, error?: Error, context?: ErrorContext): void {
        this.log(ErrorLevel.WARN, message, error, context);
    }

    /**
     * Log an error
     */
    public logError(message: string, error?: Error, context?: ErrorContext): void {
        this.log(ErrorLevel.ERROR, message, error, context);
    }

    /**
     * Log a fatal error
     */
    public logFatal(message: string, error?: Error, context?: ErrorContext): void {
        this.log(ErrorLevel.FATAL, message, error, context);
    }

    /**
     * Core logging method
     */
    private log(level: ErrorLevel, message: string, error?: Error, context?: ErrorContext): void {
        const logEntry: ErrorLog = {
            timestamp: Date.now(),
            level,
            message,
            error,
            context,
            stack: error?.stack
        };

        // Add to internal log buffer
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Console logging
        if (this.enableConsoleLogging) {
            this.logToConsole(logEntry);
        }

        // For fatal errors, notify user
        if (level === ErrorLevel.FATAL) {
            this.showFatalErrorDialog(logEntry);
        }
    }

    /**
     * Log to browser console
     */
    private logToConsole(logEntry: ErrorLog): void {
        const { level, message, error, context } = logEntry;
        const prefix = `[${level.toUpperCase()}] ${new Date(logEntry.timestamp).toISOString()}`;
        
        const contextStr = context ? ` (${Object.entries(context).map(([k, v]) => `${k}=${v}`).join(', ')})` : '';
        
        switch (level) {
            case ErrorLevel.INFO:
                console.log(`${prefix} ${message}${contextStr}`);
                break;
            case ErrorLevel.WARN:
                console.warn(`${prefix} ${message}${contextStr}`, error || '');
                break;
            case ErrorLevel.ERROR:
            case ErrorLevel.FATAL:
                console.error(`${prefix} ${message}${contextStr}`, error || '');
                if (error?.stack) {
                    console.error('Stack trace:', error.stack);
                }
                break;
        }
    }

    /**
     * Show fatal error dialog to user
     */
    private showFatalErrorDialog(logEntry: ErrorLog): void {
        // In a real implementation, this would show a modal
        alert(`Fatal Error: ${logEntry.message}\n\nPlease restart the application. If the problem persists, contact support.`);
    }

    /**
     * Get recent logs
     */
    public getRecentLogs(count: number = 50): ErrorLog[] {
        return this.logs.slice(-count);
    }

    /**
     * Clear all logs
     */
    public clearLogs(): void {
        this.logs = [];
    }

    /**
     * Export logs as JSON
     */
    public exportLogs(): string {
        return JSON.stringify(this.logs, null, 2);
    }

    /**
     * Get error statistics
     */
    public getStats(): { [key in ErrorLevel]: number } {
        const stats = {
            [ErrorLevel.INFO]: 0,
            [ErrorLevel.WARN]: 0,
            [ErrorLevel.ERROR]: 0,
            [ErrorLevel.FATAL]: 0
        };

        this.logs.forEach(log => {
            stats[log.level]++;
        });

        return stats;
    }
}

// Singleton instance
export const errorLogger = new ErrorLogger();

/**
 * Helper function to wrap async operations with error handling
 */
export async function withErrorHandling<T>(
    operation: () => Promise<T>,
    errorMessage: string,
    context?: ErrorContext
): Promise<T | null> {
    try {
        return await operation();
    } catch (error) {
        errorLogger.logError(errorMessage, error as Error, context);
        return null;
    }
}

/**
 * Helper to log performance metrics
 */
export class PerformanceTracker {
    private startTime: number;
    private operation: string;

    constructor(operation: string) {
        this.operation = operation;
        this.startTime = performance.now();
        errorLogger.logInfo(`Performance: ${operation} started`, {
            action: 'performance_start',
            operation
        });
    }

    finish(): void {
        const duration = performance.now() - this.startTime;
        errorLogger.logInfo(`Performance: ${this.operation} completed in ${duration.toFixed(2)}ms`, {
            action: 'performance_end',
            operation: this.operation,
            duration_ms: duration.toFixed(2)
        });
    }

    finishWithResult<T>(result: T | null): T | null {
        const duration = performance.now() - this.startTime;
        const success = result !== null;
        
        if (success) {
            errorLogger.logInfo(`Performance: ${this.operation} completed successfully in ${duration.toFixed(2)}ms`, {
                action: 'performance_success',
                operation: this.operation,
                duration_ms: duration.toFixed(2)
            });
        } else {
            errorLogger.logWarning(`Performance: ${this.operation} failed after ${duration.toFixed(2)}ms`, undefined, {
                action: 'performance_failure',
                operation: this.operation,
                duration_ms: duration.toFixed(2)
            });
        }

        return result;
    }
}
