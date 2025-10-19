import { writable, derived } from 'svelte/store';

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  buffering: boolean;
  qualities: Array<{label: string; index: number; height?: number}>;
  currentQuality: number;
  subtitleTracks: Array<{label: string; index: number; language?: string}>;
  currentSubtitle: number;
  subtitleOffset: number;
  stats: {
    resolution: string;
    fps: string;
    bitrate: string;
    format: string;
    playbackRate: number;
    volume: number;
    currentTime: string;
    duration: string;
    bufferHealth: string;
    readyState: string;
    networkType: string;
    downlink: string;
    rtt: string | number;
    hlsStats?: {
      currentLevel: string;
      droppedFrames: number;
    };
    dashStats?: {
      currentQuality: string;
      currentBitrate: number;
    };
  } | null;
  showStats: boolean;
  skipSegments: {
    intro?: { start: number; end: number };
    outro?: { start: number; end: number };
  };
  activeSkip: { type: 'intro' | 'outro'; start: number; end: number } | null;
}

const defaultStats = {
  resolution: 'N/A',
  fps: 'N/A',
  bitrate: 'N/A',
  format: 'N/A',
  playbackRate: 1,
  volume: 100,
  currentTime: '0:00',
  duration: '0:00',
  bufferHealth: '0.0',
  readyState: 'LOADING',
  networkType: 'unknown',
  downlink: 'N/A',
  rtt: 'N/A',
};

const initialState: PlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  muted: false,
  playbackRate: 1,
  buffering: false,
  qualities: [],
  currentQuality: -1,
  subtitleTracks: [],
  currentSubtitle: -1,
  subtitleOffset: 0,
  stats: defaultStats,
  showStats: false,
  skipSegments: {},
  activeSkip: null,
};

function createPlayerStore() {
  const { subscribe, set, update } = writable<PlayerState>(initialState);

  return {
    subscribe,
    set,
    update,
    
    setPlaying: (isPlaying: boolean) => 
      update(state => ({ ...state, isPlaying })),
    
    setTime: (currentTime: number) => 
      update(state => ({ ...state, currentTime })),
    
    setDuration: (duration: number) => 
      update(state => ({ ...state, duration })),
    
    setVolume: (volume: number) => 
      update(state => ({ ...state, volume })),
    
    setMuted: (muted: boolean) => 
      update(state => ({ ...state, muted })),
    
    setPlaybackRate: (playbackRate: number) => 
      update(state => ({ ...state, playbackRate })),
    
    setBuffering: (buffering: boolean) => 
      update(state => ({ ...state, buffering })),
    
    setQualities: (qualities: PlayerState['qualities']) => 
      update(state => ({ ...state, qualities })),
    
    setCurrentQuality: (currentQuality: number) => 
      update(state => ({ ...state, currentQuality })),
    
    setSubtitleTracks: (subtitleTracks: PlayerState['subtitleTracks']) => 
      update(state => ({ ...state, subtitleTracks })),
    
    setCurrentSubtitle: (currentSubtitle: number) => 
      update(state => ({ ...state, currentSubtitle })),
    
    setSubtitleOffset: (subtitleOffset: number) => 
      update(state => ({ ...state, subtitleOffset })),
    
    setStats: (stats: PlayerState['stats']) => 
      update(state => ({ ...state, stats })),
    
    toggleStats: () => 
      update(state => ({ ...state, showStats: !state.showStats })),
    
    setSkipSegments: (segments: PlayerState['skipSegments']) =>
      update(state => ({ ...state, skipSegments: segments })),

    setActiveSkip: (active: PlayerState['activeSkip']) =>
      update(state => ({ ...state, activeSkip: active })),

    clearActiveSkip: () =>
      update(state => ({ ...state, activeSkip: null })),

    reset: () => set(initialState),
  };
}

export const playerStore = createPlayerStore();

export const formattedTime = derived(
  playerStore,
  $player => {
    const format = (seconds: number): string => {
      if (!isFinite(seconds)) return '0:00';
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      return `${m}:${s.toString().padStart(2, '0')}`;
    };
    
    return {
      current: format($player.currentTime),
      duration: format($player.duration),
    };
  }
);

export const progress = derived(
  playerStore,
  $player => {
    if ($player.duration === 0) return 0;
    return ($player.currentTime / $player.duration) * 100;
  }
);
