<script lang="ts">
  import { onMount } from 'svelte';
  import { searchStore } from '@/stores/searchStore';
  import { navigationStore } from '@/stores/navigationStore';

  let searchQuery = '';
  let showHistory = false;

  onMount(() => {
    searchStore.loadHistory();
  });

  function performSearch() {
    if (!searchQuery.trim()) return;
    searchStore.addQuery(searchQuery);
    navigationStore.search(searchQuery);
    showHistory = false;
  }

  function searchFromHistory(query: string) {
    searchQuery = query;
    performSearch();
  }
</script>

<div class="search-bar" style="position: relative;">
  <input type="text" bind:value={searchQuery} placeholder="Search..." on:focus={() => showHistory = true} on:blur={() => setTimeout(() => showHistory = false, 200)} on:keypress={(e) => e.key === 'Enter' && performSearch()} />
  <svg class="search-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
  </svg>

  {#if showHistory && $searchStore && $searchStore.length > 0}
    <div class="search-history-dropdown">
        <div class="search-history-header">
            <span>Recent searches</span>
            <button class="clear-history-btn" on:click={() => searchStore.clearAll()}>Clear all</button>
        </div>
        <div class="search-history-list">
            {#each $searchStore as query (query)}
              <div class="search-history-item">
                  <div class="search-history-item-text" role="button" tabindex="0" on:mousedown={() => searchFromHistory(query)} on:keydown={(e) => e.key === 'Enter' && searchFromHistory(query)}>
                      <span>{query}</span>
                  </div>
                  <button class="search-history-item-remove" on:mousedown|stopPropagation={() => searchStore.removeQuery(query)} title="Remove">✕</button>
              </div>
            {/each}
        </div>
    </div>
  {/if}
</div>
