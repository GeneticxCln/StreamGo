/**
 * DASH Player Adapter
 * Wrapper around dash.js library for MPEG-DASH streaming support
 */

// Lazy-loaded dash.js module
type DashJsType = typeof import('dashjs');
let dashJs: DashJsType | null = null;

export interface QualityLevel {
    height: number;
    width: number;
    bitrate: number;
    qualityIndex: number;
}

export class DashPlayer {
    private player: any = null; // dashjs.MediaPlayerClass
    private video: HTMLVideoElement;
    private qualityLevels: QualityLevel[] = [];
    private isLoaded: boolean = false;

    constructor(videoElement: HTMLVideoElement) {
        this.video = videoElement;
    }

    /**
     * Load DASH manifest and start playback
     */
    async load(url: string): Promise<void> {
        try {
            // Lazy load dash.js only when needed
            if (!dashJs) {
                console.log('Loading dashjs module...');
                dashJs = await import('dashjs');
            }

            // Create MediaPlayer instance
            this.player = dashJs.MediaPlayer().create();

            // Configure player settings
            this.player.updateSettings({
                streaming: {
                    abr: {
                        autoSwitchBitrate: {
                            video: true,
                        },
                    },
                    buffer: {
                        fastSwitchEnabled: true,
                    },
                },
            });

            // Set up event listeners
            this.setupEventListeners();

            // Initialize and attach to video element
            this.player.initialize(this.video, url, true);

            this.isLoaded = true;
            console.log('DASH player initialized successfully');
        } catch (error) {
            console.error('Error initializing DASH player:', error);
            throw error;
        }
    }

    /**
     * Set up event listeners for DASH player
     */
    private setupEventListeners(): void {
        if (!this.player) return;

        // Listen for manifest load to extract quality levels
        this.player.on('manifestLoaded', () => {
            console.log('DASH manifest loaded');
            this.extractQualityLevels();
        });

        // Listen for quality changes
        this.player.on('qualityChangeRendered', (event: any) => {
            console.log(`DASH quality changed to index ${event.newQuality}`);
        });

        // Listen for errors
        this.player.on('error', (event: any) => {
            console.error('DASH error:', event);
        });

        // Listen for playback started
        this.player.on('playbackStarted', () => {
            console.log('DASH playback started');
        });
    }

    /**
     * Extract available quality levels from the manifest
     */
    private extractQualityLevels(): void {
        if (!this.player) return;

        try {
            const bitrateList = this.player.getBitrateInfoListFor('video');
            if (bitrateList && bitrateList.length > 0) {
                this.qualityLevels = bitrateList.map((level: any, index: number) => ({
                    height: level.height,
                    width: level.width,
                    bitrate: level.bitrate,
                    qualityIndex: index,
                }));

                console.log(`Found ${this.qualityLevels.length} quality levels:`, this.qualityLevels);
            }
        } catch (error) {
            console.error('Error extracting quality levels:', error);
        }
    }

    /**
     * Get available quality levels
     */
    getQualityLevels(): QualityLevel[] {
        return this.qualityLevels;
    }

    /**
     * Set quality level by index
     * @param index Quality level index, or -1 for auto (ABR)
     */
    setQualityLevel(index: number): void {
        if (!this.player || !this.isLoaded) return;

        try {
            if (index === -1) {
                // Enable ABR (Adaptive Bitrate)
                this.player.updateSettings({
                    streaming: {
                        abr: {
                            autoSwitchBitrate: {
                                video: true,
                            },
                        },
                    },
                });
                console.log('DASH ABR enabled (auto quality)');
            } else {
                // Disable ABR and set manual quality
                this.player.updateSettings({
                    streaming: {
                        abr: {
                            autoSwitchBitrate: {
                                video: false,
                            },
                        },
                    },
                });
                this.player.setQualityFor('video', index);
                console.log(`DASH quality set to index ${index}`);
            }
        } catch (error) {
            console.error('Error setting DASH quality:', error);
        }
    }

    /**
     * Get current quality level index
     */
    getCurrentQualityLevel(): number {
        if (!this.player || !this.isLoaded) return -1;
        
        try {
            return this.player.getQualityFor('video');
        } catch (error) {
            console.error('Error getting current quality:', error);
            return -1;
        }
    }

    /**
     * Destroy player and cleanup resources
     */
    destroy(): void {
        if (this.player) {
            try {
                this.player.reset();
                console.log('DASH player destroyed');
            } catch (error) {
                console.error('Error destroying DASH player:', error);
            }
            this.player = null;
        }
        this.qualityLevels = [];
        this.isLoaded = false;
    }

    /**
     * Check if player is ready
     */
    isReady(): boolean {
        return this.isLoaded && this.player !== null;
    }

    /**
     * Get current bitrate
     */
    getCurrentBitrate(): number {
        if (!this.player || !this.isLoaded) return 0;

        try {
            const bitrateInfo = this.player.getBitrateInfoListFor('video');
            const currentQuality = this.getCurrentQualityLevel();
            if (bitrateInfo && bitrateInfo[currentQuality]) {
                return bitrateInfo[currentQuality].bitrate;
            }
        } catch (error) {
            console.error('Error getting current bitrate:', error);
        }
        return 0;
    }

    /**
     * Get player statistics
     */
    getStats(): any {
        if (!this.player || !this.isLoaded) return null;

        try {
            return {
                currentQuality: this.getCurrentQualityLevel(),
                currentBitrate: this.getCurrentBitrate(),
                bufferLevel: this.player.getBufferLength('video'),
                droppedFrames: this.player.getMetricsFor('video')?.DroppedFrames || 0,
            };
        } catch (error) {
            console.error('Error getting DASH stats:', error);
            return null;
        }
    }
}
