// Utility functions for StreamGo
import { invoke as tauriInvoke } from '@tauri-apps/api/core';

/**
 * Mockable invoke wrapper that checks for test mocks first
 * Use this instead of importing invoke directly from Tauri
 */
export const invoke = <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  // Check for mock invoke (for E2E tests)
  if (typeof window !== 'undefined') {
    const mockInvoke = (window as any).__TAURI_INVOKE__ || (window as any).__TAURI__?.core?.invoke;
    if (mockInvoke) {
      return mockInvoke(cmd, args);
    }
  }
  
  return tauriInvoke<T>(cmd, args);
};


/**
 * Legacy wrapper for backward compatibility
 * Supports mocking for E2E tests
 * @deprecated Use invoke directly from '@tauri-apps/api/core' instead
 */
export const getTauriInvoke = () => {
  // Check for mock invoke (for E2E tests)
  if (typeof window !== 'undefined') {
    const mockInvoke = (window as any).__TAURI_INVOKE__ || (window as any).__TAURI__?.core?.invoke;
    if (mockInvoke) {
      console.log('✓ Using mocked Tauri API (test mode)');
      return mockInvoke;
    }
  }
  
  console.log('✓ Using official @tauri-apps/api');
  return invoke;
};
