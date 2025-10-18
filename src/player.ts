// Video Player Module with HLS support
// All heavy dependencies are lazy-loaded only when needed to reduce initial bundle size
type HlsType = typeof import('hls.js').default;
type DashPlayerType = typeof import('./dash-player').DashPlayer;
type TorrentPlayerType = typeof import('./torrent-player').TorrentPlayer;
import { detectStreamFormat } from './stream-format-detector';
import { convertSRTtoVTT, adjustTimestamps } from './subtitle-parser';
import { showToast } from './ui-utils';


export interface PlayerOptions {
    container: HTMLElement;
    video: HTMLVideoElement;
    onClose?: () => void;
    playlist?: PlaylistContext;
}

export interface PlaylistContext {
    items: { id: string; title: string }[];
    currentIndex: number;
    onNext?: () => void;
    onPrevious?: () => void;
}

export class VideoPlayer {
    private container: HTMLElement;
    private video: HTMLVideoElement;
    private hls: InstanceType<HlsType> | null = null;
    private dashPlayer: InstanceType<DashPlayerType> | null = null;
    private torrentPlayer: InstanceType<TorrentPlayerType> | null = null;
    private onCloseCallback?: () => void;
    private playlistContext: PlaylistContext | null = null;
    private isPipActive: boolean = false;
    private hlsModule: HlsType | null = null;
    private DashPlayerClass: DashPlayerType | null = null;
    private TorrentPlayerClass: TorrentPlayerType | null = null;
    private localSubtitleBlobs: string[] = [];
    private subtitleOffset: number = 0; // in seconds
    private originalSubtitleContent: Map<string, string> = new Map(); // Map<track.src, originalVttContent>
    private trackElementMap: Map<TextTrack, HTMLTrackElement> = new Map(); // Map TextTrack to HTMLTrackElement
    private torrentStatsElement: HTMLElement | null = null;
    private bufferingOverlay: HTMLElement | null = null;
    private bufferTimeout: number | null = null;
    private progressSaveInterval: number | null = null;
    private statsOverlay: HTMLElement | null = null;
    private statsUpdateInterval: number | null = null;
    private statsVisible: boolean = false;
    private networkAdaptiveEnabled: boolean = true;
    private lastNetworkChange: number = 0;
    private retryCount: number = 0;
    private maxRetries: number = 3;
    private retryDelay: number = 1000; // Start with 1 second

    constructor(options: PlayerOptions) {
        this.container = options.container;
        this.video = options.video;
        this.onCloseCallback = options.onClose;
        this.playlistContext = options.playlist || null;
        this.setupKeyboardShortcuts();
        this.setupSubtitleLoader();
        this.setupSubtitleSyncControls();

        // Listen for track changes to update the UI
        this.video.textTracks.addEventListener('addtrack', () => this.setupSubtitleSelector());
        this.video.textTracks.addEventListener('removetrack', () => this.setupSubtitleSelector());

        // Also update UI when metadata is loaded (for embedded tracks)
        this.video.addEventListener('loadedmetadata', () => this.setupSubtitleSelector());

        // Setup media session for OS-level controls
        this.setupMediaSessionHandlers();
        
        // Setup buffering indicator
        this.setupBufferingIndicator();
        
        // Setup playback speed controls
        this.setupSpeedSelector();
        
        // Setup streaming stats overlay
        this.setupStatsOverlay();
        
        // Setup network-adaptive quality
        this.setupNetworkAdaptive();

        // Reset retry counter when playback resumes
        this.video.addEventListener('playing', () => this.resetRetryCounter());
        
        // Auto-advance to next item in playlist when video ends
        this.video.addEventListener('ended', () => this.handleVideoEnded());
    }

    /**
     * Load and play a video URL (supports HLS and regular video files)
     */
    loadVideo(url: string, title: string = 'Video', startTime?: number): void {
        // Update title
        const titleEl = document.getElementById('player-title');
        if (titleEl) {
            titleEl.textContent = title;
        }

        // Update media session metadata
        this.updateMediaSessionMetadata(title);

        this.loadStream(url);

        // Set start time if provided
        if (startTime && startTime > 0) {
            const seekToStartTime = () => {
                this.video.currentTime = startTime;
                this.video.removeEventListener('loadedmetadata', seekToStartTime);
            };
            this.video.addEventListener('loadedmetadata', seekToStartTime);
        }

        // Start periodic progress saving
        this.startProgressSaving();

        this.show();
    }

    /**
     * Detects stream format and loads the appropriate player.
     */
    private async loadStream(url: string) {
        console.log('🎬 Loading stream URL:', url);
        
        // First, clean up any existing HLS or DASH instances and subtitles
        this.cleanupPreviousStream();

        const format = detectStreamFormat(url);
        console.log('🎬 Detected format:', format);

        switch (format) {
            case 'torrent':
                console.log('Torrent/Magnet link detected. Initializing WebTorrent...');
                this.loadTorrentStream(url);
                break;

            case 'dash':
                console.log('DASH stream detected. Initializing dash.js...');
                await this.loadDashStream(url);
                break;

            case 'hls':
                this.loadHlsStream(url);
                break;

            case 'direct':
            default:
                this.loadRegularVideo(url);
                break;
        }

        this.video.play().catch(err => {
            console.error('Error playing video:', err);
        });
    }

    /**
     * Load HLS stream using hls.js (lazy-loaded)
     */
    private async loadHlsStream(url: string): Promise<void> {
        // Check if HLS is natively supported (Safari)
        if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
            this.video.src = url;
            this.video.load();
            this.video.play();
            return;
        }

        // Lazy load HLS.js only when needed
        if (!this.hlsModule) {
            console.log('Loading HLS.js module...');
            const hlsImport = await import('hls.js');
            this.hlsModule = hlsImport.default;
        }

