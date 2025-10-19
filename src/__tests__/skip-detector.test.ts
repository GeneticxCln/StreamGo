/* eslint-disable */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SkipDetector } from '../skip-detector';
import { playerStore } from '../stores/player';

function createVideo(): HTMLVideoElement {
  const v = document.createElement('video');
  Object.defineProperty(v, 'currentTime', { value: 0, writable: true });
  return v as HTMLVideoElement;
}

describe('SkipDetector', () => {
  let video: HTMLVideoElement;
  let detector: SkipDetector;

  beforeEach(() => {
    video = createVideo();
    detector = new SkipDetector(video, playerStore);
  });

  afterEach(() => {
    detector.destroy();
    playerStore.reset?.();
  });

  it('activates intro skip within intro window', async () => {
    await detector.setMedia({ id: 'm1', duration: 1200, type: 'episode' });
    // Force known intro window
    playerStore.setSkipSegments({ intro: { start: 5, end: 20 } as any });
    // Move time into intro
    (video as any).currentTime = 10;
    video.dispatchEvent(new Event('timeupdate'));
    let active: any = null;
    playerStore.update(s => { active = s.activeSkip; return s; });
    expect(active?.type).toBe('intro');
  });

  it('activates outro proposal near end', async () => {
    await detector.setMedia({ id: 'm2', duration: 1200, type: 'episode' });
    (video as any).currentTime = 1150;
    video.dispatchEvent(new Event('timeupdate'));
    let active: any = null;
    playerStore.update(s => { active = s.activeSkip; return s; });
    expect(active?.type).toBe('outro');
  });
});