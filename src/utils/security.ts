/**
 * Security utilities for StreamGo
 * 
 * Provides HTML escaping, URL validation, and other security primitives
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param unsafe - The untrusted string to escape
 * @returns The escaped string safe for insertion into HTML
 */
export function escapeHtml(unsafe: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;'
  };
  
  return unsafe.replace(/[&<>"'/]/g, (char) => escapeMap[char] || char);
}

/**
 * Validates that a URL uses safe protocols (http or https only)
 * @param url - The URL to validate
 * @returns true if the URL is safe, false otherwise
 */
export function isValidStreamUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates a hostname against a whitelist pattern
 * @param url - The URL to check
 * @param allowedDomains - Array of allowed domain patterns (supports wildcards)
 * @returns true if hostname is allowed
 */
export function isAllowedDomain(url: string, allowedDomains: string[]): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    return allowedDomains.some(pattern => {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      return new RegExp(`^${regexPattern}$`).test(hostname);
    });
  } catch {
    return false;
  }
}

/**
 * Sanitizes user input for safe display
 * Removes potentially dangerous characters and limits length
 */
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  return escapeHtml(input.substring(0, maxLength).trim());
}

/**
 * Creates a safe text node for DOM insertion
 * Preferred over innerHTML for untrusted content
 */
export function createSafeTextNode(text: string): Text {
  return document.createTextNode(text);
}

/**
 * Safely sets an element's text content
 * @param element - The DOM element
 * @param text - The text to set (will be escaped)
 */
export function setSafeText(element: HTMLElement, text: string): void {
  element.textContent = text;
}

/**
 * Safely sets an element's HTML content
 * Only use this when you need formatted HTML and trust the source
 * @param element - The DOM element
 * @param html - The HTML string (should already be escaped)
 */
export function setSafeHtml(element: HTMLElement, html: string): void {
  // Clear existing content
  element.textContent = '';
  
  // Parse and insert safely
  const template = document.createElement('template');
  template.innerHTML = html;
  element.appendChild(template.content);
}

/**
 * Validates addon manifest size and structure
 * @param manifestData - The raw manifest JSON string
 * @param maxSize - Maximum allowed size in bytes (default 100KB)
 * @returns Parsed manifest or throws error
 */
export function validateAddonManifest(manifestData: string, maxSize: number = 102400): any {
  // Check size
  const sizeBytes = new Blob([manifestData]).size;
  if (sizeBytes > maxSize) {
    throw new Error(`Manifest exceeds maximum size of ${maxSize} bytes`);
  }
  
  // Parse JSON
  let manifest: any;
  try {
    manifest = JSON.parse(manifestData);
  } catch (e) {
    throw new Error('Invalid JSON in manifest');
  }
  
  // Validate required fields
  const requiredFields = ['id', 'name', 'version', 'resources'];
  for (const field of requiredFields) {
    if (!(field in manifest)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // Validate id format (alphanumeric, hyphens, underscores only)
  if (!/^[a-zA-Z0-9_-]+$/.test(manifest.id)) {
    throw new Error('Invalid addon ID format');
  }
  
  // Validate version format (semver-ish)
  if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
    throw new Error('Invalid version format');
  }
  
  return manifest;
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private calls: number[] = [];
  private maxCalls: number;
  private windowMs: number;
  
  constructor(
    maxCalls: number,
    windowMs: number
  ) {
    this.maxCalls = maxCalls;
    this.windowMs = windowMs;
  }
  
  /**
   * Check if a call is allowed
   * @returns true if call is allowed, false if rate limit exceeded
   */
  isAllowed(): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Remove old calls outside the window
    this.calls = this.calls.filter(time => time > windowStart);
    
    // Check if we're at the limit
    if (this.calls.length >= this.maxCalls) {
      return false;
    }
    
    // Record this call
    this.calls.push(now);
    return true;
  }
  
  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.calls = [];
  }
}