        // Use hls.js for browsers without native HLS support
        if (this.hlsModule.isSupported()) {
            this.hls = new this.hlsModule({
                enableWorker: true,
                lowLatencyMode: false,
            });

            this.hls.loadSource(url);
            this.hls.attachMedia(this.video);

            this.hls.on(this.hlsModule.Events.MANIFEST_PARSED, () => {
                console.log('HLS manifest parsed, starting playback');
                this.video.play().catch(err => {
                    console.error('Error playing video:', err);
                });
            });

            this.hls.on(this.hlsModule.Events.ERROR, (_event, data) => {
                console.error('HLS error:', data);
                if (data.fatal && this.hlsModule) {
                    this.handleHlsError(data);
                }
            });

            // Setup quality selector if available
            this.hls.on(this.hlsModule.Events.MANIFEST_PARSED, () => {
                this.setupQualitySelector();
            });
        } else {
            console.error('HLS not supported in this browser');
            showToast('HLS streaming is not supported in your browser', 'error');
        }
    }

    /**
     * Load DASH stream using dash.js (lazy-loaded)
     */
    private async loadDashStream(url: string): Promise<void> {
        // Lazy load DashPlayer only when needed
        if (!this.DashPlayerClass) {
            console.log('Loading DASH player module...');
            const dashModule = await import('./dash-player');
            this.DashPlayerClass = dashModule.DashPlayer;
        }

        this.dashPlayer = new this.DashPlayerClass(this.video);
        this.dashPlayer.onError((event) => this.handleDashError(event));
        this.dashPlayer.load(url);
        // The quality selector for DASH is set up after the manifest is loaded
        this.video.addEventListener('loadedmetadata', () => this.setupDashQualitySelector(), { once: true });
    }

    /**
     * Load regular video file (MP4, WebM, etc.)
     */
    private loadRegularVideo(url: string): void {
        const source = this.video.querySelector('source') as HTMLSourceElement;
        if (source) {
            source.src = url;
        } else {
            this.video.src = url;
        }
        
        this.video.load();
    }

    /**
     * Load torrent/magnet stream using WebTorrent (lazy-loaded)
     */
    private async loadTorrentStream(magnetOrTorrent: string): Promise<void> {
        // Lazy load TorrentPlayer only when needed
        if (!this.TorrentPlayerClass) {
            console.log('Loading WebTorrent player module...');
            const torrentModule = await import('./torrent-player');
            this.TorrentPlayerClass = torrentModule.TorrentPlayer;
        }

        this.torrentPlayer = new this.TorrentPlayerClass(this.video);
        this.setupTorrentStatsUI();

        this.torrentPlayer.load(magnetOrTorrent, (stats: any) => {
            this.updateTorrentStatsUI(stats);
        });
    }

    /**
     * Setup quality selector for HLS streams
     */
    private setupQualitySelector(): void {
        if (!this.hls) return;

        const levels = this.hls.levels;
        if (levels.length <= 1) return; // No need for selector if only one quality

        const qualitySelector = document.getElementById('quality-selector');
        if (!qualitySelector) return;

        qualitySelector.innerHTML = ''; // Clear previous options

        // Add "Auto" option
        const autoBtn = this.createQualityButton('Auto', -1, () => {
            if (this.hls) this.hls.currentLevel = -1;
        });
        autoBtn.classList.add('active');
        qualitySelector.appendChild(autoBtn);

        // Add specific quality levels
        levels.forEach((level, index) => {
            const label = `${level.height}p`;
            const btn = this.createQualityButton(label, index, () => {
                if (this.hls) this.hls.currentLevel = index;
            });
            qualitySelector.appendChild(btn);
        });
    }

    /**
     * Sets up the quality selector UI for DASH streams.
     */
    private setupDashQualitySelector(): void {
        if (!this.dashPlayer) return;

        const qualityLevels = this.dashPlayer.getQualityLevels();
        const qualitySelector = document.getElementById('quality-selector');
        if (!qualitySelector || qualityLevels.length <= 1) return;

        qualitySelector.innerHTML = ''; // Clear previous options

        // Add "Auto" option
        const autoBtn = this.createQualityButton('Auto', -1, () => {
            this.dashPlayer?.setQualityLevel(-1);
        });
        autoBtn.classList.add('active');
        qualitySelector.appendChild(autoBtn);

        // Add specific quality levels
        qualityLevels.forEach((level, index) => {
            const label = `${level.height}p`;
            const btn = this.createQualityButton(label, index, () => {
                this.dashPlayer?.setQualityLevel(index);
            });
            qualitySelector.appendChild(btn);
        });
    }

    /**
     * Helper to create a quality selector button.
     */
    private createQualityButton(label: string, qualityIndex: number, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.dataset.quality = String(qualityIndex);
        btn.addEventListener('click', () => {
            onClick();
            // Update active state
            const qualitySelector = document.getElementById('quality-selector');
            qualitySelector?.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
        return btn;
    }

    /**
     * Sets up the subtitle selector UI based on available tracks.
     */
    private setupSubtitleSelector(): void {
        const subtitleSelector = document.getElementById('subtitle-selector');
        if (!subtitleSelector) return;

        const tracks = this.getSubtitleTracks();
        subtitleSelector.innerHTML = ''; // Clear existing options

        // Add "Off" option
        const offBtn = document.createElement('button');
        offBtn.textContent = 'Off';
        offBtn.addEventListener('click', () => {
            this.disableSubtitles();
            this.updateActiveSubtitleButton();
        });
        subtitleSelector.appendChild(offBtn);

        // Add options for each track
        tracks.forEach((track, index) => {
            const trackBtn = document.createElement('button');
            trackBtn.textContent = track.label || `Track ${index + 1}`;
            trackBtn.dataset.trackIndex = String(index);
            trackBtn.addEventListener('click', () => {
                this.enableSubtitle(index);
                this.updateActiveSubtitleButton();
            });
            subtitleSelector.appendChild(trackBtn);
        });

        this.updateActiveSubtitleButton();
    }

    /**
     * Updates the visual state of the active subtitle button.
     */
    private updateActiveSubtitleButton(): void {
        const subtitleSelector = document.getElementById('subtitle-selector');
        if (!subtitleSelector) return;

        const buttons = subtitleSelector.querySelectorAll('button');
        buttons.forEach(btn => btn.classList.remove('active'));

        const tracks = this.getSubtitleTracks();
        const activeTrackIndex = tracks.findIndex(t => t.mode === 'showing');

        if (activeTrackIndex === -1) {
            // "Off" is active
            const offBtn = subtitleSelector.querySelector('button:not([data-track-index])');
            offBtn?.classList.add('active');
        } else {
            // A specific track is active
            const activeBtn = subtitleSelector.querySelector(`button[data-track-index="${activeTrackIndex}"]`);
            activeBtn?.classList.add('active');
        }
    }

    /**
     * Sets up the event listener for the local subtitle loading button.
     */
    private setupSubtitleLoader(): void {
        const loadSubtitleBtn = document.getElementById('load-subtitle-btn');
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.vtt,.srt';

        fileInput.addEventListener('change', async (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const content = await file.text();
                let vttContent = content;

                if (file.name.endsWith('.srt')) {
                    vttContent = convertSRTtoVTT(content);
                }

                const trackLabel = file.name.replace(/\.(srt|vtt)$/, '');
                this.addLocalSubtitle(vttContent, trackLabel);

                showToast(`Loaded subtitle: ${file.name}`, 'success');
            } catch (error) {
                console.error('Error loading subtitle file:', error);
                showToast('Failed to load or parse subtitle file.', 'error');
            }
        });

        loadSubtitleBtn?.addEventListener('click', () => {
            fileInput.click();
        });
    }

    /**
     * Sets up the subtitle synchronization controls.
     */
    private setupSubtitleSyncControls(): void {
        const increaseBtn = document.getElementById('subtitle-sync-increase');
        const decreaseBtn = document.getElementById('subtitle-sync-decrease');
        const offsetDisplay = document.getElementById('subtitle-sync-offset');

        const updateSync = (amount: number) => {
            this.subtitleOffset += amount;
            if (offsetDisplay) {
                offsetDisplay.textContent = `${this.subtitleOffset.toFixed(1)}s`;
            }
            this.applySubtitleOffset();
            showToast(`Subtitle offset: ${this.subtitleOffset.toFixed(1)}s`, 'info');
        }

        increaseBtn?.addEventListener('click', () => updateSync(0.1));
        decreaseBtn?.addEventListener('click', () => updateSync(-0.1));
    }

    /**
     * Setup keyboard shortcuts
     */
    private setupKeyboardShortcuts(): void {
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            // Only handle shortcuts when player is visible
            if (this.container.style.display !== 'flex') return;

            switch (e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    this.togglePlayPause();
                    break;
                case 'f':
                    e.preventDefault();
                    this.toggleFullscreen();
                    break;
                case 'm':
                    e.preventDefault();
                    this.toggleMute();
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    this.seek(-10);
                    break;
                case 'arrowright':
                    e.preventDefault();
                    this.seek(10);
                    break;
                case 'arrowup':
                    e.preventDefault();
                    this.changeVolume(0.1);
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    this.changeVolume(-0.1);
                    break;
                case 'escape':
                    e.preventDefault();
                    this.close();
                    break;
                case 'p':
                    e.preventDefault();
                    this.togglePictureInPicture();
                    break;
                case '<':
                case ',':
                    e.preventDefault();
                    this.decreaseSpeed();
                    break;
                case '>':
                case '.':
                    e.preventDefault();
                    this.increaseSpeed();
                    break;
                case 'd':
                    // Ctrl+Shift+D to toggle stats
                    if (e.ctrlKey && e.shiftKey) {
                        e.preventDefault();
                        this.toggleStats();
                    }
                    break;
            }
        });
    }

    /**
     * Toggle play/pause
     */
    private togglePlayPause(): void {
        if (this.video.paused) {
            this.video.play();
        } else {
            this.video.pause();
        }
    }

    /**
     * Toggle fullscreen
     */
    private toggleFullscreen(): void {
        if (!document.fullscreenElement) {
            this.container.requestFullscreen().catch(err => {
                console.error('Error entering fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * Toggle mute
     */
    private toggleMute(): void {
        this.video.muted = !this.video.muted;
    }

    /**
     * Seek video by seconds (negative to go back)
     */
    private seek(seconds: number): void {
        this.video.currentTime = Math.max(0, Math.min(this.video.duration, this.video.currentTime + seconds));
    }

    /**
     * Change volume (0.0 to 1.0)
     */
    private changeVolume(delta: number): void {
        this.video.volume = Math.max(0, Math.min(1, this.video.volume + delta));
    }

    /**
     * Show player
     */
    show(): void {
        this.container.style.display = 'flex';
    }

    /**
     * Close player
     */
    close(): void {
        this.video.pause();
        this.container.style.display = 'none';
        
        // Stop progress saving
        this.stopProgressSaving();
        
        if (this.onCloseCallback) {
            this.onCloseCallback();
        }
    }

    /**
     * Cleanup and destroy player
     */
    destroy(): void {
        this.cleanupPreviousStream();
        this.stopProgressSaving();
        this.video.pause();
        this.video.src = '';
        this.video.srcObject = null;

        // Clear any event listeners
        this.video.removeEventListener('loadedmetadata', () => this.setupDashQualitySelector());
    }

    /**
     * Cleans up resources from the previous stream (HLS, DASH, torrent, subtitles).
     */
    private cleanupPreviousStream(): void {
        this.cleanupLocalSubtitles();
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
        if (this.dashPlayer) {
            this.dashPlayer.destroy();
            this.dashPlayer = null;
        }
        if (this.torrentPlayer) {
            this.torrentPlayer.destroy();
            this.torrentPlayer = null;
        }
        this.hideTorrentStatsUI();
        document.getElementById('quality-selector')!.innerHTML = '';
    }

    /**
     * Add subtitle track
     */
    addSubtitle(url: string, label: string = 'Subtitles', language: string = 'en'): void {
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = label;
        track.srclang = language;
        track.src = url;
        
        // Make it visible by default if it's the first one
        if (this.video.textTracks.length === 0) {
            track.default = true;
        }

        this.video.appendChild(track);
    }

    /**
     * Adds a subtitle from a local file content.
     * @param vttContent The subtitle content in VTT format.
     * @param label The label for the subtitle track.
     */
    private addLocalSubtitle(vttContent: string, label: string): void {
        const vttBlob = new Blob([vttContent], { type: 'text/vtt' });
        const vttUrl = URL.createObjectURL(vttBlob);
        this.localSubtitleBlobs.push(vttUrl);

        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = label;
        track.srclang = 'en'; // Default language
        track.src = vttUrl;

        // Store original content for syncing
        this.originalSubtitleContent.set(vttUrl, vttContent);

        this.video.appendChild(track);

        // Map the TextTrack to the HTMLTrackElement once loaded
        track.addEventListener('load', () => {
            const textTrack = track.track;
            if (textTrack) {
                this.trackElementMap.set(textTrack, track);
            }
        });

        // Enable the newly added track automatically
        const newTrackIndex = this.getSubtitleTracks().length - 1;
        this.enableSubtitle(newTrackIndex);
    }

    /**
     * Revokes blob URLs created for local subtitles to prevent memory leaks.
     */
    private cleanupLocalSubtitles(): void {
        // Revoke all blob URLs to prevent memory leaks
        this.localSubtitleBlobs.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch (error) {
                console.warn('Failed to revoke blob URL:', error);
            }
        });
        this.localSubtitleBlobs = [];
        this.originalSubtitleContent.clear();
        this.trackElementMap.clear();
        this.subtitleOffset = 0;

        const offsetDisplay = document.getElementById('subtitle-sync-offset');
        if (offsetDisplay) offsetDisplay.textContent = '0.0s';

        // Also remove track elements from video that were loaded locally
        const tracks = this.video.querySelectorAll('track');
        tracks.forEach(track => {
            if (track.src.startsWith('blob:')) {
                try {
                    this.video.removeChild(track);
                } catch (error) {
                    console.warn('Failed to remove track element:', error);
                }
            }
        });
    }

    /**
     * Get available subtitle tracks
     */
    getSubtitleTracks(): TextTrack[] {
        return Array.from(this.video.textTracks);
    }

    /**
     * Enable subtitle track by index
     */
    enableSubtitle(index: number): void {
        const tracks = this.video.textTracks;
        for (let i = 0; i < tracks.length; i++) {
            tracks[i].mode = i === index ? 'showing' : 'hidden';
        }
    }

    /**
     * Disable all subtitles
     */
    disableSubtitles(): void {
        const tracks = this.video.textTracks;
        for (let i = 0; i < tracks.length; i++) {
            tracks[i].mode = 'hidden';
        }
    }

    /**
     * Applies the current subtitle offset to all local subtitle tracks.
     */
    private applySubtitleOffset(): void {
        const tracks = this.getSubtitleTracks();
        for (const track of tracks) {
            const trackElement = this.trackElementMap.get(track);
            if (!trackElement || !track.label || track.mode !== 'showing') continue;
            
            const currentSrc = trackElement.src;
            if (!this.originalSubtitleContent.has(currentSrc)) continue;
            
            const originalContent = this.originalSubtitleContent.get(currentSrc);
            if (!originalContent) continue;

            // Adjust timestamps
            const adjustedContent = adjustTimestamps(originalContent, this.subtitleOffset);

            // Create a new blob and update the track src
            const newBlob = new Blob([adjustedContent], { type: 'text/vtt' });
            const newUrl = URL.createObjectURL(newBlob);

            // Revoke the old URL and update references
            try {
                URL.revokeObjectURL(currentSrc);
            } catch (error) {
                console.warn('Failed to revoke old blob URL:', error);
            }

            const oldUrlIndex = this.localSubtitleBlobs.indexOf(currentSrc);
            if (oldUrlIndex > -1) this.localSubtitleBlobs.splice(oldUrlIndex, 1);
            this.localSubtitleBlobs.push(newUrl);
            this.originalSubtitleContent.set(newUrl, originalContent); // Keep original content mapped to new URL
            this.originalSubtitleContent.delete(currentSrc);
            trackElement.src = newUrl;
        }
    }

    /**
     * Enter Picture-in-Picture mode
     */
    async enterPictureInPicture(): Promise<void> {
        try {
            // Check if PiP is supported
            if (!document.pictureInPictureEnabled) {
                console.warn('Picture-in-Picture is not supported in this browser');
                return;
            }

            // Check if already in PiP
            if (document.pictureInPictureElement) {
                console.log('Already in Picture-in-Picture mode');
                return;
            }

            // Enter PiP mode
            await this.video.requestPictureInPicture();
            this.isPipActive = true;
            console.log('Entered Picture-in-Picture mode');

            // Update PiP button state
            this.updatePipButtonState();
        } catch (error) {
            console.error('Failed to enter Picture-in-Picture mode:', error);
        }
    }

    /**
     * Exit Picture-in-Picture mode
     */
    async exitPictureInPicture(): Promise<void> {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
                this.isPipActive = false;
                console.log('Exited Picture-in-Picture mode');

                // Update PiP button state
                this.updatePipButtonState();
            }
        } catch (error) {
            console.error('Failed to exit Picture-in-Picture mode:', error);
        }
    }

    /**
     * Toggle Picture-in-Picture mode
     */
    async togglePictureInPicture(): Promise<void> {
        if (document.pictureInPictureElement) {
            await this.exitPictureInPicture();
        } else {
            await this.enterPictureInPicture();
        }
    }

    /**
     * Update PiP button state
     */
    private updatePipButtonState(): void {
        const pipBtn = document.getElementById('pip-btn');
        if (pipBtn) {
            if (this.isPipActive) {
                pipBtn.classList.add('active');
                pipBtn.title = 'Exit Picture-in-Picture (P)';
            } else {
                pipBtn.classList.remove('active');
                pipBtn.title = 'Picture-in-Picture (P)';
            }
        }
    }

    /**
     * Check if Picture-in-Picture is supported
     */
    isPipSupported(): boolean {
        return document.pictureInPictureEnabled;
    }

    /**
     * Check if currently in Picture-in-Picture mode
     */
    isInPip(): boolean {
        return this.isPipActive;
    }

    /**
     * Setup Media Session API handlers for OS-level media controls
     */
    private setupMediaSessionHandlers(): void {
        if (!('mediaSession' in navigator)) {
            console.log('Media Session API not supported');
            return;
        }

        const actionHandlers: [MediaSessionAction, () => void][] = [
            ['play', () => this.video.play()],
            ['pause', () => this.video.pause()],
            ['seekbackward', () => this.seek(-10)],
            ['seekforward', () => this.seek(10)],
            ['previoustrack', () => this.playPrevious()],
            ['nexttrack', () => this.playNext()],
        ];

        actionHandlers.forEach(([action, handler]) => {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
            } catch (error) {
                console.warn(`Media session action "${action}" not supported:`, error);
            }
        });

        // Update position state on timeupdate
        this.video.addEventListener('timeupdate', () => {
            if ('setPositionState' in navigator.mediaSession) {
                try {
                    navigator.mediaSession.setPositionState({
                        duration: this.video.duration || 0,
                        playbackRate: this.video.playbackRate,
                        position: this.video.currentTime || 0
                    });
                } catch (error) {
                    // Ignore errors when duration is not yet available
                }
            }
        });

        console.log('Media Session API handlers configured');
    }

    /**
     * Update Media Session metadata (title, artwork, etc.)
     */
    private updateMediaSessionMetadata(title: string, poster?: string): void {
        if (!('mediaSession' in navigator)) return;

        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title || 'StreamGo Video',
                artist: 'StreamGo',
                album: 'Media Center',
                artwork: poster ? [
                    { src: poster, sizes: '96x96', type: 'image/jpeg' },
                    { src: poster, sizes: '128x128', type: 'image/jpeg' },
                    { src: poster, sizes: '192x192', type: 'image/jpeg' },
                    { src: poster, sizes: '256x256', type: 'image/jpeg' },
                    { src: poster, sizes: '384x384', type: 'image/jpeg' },
                    { src: poster, sizes: '512x512', type: 'image/jpeg' },
                ] : []
            });
        } catch (error) {
            console.warn('Error setting media session metadata:', error);
        }
    }

    /**
     * Setup buffering indicator
     */
    private setupBufferingIndicator(): void {
        // Create buffering overlay
        this.bufferingOverlay = this.createBufferingOverlay();

        // Show buffering indicator when video is waiting
        this.video.addEventListener('waiting', () => {
            if (this.bufferTimeout) clearTimeout(this.bufferTimeout);
            
            // Debounce to avoid flashing on quick buffers
            this.bufferTimeout = window.setTimeout(() => {
                if (this.bufferingOverlay) {
                    this.bufferingOverlay.style.display = 'flex';
                    this.updateBufferHealthDisplay();
                }
            }, 200);
        });

        // Hide buffering indicator when playback starts/resumes
        this.video.addEventListener('playing', () => {
            if (this.bufferTimeout) clearTimeout(this.bufferTimeout);
            if (this.bufferingOverlay) {
                this.bufferingOverlay.style.display = 'none';
            }
        });

        this.video.addEventListener('canplay', () => {
            if (this.bufferTimeout) clearTimeout(this.bufferTimeout);
            if (this.bufferingOverlay) {
                this.bufferingOverlay.style.display = 'none';
            }
        });

        // Update buffer health periodically when buffering
        setInterval(() => {
            if (this.bufferingOverlay?.style.display === 'flex') {
                this.updateBufferHealthDisplay();
            }
        }, 500);
    }

    /**
     * Create buffering overlay element
     */
    private createBufferingOverlay(): HTMLElement {
        const overlay = document.createElement('div');
        overlay.className = 'buffering-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 998;
            gap: 16px;
        `;

        overlay.innerHTML = `
            <div class="spinner" style="
                border: 4px solid rgba(255, 255, 255, 0.3);
                border-top: 4px solid white;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                animation: spin 1s linear infinite;
            "></div>
            <div style="color: white; font-size: 18px; font-weight: 500;">Buffering...</div>
            <div id="buffer-health" style="
                color: rgba(255, 255, 255, 0.8);
                font-size: 14px;
                font-family: monospace;
            "></div>
        `;

        // Add spinner animation if not already in styles
        if (!document.querySelector('#player-spinner-style')) {
            const style = document.createElement('style');
            style.id = 'player-spinner-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        this.container.appendChild(overlay);
        return overlay;
    }

    /**
     * Setup playback speed selector
     */
    private setupSpeedSelector(): void {
        const speedSelector = document.getElementById('speed-selector');
        if (!speedSelector) return;

        const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

        speedOptions.forEach(speed => {
            const btn = document.createElement('button');
            btn.textContent = `${speed}x`;
            btn.dataset.speed = String(speed);
            
            if (speed === 1) {
                btn.classList.add('active');
            }

            btn.addEventListener('click', () => {
                this.setPlaybackSpeed(speed);
                // Update active state
                speedSelector.querySelectorAll('button:not(#speed-toggle-btn)').forEach(b => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
            });

            speedSelector.appendChild(btn);
        });

        // Update the toggle button text when speed changes
        this.video.addEventListener('ratechange', () => {
            const toggleBtn = document.getElementById('speed-toggle-btn');
            if (toggleBtn) {
                toggleBtn.textContent = `${this.video.playbackRate}x`;
            }
        });
    }

    /**
     * Set playback speed
     */
    private setPlaybackSpeed(speed: number): void {
        this.video.playbackRate = speed;
        showToast(`Playback speed: ${speed}x`, 'info');
    }

    /**
     * Increase playback speed
     */
    private increaseSpeed(): void {
        const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
        const currentSpeed = this.video.playbackRate;
        const currentIndex = speeds.findIndex(s => Math.abs(s - currentSpeed) < 0.01);
        
        if (currentIndex < speeds.length - 1) {
            const newSpeed = speeds[currentIndex + 1];
            this.setPlaybackSpeed(newSpeed);
            this.updateSpeedButtonState(newSpeed);
        }
    }

    /**
     * Decrease playback speed
     */
    private decreaseSpeed(): void {
        const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
        const currentSpeed = this.video.playbackRate;
        const currentIndex = speeds.findIndex(s => Math.abs(s - currentSpeed) < 0.01);
        
        if (currentIndex > 0) {
            const newSpeed = speeds[currentIndex - 1];
            this.setPlaybackSpeed(newSpeed);
            this.updateSpeedButtonState(newSpeed);
        }
    }

    /**
     * Update speed button active state
     */
    private updateSpeedButtonState(speed: number): void {
        const speedSelector = document.getElementById('speed-selector');
        if (!speedSelector) return;

        speedSelector.querySelectorAll('button:not(#speed-toggle-btn)').forEach(btn => {
            const el = btn as HTMLButtonElement;
            const btnSpeed = parseFloat(el.dataset.speed || '1');
            if (Math.abs(btnSpeed - speed) < 0.01) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    }

    /**
     * Update buffer health display
     */
    private updateBufferHealthDisplay(): void {
        if (!this.bufferingOverlay) return;

        const healthEl = this.bufferingOverlay.querySelector('#buffer-health');
        if (!healthEl) return;

        try {
            const buffer = this.video.buffered;
            if (buffer.length > 0) {
                const bufferedEnd = buffer.end(buffer.length - 1);
                const currentTime = this.video.currentTime;
                const bufferHealth = Math.max(0, bufferedEnd - currentTime);

                if (bufferHealth > 0) {
                    healthEl.textContent = `Buffer: ${bufferHealth.toFixed(1)}s`;
                } else {
                    healthEl.textContent = 'Loading...';
                }
            } else {
                healthEl.textContent = 'Loading...';
            }
        } catch (error) {
            // Ignore errors during buffer health calculation
        }
    }

    /**
     * Setup torrent stats UI
     */
    private setupTorrentStatsUI(): void {
        // Check if the stats container already exists
        let statsContainer = document.getElementById('torrent-stats');
        if (!statsContainer) {
            statsContainer = document.createElement('div');
            statsContainer.id = 'torrent-stats';
            statsContainer.style.cssText = `
                position: absolute;
                top: 60px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 15px;
                border-radius: 8px;
                font-size: 12px;
                font-family: monospace;
                z-index: 1000;
                min-width: 200px;
            `;
            this.container.appendChild(statsContainer);
        }
        this.torrentStatsElement = statsContainer;
        statsContainer.style.display = 'block';
    }

    /**
     * Update torrent stats UI
     */
    private updateTorrentStatsUI(stats: any): void {
        if (!this.torrentStatsElement || !this.TorrentPlayerClass) return;

        this.torrentStatsElement.innerHTML = `
            <div style="margin-bottom: 8px; font-weight: bold; color: #4CAF50;">📊 Torrent Stats</div>
            <div>⬇️ Download: ${this.TorrentPlayerClass.formatSpeed(stats.downloadSpeed)}</div>
            <div>⬆️ Upload: ${this.TorrentPlayerClass.formatSpeed(stats.uploadSpeed)}</div>
            <div>👥 Peers: ${stats.numPeers}</div>
            <div>📥 Downloaded: ${this.TorrentPlayerClass.formatBytes(stats.downloaded)}</div>
            <div>📤 Uploaded: ${this.TorrentPlayerClass.formatBytes(stats.uploaded)}</div>
            <div>⏳ Progress: ${(stats.progress * 100).toFixed(1)}%</div>
        `;
    }

    /**
     * Hide torrent stats UI
     */
    private hideTorrentStatsUI(): void {
        if (this.torrentStatsElement) {
            this.torrentStatsElement.style.display = 'none';
        }
    }

    /**
     * Start periodic progress saving (every 30 seconds)
     */
    private startProgressSaving(): void {
        // Clear any existing interval
        this.stopProgressSaving();

        // Save progress every 30 seconds
        this.progressSaveInterval = window.setInterval(() => {
            // Trigger progress save through app
            const app = (window as any).app;
            if (app && typeof app.updateWatchProgress === 'function') {
                app.updateWatchProgress();
            }
        }, 30000); // 30 seconds
    }

    /**
     * Stop periodic progress saving
     */
    private stopProgressSaving(): void {
        if (this.progressSaveInterval) {
            clearInterval(this.progressSaveInterval);
            this.progressSaveInterval = null;
        }
    }

    /**
     * Setup streaming stats overlay
     */
    private setupStatsOverlay(): void {
        this.statsOverlay = this.createStatsOverlay();
    }

    /**
     * Create stats overlay element
     */
    private createStatsOverlay(): HTMLElement {
        const overlay = document.createElement('div');
        overlay.className = 'stats-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 60px;
            left: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: #00ff00;
            padding: 16px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.6;
            display: none;
            z-index: 999;
            min-width: 300px;
            backdrop-filter: blur(10px);
        `;

        overlay.innerHTML = `
            <div style="margin-bottom: 12px; font-weight: bold; color: #fff; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px;">
                📊 Streaming Stats <span style="color: #666; font-size: 11px; float: right;">Ctrl+Shift+D</span>
            </div>
            <div id="stats-content"></div>
        `;

        this.container.appendChild(overlay);
        return overlay;
    }

    /**
     * Toggle stats overlay visibility
     */
    private toggleStats(): void {
        if (!this.statsOverlay) return;

        this.statsVisible = !this.statsVisible;

        if (this.statsVisible) {
            this.statsOverlay.style.display = 'block';
            this.startStatsUpdate();
            showToast('Stats overlay enabled (Ctrl+Shift+D to hide)', 'info');
        } else {
            this.statsOverlay.style.display = 'none';
            this.stopStatsUpdate();
        }
    }

    /**
     * Start stats update interval
     */
    private startStatsUpdate(): void {
        this.stopStatsUpdate();
        
        // Update immediately
        this.updateStats();

        // Then update every second
        this.statsUpdateInterval = window.setInterval(() => {
            this.updateStats();
        }, 1000);
    }

    /**
     * Stop stats update interval
     */
    private stopStatsUpdate(): void {
        if (this.statsUpdateInterval) {
            clearInterval(this.statsUpdateInterval);
            this.statsUpdateInterval = null;
        }
    }

    /**
     * Update stats overlay content
     */
    private updateStats(): void {
        if (!this.statsOverlay || !this.statsVisible) return;

        const contentEl = this.statsOverlay.querySelector('#stats-content');
        if (!contentEl) return;

        const stats = this.collectStats();

        contentEl.innerHTML = `
            <div style="margin-bottom: 8px;">
                <div style="color: #888;">Video</div>
                <div>Resolution: <span style="color: #00ff00;">${stats.resolution}</span></div>
                <div>FPS: <span style="color: #00ff00;">${stats.fps}</span></div>
                <div>Bitrate: <span style="color: #00ff00;">${stats.bitrate}</span></div>
                <div>Format: <span style="color: #00ff00;">${stats.format}</span></div>
            </div>
            <div style="margin-bottom: 8px;">
                <div style="color: #888;">Playback</div>
                <div>Speed: <span style="color: #00ff00;">${stats.playbackRate}x</span></div>
                <div>Volume: <span style="color: #00ff00;">${stats.volume}%</span></div>
                <div>Time: <span style="color: #00ff00;">${stats.currentTime} / ${stats.duration}</span></div>
            </div>
            <div style="margin-bottom: 8px;">
                <div style="color: #888;">Buffer</div>
                <div>Buffered: <span style="color: ${stats.bufferHealth > 10 ? '#00ff00' : stats.bufferHealth > 5 ? '#ffaa00' : '#ff0000'};">${stats.bufferHealth}s</span></div>
                <div>State: <span style="color: #00ff00;">${stats.readyState}</span></div>
            </div>
            <div style="margin-bottom: 8px;">
                <div style="color: #888;">Network</div>
                <div>Type: <span style="color: #00ff00;">${stats.networkType}</span></div>
                <div>Downlink: <span style="color: #00ff00;">${stats.downlink}</span></div>
                <div>Latency: <span style="color: #00ff00;">${stats.rtt}ms</span></div>
            </div>
            ${stats.hlsStats ? `
            <div style="margin-bottom: 8px;">
                <div style="color: #888;">HLS</div>
                <div>Level: <span style="color: #00ff00;">${stats.hlsStats.currentLevel}</span></div>
                <div>Dropped: <span style="color: ${stats.hlsStats.droppedFrames > 0 ? '#ff0000' : '#00ff00'};">${stats.hlsStats.droppedFrames}</span></div>
            </div>
            ` : ''}
            ${stats.dashStats ? `
            <div style="margin-bottom: 8px;">
                <div style="color: #888;">DASH</div>
                <div>Quality: <span style="color: #00ff00;">${stats.dashStats.currentQuality}</span></div>
                <div>Bitrate: <span style="color: #00ff00;">${stats.dashStats.currentBitrate} kbps</span></div>
            </div>
            ` : ''}
        `;
    }

    /**
     * Collect streaming statistics
     */
    private collectStats(): any {
        const formatTime = (seconds: number): string => {
            if (!isFinite(seconds)) return '--:--';
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            return `${m}:${s.toString().padStart(2, '0')}`;
        };

        const formatBytes = (bytes: number): string => {
            if (bytes === 0) return '0 bps';
            const k = 1000;
            const sizes = ['bps', 'kbps', 'Mbps', 'Gbps'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
        };

        // Overall bitrate display (if available)
        let bitrateDisplay = 'N/A';
        if (this.dashPlayer) {
            const currentBps = this.dashPlayer.getCurrentBitrate();
            if (currentBps > 0) bitrateDisplay = formatBytes(currentBps);
        }

        // Basic video stats
        const resolution = this.video.videoWidth && this.video.videoHeight 
            ? `${this.video.videoWidth}x${this.video.videoHeight}`
            : 'N/A';

        // Calculate FPS (approximate)
        let fps = 'N/A';
        if ((this.video as any).getVideoPlaybackQuality) {
            const quality = (this.video as any).getVideoPlaybackQuality();
            const totalFrames = quality.totalVideoFrames || 0;
            const droppedFrames = quality.droppedVideoFrames || 0;
            fps = totalFrames > 0 ? `${Math.round((totalFrames - droppedFrames) / this.video.currentTime)}` : 'N/A';
        }

        // Buffer health
        let bufferHealth = 0;
        try {
            const buffer = this.video.buffered;
            if (buffer.length > 0) {
                const bufferedEnd = buffer.end(buffer.length - 1);
                bufferHealth = Math.max(0, bufferedEnd - this.video.currentTime);
            }
        } catch (e) {
            // Ignore
        }

        // Network info
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
        const networkType = connection?.effectiveType || 'unknown';
        const downlink = connection?.downlink ? `${connection.downlink} Mbps` : 'N/A';
        const rtt = connection?.rtt || 'N/A';

        // Ready state
        const readyStates = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
        const readyState = readyStates[this.video.readyState] || 'UNKNOWN';

        // HLS stats
        let hlsStats = null;
        if (this.hls) {
            const currentLevel = this.hls.currentLevel;
            const levels = this.hls.levels;
            const droppedFrames = (this.video as any).getVideoPlaybackQuality?.()?.droppedVideoFrames || 0;
            hlsStats = {
                currentLevel: currentLevel >= 0 && levels[currentLevel] ? `${levels[currentLevel].height}p` : 'Auto',
                droppedFrames
            };
        }

        // DASH stats
        let dashStats = null;
        if (this.dashPlayer) {
            const stats = this.dashPlayer.getStats();
            if (stats) {
                dashStats = {
                    currentQuality: stats.currentQuality >= 0 ? `Level ${stats.currentQuality}` : 'Auto',
                    currentBitrate: Math.round(stats.currentBitrate / 1000)
                };
            }
        }

        return {
            resolution,
            fps,
            bitrate: bitrateDisplay,
            format: this.video.currentSrc ? this.detectFormat(this.video.currentSrc) : 'N/A',
            playbackRate: this.video.playbackRate,
            volume: Math.round(this.video.volume * 100),
            currentTime: formatTime(this.video.currentTime),
            duration: formatTime(this.video.duration),
            bufferHealth: bufferHealth.toFixed(1),
            readyState,
            networkType,
            downlink,
            rtt,
            hlsStats,
            dashStats
        };
    }

    /**
     * Detect stream format from URL
     */
    private detectFormat(url: string): string {
        if (url.includes('.m3u8')) return 'HLS';
        if (url.includes('.mpd')) return 'DASH';
        if (url.includes('magnet:')) return 'Torrent';
        if (url.includes('.mp4')) return 'MP4';
        if (url.includes('.webm')) return 'WebM';
        if (url.includes('.mkv')) return 'MKV';
        return 'Unknown';
    }

    /**
     * Setup network-adaptive quality adjustment
     */
    private setupNetworkAdaptive(): void {
        // Check if Network Information API is available
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
        
        if (!connection) {
            console.log('Network Information API not supported - adaptive quality disabled');
            return;
        }

        // Listen for network changes
        connection.addEventListener('change', () => {
            if (!this.networkAdaptiveEnabled) return;
            
            // Debounce network changes (don't react too quickly)
            const now = Date.now();
            if (now - this.lastNetworkChange < 5000) return;
            this.lastNetworkChange = now;

            this.adaptToNetworkConditions(connection);
        });

        // Initial adaptation
        this.adaptToNetworkConditions(connection);

        console.log('Network-adaptive quality enabled');
    }

    /**
     * Adapt streaming quality based on network conditions
     */
    private adaptToNetworkConditions(connection: any): void {
        const effectiveType = connection.effectiveType; // 'slow-2g', '2g', '3g', '4g'
        const downlink = connection.downlink; // Mbps
        const rtt = connection.rtt; // ms (latency)
        const saveData = connection.saveData; // boolean

        console.log(`Network changed: ${effectiveType}, ${downlink} Mbps, ${rtt}ms RTT, saveData: ${saveData}`);

        // If user has enabled data saver, force lowest quality
        if (saveData) {
            this.adjustQualityForNetwork('lowest', 'Data Saver mode detected');
            return;
        }

        // Adapt based on effective network type and downlink speed
        if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 1) {
            // Very slow connection - lowest quality
            this.adjustQualityForNetwork('lowest', `Slow connection (${effectiveType})`);
        } else if (effectiveType === '3g' || downlink < 2.5) {
            // Moderate connection - medium quality (480p/720p)
            this.adjustQualityForNetwork('medium', `Moderate connection (${effectiveType})`);
        } else if (downlink >= 2.5 && downlink < 10) {
            // Good connection - high quality (720p/1080p)
            this.adjustQualityForNetwork('high', `Good connection (${downlink} Mbps)`);
        } else if (downlink >= 10) {
            // Excellent connection - auto/highest quality
            this.adjustQualityForNetwork('auto', `Excellent connection (${downlink} Mbps)`);
        }
    }

    /**
     * Adjust quality based on network tier
     */
    private adjustQualityForNetwork(tier: 'lowest' | 'medium' | 'high' | 'auto', reason: string): void {
        // HLS quality adjustment
        if (this.hls && this.hls.levels && this.hls.levels.length > 1) {
            const levels = this.hls.levels;
            let targetLevel = -1; // -1 = auto

            switch (tier) {
                case 'lowest':
                    // Find lowest quality level
                    targetLevel = 0;
                    break;
                case 'medium':
                    // Find middle quality (~480p-720p)
                    const mediumLevels = levels.filter(l => l.height >= 480 && l.height <= 720);
                    if (mediumLevels.length > 0) {
                        const mediumLevel = mediumLevels[Math.floor(mediumLevels.length / 2)];
                        targetLevel = levels.indexOf(mediumLevel);
                    } else {
                        targetLevel = Math.floor(levels.length / 2);
                    }
                    break;
                case 'high':
                    // Find high quality (~1080p)
                    const highLevels = levels.filter(l => l.height >= 720 && l.height <= 1080);
                    if (highLevels.length > 0) {
                        const highLevel = highLevels[highLevels.length - 1];
                        targetLevel = levels.indexOf(highLevel);
                    } else {
                        targetLevel = Math.max(0, levels.length - 2);
                    }
                    break;
                case 'auto':
                    targetLevel = -1; // Enable ABR
                    break;
            }

            if (this.hls.currentLevel !== targetLevel) {
                this.hls.currentLevel = targetLevel;
                const qualityName = targetLevel >= 0 ? `${levels[targetLevel].height}p` : 'Auto';
                showToast(`Quality adjusted to ${qualityName} (${reason})`, 'info');
                console.log(`HLS quality adjusted to level ${targetLevel} (${qualityName})`);
            }
        }

        // DASH quality adjustment
        if (this.dashPlayer && this.dashPlayer.isReady()) {
            const levels = this.dashPlayer.getQualityLevels();
            if (levels.length > 1) {
                let targetLevel = -1; // -1 = auto

                switch (tier) {
                    case 'lowest':
                        targetLevel = 0;
                        break;
                    case 'medium':
                        const mediumLevels = levels.filter(l => l.height >= 480 && l.height <= 720);
                        if (mediumLevels.length > 0) {
                            targetLevel = mediumLevels[Math.floor(mediumLevels.length / 2)].qualityIndex;
                        } else {
                            targetLevel = Math.floor(levels.length / 2);
                        }
                        break;
                    case 'high':
                        const highLevels = levels.filter(l => l.height >= 720 && l.height <= 1080);
                        if (highLevels.length > 0) {
                            targetLevel = highLevels[highLevels.length - 1].qualityIndex;
                        } else {
                            targetLevel = Math.max(0, levels.length - 2);
                        }
                        break;
                    case 'auto':
                        targetLevel = -1;
                        break;
                }

                if (this.dashPlayer.getCurrentQualityLevel() !== targetLevel) {
                    this.dashPlayer.setQualityLevel(targetLevel);
                    const qualityName = targetLevel >= 0 ? `${levels[targetLevel].height}p` : 'Auto';
                    showToast(`Quality adjusted to ${qualityName} (${reason})`, 'info');
                    console.log(`DASH quality adjusted to level ${targetLevel} (${qualityName})`);
                }
            }
        }
    }

    /**
     * Enable/disable network-adaptive quality
     */
    setNetworkAdaptive(enabled: boolean): void {
        this.networkAdaptiveEnabled = enabled;
        console.log(`Network-adaptive quality: ${enabled ? 'enabled' : 'disabled'}`);
        
        if (enabled) {
            showToast('Network-adaptive quality enabled', 'success');
        } else {
            showToast('Network-adaptive quality disabled', 'info');
        }
    }

    /**
     * Handle HLS fatal errors with retry and quality downgrade
     */
    private async handleHlsError(data: any): Promise<void> {
        if (!this.hlsModule || !this.hls) return;

        const errorType = data.type;
        const errorDetails = data.details;

        console.error(`HLS fatal error: ${errorType} - ${errorDetails}`);

        switch (errorType) {
            case this.hlsModule.ErrorTypes.NETWORK_ERROR:
                await this.handleNetworkError();
                break;
                
            case this.hlsModule.ErrorTypes.MEDIA_ERROR:
                await this.handleMediaError();
                break;
                
            default:
                console.error('Unrecoverable HLS error');
                showToast('Playback failed. Please try another source.', 'error');
                break;
        }
    }

    /**
     * Handle network errors with exponential backoff retry
     */
    private async handleNetworkError(): Promise<void> {
        if (this.retryCount >= this.maxRetries) {
            console.error('Max retries reached for network error');
            showToast('Network connection lost. Please check your internet.', 'error');
            this.retryCount = 0;
            return;
        }

        this.retryCount++;
        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1); // Exponential backoff

        console.log(`Retry ${this.retryCount}/${this.maxRetries} after ${delay}ms...`);
        showToast(`Connection lost. Retrying (${this.retryCount}/${this.maxRetries})...`, 'info');

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            this.hls?.startLoad();
            console.log('HLS restart initiated');
        } catch (err) {
            console.error('Failed to restart HLS:', err);
        }
    }

    /**
     * Handle media errors with quality downgrade
     */
    private async handleMediaError(): Promise<void> {
        console.log('Attempting to recover from media error...');

        try {
            // First attempt: try standard recovery
            this.hls?.recoverMediaError();
            showToast('Media error detected. Attempting recovery...', 'warning');

            // Wait a bit to see if recovery works
            await new Promise(resolve => setTimeout(resolve, 2000));

            // If we're still here, try downgrading quality
            if (this.hls && this.hls.levels && this.hls.levels.length > 1) {
                const currentLevel = this.hls.currentLevel;
                
                if (currentLevel > 0 || currentLevel === -1) {
                    // Downgrade to lowest quality
                    this.hls.currentLevel = 0;
                    console.log('Downgraded to lowest quality for stability');
                    showToast('Switched to lower quality for stability', 'info');
                } else {
                    // Already at lowest quality, try swapping buffer
                    console.log('Attempting buffer swap recovery...');
                    this.hls.swapAudioCodec();
                    this.hls.recoverMediaError();
                }
            }
        } catch (err) {
            console.error('Media error recovery failed:', err);
            showToast('Unable to recover playback. Try reloading.', 'error');
        }
    }

    /**
     * Handle DASH errors
     */
    private handleDashError(error: any): void {
        console.error('DASH error:', error);

        if (!this.dashPlayer) return;

        // Check if it's a network error
        if (error.code === 'MANIFEST_LOAD_ERROR' || error.code === 'SEGMENT_LOAD_ERROR') {
            this.handleDashNetworkError();
        } else if (error.code === 'MEDIA_ERROR') {
            this.handleDashMediaError();
        } else {
            showToast('DASH playback error. Please try reloading.', 'error');
        }
    }

    /**
     * Handle DASH network errors
     */
    private async handleDashNetworkError(): Promise<void> {
        if (this.retryCount >= this.maxRetries) {
            console.error('Max retries reached for DASH network error');
            showToast('Network connection lost. Please check your internet.', 'error');
            this.retryCount = 0;
            return;
        }

        this.retryCount++;
        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);

        console.log(`DASH retry ${this.retryCount}/${this.maxRetries} after ${delay}ms...`);
        showToast(`Connection lost. Retrying (${this.retryCount}/${this.maxRetries})...`, 'info');

        await new Promise(resolve => setTimeout(resolve, delay));

        // DASH player should auto-retry, but we can also try to reset if available
        console.log('DASH attempting auto-recovery...');
    }

    /**
     * Handle DASH media errors
     */
    private handleDashMediaError(): void {
        console.log('DASH media error - attempting quality downgrade...');

        if (!this.dashPlayer) return;

        const levels = this.dashPlayer.getQualityLevels();
        if (levels.length > 1) {
            // Downgrade to lowest quality
            this.dashPlayer.setQualityLevel(0);
            showToast('Switched to lower quality for stability', 'info');
            console.log('DASH downgraded to lowest quality');
        } else {
            showToast('Unable to recover DASH playback. Try reloading.', 'error');
        }
    }

    /**
     * Reset retry counter (call when playback succeeds)
     */
    private resetRetryCounter(): void {
        if (this.retryCount > 0) {
            console.log('Playback recovered successfully. Resetting retry counter.');
            this.retryCount = 0;
        }
    }

    /**
     * Handle video ended event (auto-advance in playlist)
     */
    private handleVideoEnded(): void {
        console.log('Video ended');
        
        // Stop progress saving
        this.stopProgressSaving();
        
        // Auto-advance to next in playlist if available
        if (this.playlistContext && this.playlistContext.currentIndex < this.playlistContext.items.length - 1) {
            console.log('Auto-advancing to next item in playlist');
            showToast('Playing next in playlist...', 'info');
            
            // Delay slightly to show the toast
            setTimeout(() => {
                this.playNext();
            }, 1000);
        } else {
            console.log('Playlist ended or not in playlist mode');
        }
    }

    /**
     * Play next item in playlist
     */
    private playNext(): void {
        if (!this.playlistContext) {
            console.log('Not in playlist mode');
            return;
        }

        if (this.playlistContext.currentIndex >= this.playlistContext.items.length - 1) {
            console.log('Already at last item in playlist');
            showToast('End of playlist', 'info');
            return;
        }

        if (this.playlistContext.onNext) {
            this.playlistContext.onNext();
        }
    }

    /**
     * Play previous item in playlist
     */
    private playPrevious(): void {
        if (!this.playlistContext) {
            console.log('Not in playlist mode');
            return;
        }

        if (this.playlistContext.currentIndex <= 0) {
            console.log('Already at first item in playlist');
            showToast('Start of playlist', 'info');
            return;
        }

        if (this.playlistContext.onPrevious) {
            this.playlistContext.onPrevious();
        }
    }

    /**
     * Update playlist context (when navigating between items)
     */
    setPlaylistContext(context: PlaylistContext | null): void {
        this.playlistContext = context;
        this.updatePlaylistUI();
    }

    /**
     * Update playlist UI elements
     */
    private updatePlaylistUI(): void {
        const queueInfo = document.getElementById('playlist-queue-info');
        if (!queueInfo) return;

        if (this.playlistContext && this.playlistContext.items.length > 1) {
            const current = this.playlistContext.currentIndex + 1;
            const total = this.playlistContext.items.length;
            queueInfo.textContent = `${current} / ${total} in playlist`;
            queueInfo.style.display = 'block';
        } else {
            queueInfo.style.display = 'none';
        }
    }
}

// Export singleton instance creation helper
export function createPlayer(options: PlayerOptions): VideoPlayer {
    return new VideoPlayer(options);
}
