<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import type { CalendarEntry } from '../../types/tauri';

  let daysAhead = 14;
  let entries: CalendarEntry[] = [];
  let loading = false;
  let error: string | null = null;

  onMount(loadCalendar);

  async function loadCalendar() {
    loading = true;
    error = null;
    try {
      entries = await invoke<CalendarEntry[]>('get_calendar', { daysAhead });
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  function formatDateKey(d: Date) {
    return d.toISOString().split('T')[0];
  }

  function groupByDate() {
    const groups: Record<string, CalendarEntry[]> = {};
    for (const e of entries) {
      const key = formatDateKey(new Date(e.air_date));
      (groups[key] ||= []).push(e);
    }
    return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b));
  }
</script>

<div class="calendar-section">
  <div class="calendar-header">
    <h2>Calendar</h2>
    <div class="calendar-controls">
      <label for="calendar-days" class="calendar-label">Show</label>
      <select id="calendar-days" class="setting-select" bind:value={daysAhead} on:change={loadCalendar}>
        <option value={7}>Next 7 days</option>
        <option value={14}>Next 14 days</option>
        <option value={30}>Next 30 days</option>
      </select>
      <button class="btn btn-secondary" on:click={loadCalendar}>Refresh</button>
    </div>
  </div>

  {#if loading}
    <div class="loading-spinner">Loading calendar...</div>
  {:else if error}
    <div class="error-state">{error}</div>
  {:else if entries.length === 0}
    <div class="empty-message">No upcoming episodes found for the selected range.</div>
  {:else}
    <div class="calendar-container">
      {#each groupByDate() as [key, group]}
        <div class="calendar-day">
          <div class="calendar-day-header">
            <div class="calendar-day-title">{new Date(key + 'T00:00:00Z').toLocaleDateString()}</div>
            <div class="calendar-day-date">{key}</div>
          </div>
          <div class="calendar-episodes">
            {#each group as e}
              <div class="calendar-card">
                <img src={e.poster_url || 'https://via.placeholder.com/160x240?text=No+Poster'} alt={e.series_name} class="calendar-card-poster" loading="lazy" />
                <div class="calendar-card-body">
                  <div class="calendar-card-title">{e.series_name}</div>
                  <div class="calendar-card-meta">S{e.season}E{e.episode} • {e.title}</div>
                  <div class="calendar-card-meta">{new Date(e.air_date).toLocaleString()}</div>
                  {#if e.description}
                    <div class="calendar-card-desc">{e.description}</div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>