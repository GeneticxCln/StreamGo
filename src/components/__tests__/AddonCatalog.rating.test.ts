/* eslint-disable */
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AddonCatalog from '../AddonCatalog.svelte';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string, args: any) => {
    if (cmd === 'list_catalogs') return [];
    if (cmd === 'get_addons') return [];
    if (cmd === 'get_addon_rating') return { addon_id: args.addonId, rating_avg: 4.2, rating_count: 10, weighted_rating: 4.0 };
    if (cmd === 'rate_addon') return { addon_id: args.addonId, rating_avg: 4.3, rating_count: 11, weighted_rating: 4.1 };
    if (cmd === 'install_addon') return null;
    return null;
  }),
}));

describe('AddonCatalog ratings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits rating via backend', async () => {
    render(AddonCatalog);
    // wait for catalog to render sample addons
    await waitFor(() => expect(screen.getByText('Addon Catalog')).toBeInTheDocument());
    // Click a star on first visible user rating control if present
    const star = screen.getAllByRole('button', { name: /Rate 1 stars/i })[0];
    await fireEvent.click(star);
    // if invoke mock is used, it should have been called with rate_addon
    const { invoke } = await import('@tauri-apps/api/core');
    expect((invoke as any).mock.calls.find((c: any[]) => c[0] === 'rate_addon')).toBeTruthy();
  });
});