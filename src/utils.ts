// Utility functions for StreamGo
import { invoke } from '@tauri-apps/api/core';

/**
 * HTML sanitization utility
 */
export const escapeHtml = (unsafe: string | null | undefined): string => {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Re-export invoke from Tauri API for convenience
 */
export { invoke };

/**
 * Legacy wrapper for backward compatibility
 * @deprecated Use invoke directly from '@tauri-apps/api/core' instead
 */
export const getTauriInvoke = () => {
  console.log('✓ Using official @tauri-apps/api');
  return invoke;
};
