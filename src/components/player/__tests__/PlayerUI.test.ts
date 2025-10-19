/* eslint-disable */
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PlayerUI from '../../player/PlayerUI.svelte';
import { playerStore } from '../../../stores/player';

describe('PlayerUI skip overlay', () => {
  beforeEach(() => {
    // Mock player
    (window as any).player = {
      skipActiveSegment: vi.fn(),
      getCurrentMediaId: () => 'test-media',
    };
    // Ensure store has active skip
    playerStore.setSkipSegments({ intro: { start: 0, end: 10 } as any });
    playerStore.setActiveSkip({ type: 'intro', start: 0, end: 10 } as any);
  });

  it('shows skip button and triggers player on click', async () => {
    render(PlayerUI);
    const btn = await screen.findByText('Skip Intro');
    expect(btn).toBeInTheDocument();
    await fireEvent.click(btn);
    expect((window as any).player.skipActiveSegment).toHaveBeenCalled();
  });
});