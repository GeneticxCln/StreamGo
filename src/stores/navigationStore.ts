import { writable } from 'svelte/store';

interface NavigationState {
  activeSection: string;
  searchQuery: string | null;
}

function createNavigationStore() {
  const { subscribe, update } = writable<NavigationState>({
    activeSection: 'home',
    searchQuery: null,
  });

  return {
    subscribe,
    goTo(section: string) {
      update(() => ({ activeSection: section, searchQuery: null }));
    },
    search(query: string) {
      update(() => ({ activeSection: 'search', searchQuery: query }));
    }
  };
}

export const navigationStore = createNavigationStore();
