// Video Player Module with HLS support
// HLS.js is lazy-loaded only when needed to reduce initial bundle size
type HlsType = typeof import('hls.js').default;

export interface PlayerOptions {
    container: HTMLElement;
    video: HTMLVideoElement;
    onClose?: () => void;
}

export class VideoPlayer {
    private container: HTMLElement;
    private video: HTMLVideoElement;
    private hls: InstanceType<HlsType> | null = null;
    private onCloseCallback?: () => void;
    private isPipActive: boolean = false;
    private hlsModule: HlsType | null = null;

    constructor(options: PlayerOptions) {
        this.container = options.container;
        this.video = options.video;
        this.onCloseCallback = options.onClose;
        this.setupKeyboardShortcuts();
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

        // Detect if URL is HLS stream
        if (this.isHlsStream(url)) {
            this.loadHlsStream(url);
        } else {
            this.loadRegularVideo(url);
        }

        this.show();
    }

    /**
     * Check if URL is an HLS stream
     */
    private isHlsStream(url: string): boolean {
        return url.includes('.m3u8') || url.includes('m3u8');
    }

    /**
     * Load HLS stream using hls.js (lazy-loaded)
     */
    private async loadHlsStream(url: string): Promise<void> {
        // Cleanup existing HLS instance
        if (this.hls) {
            this.hls.destroy();
        }

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
            alert('HLS streaming is not supported in your browser');
        }
    }

    /**
     * Load regular video file (MP4, WebM, etc.)
     */
    private loadRegularVideo(url: string): void {
        // Cleanup HLS if it was used before
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }

        const source = this.video.querySelector('source') as HTMLSourceElement;
        if (source) {
            source.src = url;
        } else {
            this.video.src = url;
        }
        
        this.video.load();
        this.video.play().catch(err => {
            console.error('Error playing video:', err);
        });
    }

    /**
     * Setup quality selector for HLS streams
     */
    private setupQualitySelector(): void {
        if (!this.hls) return;

        const levels = this.hls.levels;
        if (levels.length <= 1) return; // No need for selector if only one quality

        // Create quality selector UI (you'll need to add this to your HTML/CSS)
        const qualitySelector = document.getElementById('quality-selector');
        if (qualitySelector) {
            qualitySelector.innerHTML = levels.map((level, index) => {
                const height = level.height || 'Unknown';
                return `<button data-quality="${index}">${height}p</button>`;
            }).join('');

            // Add auto option
            qualitySelector.innerHTML = '<button data-quality="-1" class="active">Auto</button>' + qualitySelector.innerHTML;

            // Attach event listeners
            qualitySelector.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const target = e.target as HTMLButtonElement;
                    const quality = parseInt(target.dataset.quality || '-1');
                    
                    if (this.hls) {
                        this.hls.currentLevel = quality;
                        
                        // Update active state
                        qualitySelector.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                        target.classList.add('active');
                    }
                });
            });
        }
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
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
        this.video.pause();
        this.video.src = '';
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
        
        this.video.appendChild(track);
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
