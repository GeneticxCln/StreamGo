// Video Player Module with HLS support
// HLS.js is lazy-loaded only when needed to reduce initial bundle size
type HlsType = typeof import('hls.js').default;
import { DashPlayer } from './dash-player';
import { detectStreamFormat } from './stream-format-detector';
import { convertSRTtoVTT, adjustTimestamps } from './subtitle-parser';
import { showToast } from './ui-utils';


export interface PlayerOptions {
    container: HTMLElement;
    video: HTMLVideoElement;
    onClose?: () => void;
}

export class VideoPlayer {
    private container: HTMLElement;
    private video: HTMLVideoElement;
    private hls: InstanceType<HlsType> | null = null;
    private dashPlayer: DashPlayer | null = null;
    private onCloseCallback?: () => void;
    private isPipActive: boolean = false;
    private hlsModule: HlsType | null = null;
    private localSubtitleBlobs: string[] = [];
    private subtitleOffset: number = 0; // in seconds
    private originalSubtitleContent: Map<string, string> = new Map(); // Map<track.src, originalVttContent>
    private trackElementMap: Map<TextTrack, HTMLTrackElement> = new Map(); // Map TextTrack to HTMLTrackElement

    constructor(options: PlayerOptions) {
        this.container = options.container;
        this.video = options.video;
        this.onCloseCallback = options.onClose;
        this.setupKeyboardShortcuts();
        this.setupSubtitleLoader();
        this.setupSubtitleSyncControls();

        // Listen for track changes to update the UI
        this.video.textTracks.addEventListener('addtrack', () => this.setupSubtitleSelector());
        this.video.textTracks.addEventListener('removetrack', () => this.setupSubtitleSelector());

        // Also update UI when metadata is loaded (for embedded tracks)
        this.video.addEventListener('loadedmetadata', () => this.setupSubtitleSelector());
    }

    /**
     * Load and play a video URL (supports HLS and regular video files)
     */
    loadVideo(url: string, title: string = 'Video'): void {
        // Update title
        const titleEl = document.getElementById('player-title');
        if (titleEl) {
            titleEl.textContent = title;
        }

        this.loadStream(url);

        this.show();
    }

    /**
     * Detects stream format and loads the appropriate player.
     */
    private async loadStream(url: string) {
        // First, clean up any existing HLS or DASH instances and subtitles
        this.cleanupPreviousStream();

        const format = detectStreamFormat(url);

        switch (format) {
            case 'dash':
                console.log('DASH stream detected. Initializing dash.js...');
                this.dashPlayer = new DashPlayer(this.video);
                this.dashPlayer.load(url);
                // The quality selector for DASH is set up after the manifest is loaded
                this.video.addEventListener('loadedmetadata', () => this.setupDashQualitySelector(), { once: true });
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
                    switch (data.type) {
                        case this.hlsModule.ErrorTypes.NETWORK_ERROR:
                            console.log('Network error, trying to recover...');
                            this.hls?.startLoad();
                            break;
                        case this.hlsModule.ErrorTypes.MEDIA_ERROR:
                            console.log('Media error, trying to recover...');
                            this.hls?.recoverMediaError();
                            break;
                        default:
                            console.error('Fatal error, cannot recover');
                            this.destroy();
                            break;
                    }
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
        
        if (this.onCloseCallback) {
            this.onCloseCallback();
        }
    }

    /**
     * Cleanup and destroy player
     */
    destroy(): void {
        this.cleanupPreviousStream();
        this.video.pause();
        this.video.src = '';
    }

    /**
     * Cleans up resources from the previous stream (HLS, DASH, subtitles).
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
        this.localSubtitleBlobs.forEach(url => URL.revokeObjectURL(url));
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
                this.video.removeChild(track);
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
            URL.revokeObjectURL(currentSrc);
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
}

// Export singleton instance creation helper
export function createPlayer(options: PlayerOptions): VideoPlayer {
    return new VideoPlayer(options);
}
