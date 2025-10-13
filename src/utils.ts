// Utility functions for StreamGo

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
 * Get Tauri invoke function
 */
export const getTauriInvoke = () => {
  console.log('Checking Tauri API...');
  console.log('window.__TAURI_INTERNALS__:', typeof window.__TAURI_INTERNALS__);
  console.log('window.__TAURI__:', typeof window.__TAURI__);
  
  if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
    console.log('✓ Using window.__TAURI_INTERNALS__.invoke');
    return window.__TAURI_INTERNALS__.invoke;
  }
  if (window.__TAURI__ && window.__TAURI__.invoke) {
    console.log('✓ Using window.__TAURI__.invoke');
    return window.__TAURI__.invoke;
  }
  if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
    console.log('✓ Using window.__TAURI__.core.invoke');
    return window.__TAURI__.core.invoke;
  }
  
  console.error('✗ Tauri API not found!');
  return null;
};
