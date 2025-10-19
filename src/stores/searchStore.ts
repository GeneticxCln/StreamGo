import { writable } from 'svelte/store';

const LOCAL_STORAGE_KEY = 'streamgo_search_history';

function createSearchStore() {
  const { subscribe, set, update } = writable<string[]>([]);

  function loadHistory() {
    const historyJson = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (historyJson) {
      try {
        const history = JSON.parse(historyJson);
        set(history);
      } catch (e) {
        set([]);
      }
    }
  }

  function saveHistory(history: string[]) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history));
  }

  return {
    subscribe,
    loadHistory,
    addQuery(query: string) {
      if (!query) return;
      update(history => {
        const newHistory = [query, ...history.filter(h => h !== query)].slice(0, 10);
        saveHistory(newHistory);
        return newHistory;
      });
    },
    removeQuery(query: string) {
      update(history => {
        const newHistory = history.filter(h => h !== query);
        saveHistory(newHistory);
        return newHistory;
      });
    },
    clearAll() {
      set([]);
      saveHistory([]);
    }
  };
}

export const searchStore = createSearchStore();
