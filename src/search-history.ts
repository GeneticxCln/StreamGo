/**
 * Search History Manager
 * Manages search query history with localStorage persistence
 */

const STORAGE_KEY = 'streamgo_search_history';
const MAX_HISTORY_ITEMS = 10;

export class SearchHistory {
    private history: string[] = [];

    constructor() {
        this.loadHistory();
    }

    /**
     * Load search history from localStorage
     */
    private loadHistory(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                this.history = JSON.parse(stored);
            }
        } catch (error) {
            console.error('Failed to load search history:', error);
            this.history = [];
        }
    }

    /**
     * Save search history to localStorage
     */
    private saveHistory(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
        } catch (error) {
            console.error('Failed to save search history:', error);
        }
    }

    /**
     * Add a search query to history
     * @param query - Search query to add
     */
    addQuery(query: string): void {
        const trimmed = query.trim();
        if (!trimmed) return;

        // Remove if already exists (move to front)
        this.history = this.history.filter(q => q.toLowerCase() !== trimmed.toLowerCase());

        // Add to front
        this.history.unshift(trimmed);

        // Limit to MAX_HISTORY_ITEMS
        if (this.history.length > MAX_HISTORY_ITEMS) {
            this.history = this.history.slice(0, MAX_HISTORY_ITEMS);
        }

        this.saveHistory();
    }

    /**
     * Get all search history items
     * @returns Array of search queries
     */
    getHistory(): string[] {
        return [...this.history];
    }

    /**
     * Remove a specific query from history
     * @param query - Query to remove
     */
    removeQuery(query: string): void {
        this.history = this.history.filter(q => q !== query);
        this.saveHistory();
    }

    /**
     * Clear all search history
     */
    clearAll(): void {
        this.history = [];
        this.saveHistory();
    }

    /**
     * Check if history has items
     * @returns true if history is not empty
     */
    hasHistory(): boolean {
        return this.history.length > 0;
    }
}
