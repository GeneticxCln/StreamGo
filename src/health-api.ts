// Health & Diagnostics API Wrapper for StreamGo

import type { 
  AddonHealthSummary, 
  PerformanceMetrics, 
  DiagnosticsInfo,
  CacheStats 
} from './types/tauri';
import { invoke } from './utils';

/**
 * Get health summaries for all addons
 */
export async function getAddonHealthSummaries(): Promise<AddonHealthSummary[]> {
  return invoke<AddonHealthSummary[]>('get_addon_health_summaries');
}

/**
 * Get health summary for a specific addon
 */
export async function getAddonHealth(addonId: string): Promise<AddonHealthSummary | null> {
  return invoke<AddonHealthSummary | null>('get_addon_health', { addon_id: addonId });
}

/**
 * Get current performance metrics
 */
export async function getPerformanceMetrics(): Promise<PerformanceMetrics> {
  return invoke<PerformanceMetrics>('get_performance_metrics');
}

/**
 * Export diagnostics information
 */
export async function exportDiagnostics(): Promise<DiagnosticsInfo> {
  return invoke<DiagnosticsInfo>('export_diagnostics');
}

/**
 * Export diagnostics to a file
 * @returns Path to the exported file
 */
export async function exportDiagnosticsFile(): Promise<string> {
  return invoke<string>('export_diagnostics_file');
}

/**
 * Reset performance metrics
 */
export async function resetPerformanceMetrics(): Promise<void> {
  return invoke<void>('reset_performance_metrics');
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  return invoke<CacheStats>('get_cache_stats');
}

/**
 * Clear all cache
 */
export async function clearCache(): Promise<void> {
  return invoke<void>('clear_cache');
}

/**
 * Clear expired cache entries
 * @returns Number of entries removed
 */
export async function clearExpiredCache(): Promise<number> {
  return invoke<number>('clear_expired_cache');
}

/**
 * Get health status badge color based on health score
 */
export function getHealthBadgeColor(score: number): string {
  if (score >= 80) return 'success'; // Green
  if (score >= 60) return 'warning'; // Yellow
  if (score >= 40) return 'poor';    // Orange
  return 'critical';                  // Red
}

/**
 * Get health status text based on health score
 */
export function getHealthStatusText(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

/**
 * Format uptime duration
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.length > 0 ? parts.join(' ') : '< 1m';
}

/**
 * Format timestamp to human-readable date
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

/**
 * Calculate cache hit rate percentage
 */
export function getCacheHitRate(metrics: PerformanceMetrics): number {
  const total = metrics.cache_hits + metrics.cache_misses;
  if (total === 0) return 0;
  return Math.round((metrics.cache_hits / total) * 100);
}

/**
 * Calculate success rate percentage
 */
export function getSuccessRate(metrics: PerformanceMetrics): number {
  if (metrics.total_requests === 0) return 0;
  return Math.round((metrics.successful_requests / metrics.total_requests) * 100);
}
