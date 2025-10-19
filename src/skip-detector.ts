import type { PlayerState } from './stores/player';
import { playerStore } from './stores/player';
import { invoke } from '@tauri-apps/api/core';

interface MediaContext {
  id: string;
  duration: number; // seconds
  type?: string; // movie | series | episode | etc
}

/**
 * Heuristic intro/outro skip detector
 * - Uses simple defaults with per-media persistence
 */
export class SkipDetector {
  private video: HTMLVideoElement;
  private media: MediaContext | null = null;
  private store = playerStore;
  private autoSkippedIntroFor: Set<string> = new Set();

  constructor(video: HTMLVideoElement, store = playerStore) {
    this.video = video;
    this.store = store;
    this.onTimeUpdate = this.onTimeUpdate.bind(this);
    this.video.addEventListener('timeupdate', this.onTimeUpdate);
  }

  async setMedia(media: MediaContext) {
    this.media = media;
    const segments = (await this.fetchPersistedSegments(media.id)) || this.loadSegments(media.id) || this.detectDefaults(media);
    this.store.setSkipSegments(segments);
    // Clear any previous active prompt
    this.store.clearActiveSkip();
  }

  private onTimeUpdate() {
    if (!this.media) return;
    const t = this.video.currentTime || 0;
    const d = this.media.duration || this.video.duration || 0;
    const segments = this.storeState().skipSegments;

    // Determine active skip range
    let active: PlayerState['activeSkip'] = null;

    if (segments.intro && t >= segments.intro.start && t <= segments.intro.end) {
      active = { type: 'intro', ...segments.intro } as any;
    } else if (segments.outro && t >= segments.outro.start && t <= segments.outro.end) {
      active = { type: 'outro', ...segments.outro } as any;
    }

    // Auto-skip intro if enabled
    if (active?.type === 'intro') {
      this.getSkipIntroSetting().then((enabled) => {
        if (enabled && this.media && !this.autoSkippedIntroFor.has(this.media.id)) {
          this.autoSkippedIntroFor.add(this.media.id);
          this.video.currentTime = active!.end;
          this.store.clearActiveSkip();
        } else {
          this.store.setActiveSkip(active);
        }
      }).catch(() => this.store.setActiveSkip(active));
      return;
    }

    // Update store for credits
    this.store.setActiveSkip(active);

    // If no explicit outro segment and nearing end, propose credits skip
    if (!segments.outro && d > 600 /* 10 min */ && t >= d - Math.min(180, d * 0.12)) {
      const guess = { start: Math.max(0, d - Math.min(150, d * 0.1)), end: d };
      this.store.setActiveSkip({ type: 'outro', ...guess } as any);
    }
  }

  private detectDefaults(media: MediaContext) {
    const d = media.duration;
    const segments: PlayerState['skipSegments'] = {};
    // Conservative default intro for episodic content
    if (d > 600 /* 10 min */ && (media.type === 'episode' || media.type === 'series')) {
      segments.intro = { start: 5, end: Math.min(95, Math.floor(d * 0.08)) };
    }
    // No default outro (handled on-the-fly near end)
    return segments;
  }

  private storeState() {
    let state: PlayerState | null = null as any;
    this.store.update((s) => { state = s; return s; });
    return state!;
  }

  private async fetchPersistedSegments(mediaId: string): Promise<PlayerState['skipSegments'] | null> {
    try {
      const res = await invoke<any>('get_skip_segments', { mediaId: mediaId });
      if (!res) return null;
      const segs: PlayerState['skipSegments'] = {};
      if (typeof res.intro_start === 'number' && typeof res.intro_end === 'number') {
        segs.intro = { start: res.intro_start, end: res.intro_end } as any;
      }
      if (typeof res.outro_start === 'number' && typeof res.outro_end === 'number') {
        segs.outro = { start: res.outro_start, end: res.outro_end } as any;
      }
      return segs;
    } catch {
      return null;
    }
  }

  private loadSegments(mediaId: string): PlayerState['skipSegments'] | null {
    try {
      const raw = localStorage.getItem(`skipSegments:${mediaId}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async saveSegments(segments: PlayerState['skipSegments']) {
    if (!this.media) return;
    try {
      const payload: any = {
        intro_start: segments.intro?.start ?? null,
        intro_end: segments.intro?.end ?? null,
        outro_start: segments.outro?.start ?? null,
        outro_end: segments.outro?.end ?? null,
      };
      await invoke('save_skip_segments', { mediaId: this.media.id, segments: payload });
      // Also mirror to localStorage for offline fallback
      localStorage.setItem(`skipSegments:${this.media.id}`, JSON.stringify(segments));
      this.store.setSkipSegments(segments);
    } catch (e) {
      // Fallback to local storage
      localStorage.setItem(`skipSegments:${this.media.id}`, JSON.stringify(segments));
      this.store.setSkipSegments(segments);
    }
  }

  private async getSkipIntroSetting(): Promise<boolean> {
    try {
      const settings = await invoke<any>('get_settings');
      return !!settings?.skip_intro;
    } catch {
      return false;
    }
  }

  destroy() {
    this.video.removeEventListener('timeupdate', this.onTimeUpdate);
  }
}