<script lang="ts">
  import type { Stream } from '../../types/tauri';
  import { mediaStore } from '@/stores/mediaStore';

  export let streams: Stream[] = [];
</script>

<div class="stream-picker">
  <h3>Available Streams</h3>
  {#if streams.length === 0}
    <p>No streams found for this item.</p>
  {:else}
    <ul>
      {#each streams as stream}
        <li on:click={() => mediaStore.playStream(stream)}>
          <span class="stream-title">{stream.title || 'Unknown Stream'}</span>
          <span class="stream-info">{stream.behaviorHints?.quality || ''}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .stream-picker { margin-top: 20px; }
  ul { list-style: none; padding: 0; }
  li {
    display: flex;
    justify-content: space-between;
    padding: 10px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  li:hover { background-color: var(--surface-2); }
  .stream-title { font-weight: bold; }
</style>
