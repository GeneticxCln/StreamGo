/**
 * Episode Navigator Component
 * Handles series navigation, season selection, and episode grid display
 */

import { invoke } from './utils';
import { Episode, MetaItem, EpisodeId } from './types/tauri';

export class EpisodeNavigator {
    private container: HTMLElement | null = null;
    private currentSeason: number = 1;
    private episodes: Episode[] = [];
    private onEpisodeSelect?: (episodeId: string) => void;

    constructor(containerId: string) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Episode navigator container #${containerId} not found`);
        }
    }

    /**
     * Load series metadata and display episode navigator
     */
    async loadSeries(seriesId: string, onEpisodeSelect?: (episodeId: string) => void): Promise<void> {
        this.onEpisodeSelect = onEpisodeSelect;

        try {
            // Fetch series metadata from addons
            const meta: MetaItem = await invoke('get_addon_meta', {
                contentId: seriesId,
                mediaType: 'series'
            });

            if (!meta.videos || meta.videos.length === 0) {
                this.showError('No episodes found for this series');
                return;
            }

            this.episodes = meta.videos;
            this.render(meta);
        } catch (error) {
            console.error('Failed to load series metadata:', error);
            this.showError(`Failed to load series: ${error}`);
        }
    }

    /**
     * Render episode navigator UI
     */
    private render(meta: MetaItem): void {
        if (!this.container) return;

        // Get unique seasons
        const seasons = [...new Set(this.episodes.map(ep => ep.season))]
            .filter(s => s !== undefined)
            .sort((a, b) => a - b) as number[];

        if (seasons.length === 0) {
            this.showError('No seasons found');
            return;
        }

        // Build UI
        const html = `
            <div class="episode-navigator">
                <div class="series-header">
                    <h2>${meta.name}</h2>
                    ${meta.imdbRating ? `<span class="rating">⭐ ${meta.imdbRating.toFixed(1)}</span>` : ''}
                </div>
                
                ${meta.description ? `<p class="series-description">${meta.description}</p>` : ''}
                
                <div class="season-selector">
                    ${seasons.map(season => `
                        <button 
                            class="season-btn ${season === this.currentSeason ? 'active' : ''}" 
                            data-season="${season}"
                        >
                            Season ${season}
                        </button>
                    `).join('')}
                </div>
                
                <div class="episodes-grid" id="episodes-grid">
                    ${this.renderEpisodes(this.currentSeason)}
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.attachEventListeners();
    }

    /**
     * Render episodes grid for a season
     */
    private renderEpisodes(season: number): string {
        const seasonEpisodes = this.episodes
            .filter(ep => ep.season === season)
            .sort((a, b) => a.episode - b.episode);

        if (seasonEpisodes.length === 0) {
            return '<p class="no-episodes">No episodes found for this season</p>';
        }

        return seasonEpisodes.map(episode => `
            <div class="episode-card" data-episode-id="${episode.id}">
                ${episode.thumbnail ? 
                    `<img src="${episode.thumbnail}" alt="${episode.title}" class="episode-thumbnail" loading="lazy">` :
                    `<div class="episode-thumbnail-placeholder">S${episode.season}E${episode.episode}</div>`
                }
                <div class="episode-info">
                    <h4 class="episode-title">
                        <span class="episode-number">E${episode.episode}</span>
                        ${episode.title}
                    </h4>
                    ${episode.runtime ? `<span class="episode-runtime">${episode.runtime}</span>` : ''}
                    ${episode.overview ? `<p class="episode-overview">${episode.overview}</p>` : ''}
                    ${episode.released ? `<span class="episode-date">${episode.released}</span>` : ''}
                </div>
            </div>
        `).join('');
    }

    /**
     * Attach event listeners
     */
    private attachEventListeners(): void {
        // Season selector buttons
        const seasonButtons = this.container?.querySelectorAll('.season-btn');
        seasonButtons?.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const season = parseInt((e.currentTarget as HTMLElement).dataset.season || '1');
                this.changeSeason(season);
            });
        });

        // Episode cards
        const episodeCards = this.container?.querySelectorAll('.episode-card');
        episodeCards?.forEach(card => {
            card.addEventListener('click', (e) => {
                const episodeId = (e.currentTarget as HTMLElement).dataset.episodeId;
                if (episodeId && this.onEpisodeSelect) {
                    this.onEpisodeSelect(episodeId);
                }
            });
        });
    }

    /**
     * Change selected season
     */
    private changeSeason(season: number): void {
        this.currentSeason = season;

        // Update season buttons
        const seasonButtons = this.container?.querySelectorAll('.season-btn');
        seasonButtons?.forEach(btn => {
            if (parseInt((btn as HTMLElement).dataset.season || '0') === season) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update episodes grid
        const episodesGrid = this.container?.querySelector('#episodes-grid');
        if (episodesGrid) {
            episodesGrid.innerHTML = this.renderEpisodes(season);
            
            // Re-attach episode card listeners
            const episodeCards = episodesGrid.querySelectorAll('.episode-card');
            episodeCards.forEach(card => {
                card.addEventListener('click', (e) => {
                    const episodeId = (e.currentTarget as HTMLElement).dataset.episodeId;
                    if (episodeId && this.onEpisodeSelect) {
                        this.onEpisodeSelect(episodeId);
                    }
                });
            });
        }
    }

    /**
     * Show error message
     */
    private showError(message: string): void {
        if (this.container) {
            this.container.innerHTML = `
                <div class="episode-navigator-error">
                    <p>❌ ${message}</p>
                </div>
            `;
        }
    }

    /**
     * Get episode by ID
     */
    getEpisode(episodeId: string): Episode | null {
        return this.episodes.find(ep => ep.id === episodeId) || null;
    }

    /**
     * Get next episode
     */
    getNextEpisode(currentEpisodeId: string): Episode | null {
        const parsed = EpisodeId.parse(currentEpisodeId);
        if (!parsed) return null;

        const { season, episode } = parsed;

        // Try next episode in same season
        let nextEp = this.episodes.find(ep => 
            ep.season === season && ep.episode === episode + 1
        );

        // If not found, try first episode of next season
        if (!nextEp) {
            nextEp = this.episodes.find(ep => 
                ep.season === season + 1 && ep.episode === 1
            );
        }

        return nextEp || null;
    }

    /**
     * Clear navigator
     */
    clear(): void {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.episodes = [];
    }
}

// Make globally available
if (typeof window !== 'undefined') {
    (window as any).EpisodeNavigator = EpisodeNavigator;
}
