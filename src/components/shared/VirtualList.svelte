<script lang="ts" context="module">
  export interface VirtualListItem {
    id: string | number;
    [key: string]: any;
  }
</script>

<script lang="ts" generics="T extends VirtualListItem">
  import { onMount, afterUpdate } from 'svelte';

  export let items: T[] = [];
  export let itemHeight: number = 250;
  export let overscan: number = 3;
  
  let scrollTop = 0;
  let containerHeight = 0;
  let viewport: HTMLElement;
  
  $: visibleStart = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  $: visibleEnd = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  $: visibleItems = items.slice(visibleStart, visibleEnd);
  $: offsetY = visibleStart * itemHeight;
  $: totalHeight = items.length * itemHeight;
  
  function handleScroll(e: Event) {
    scrollTop = (e.target as HTMLElement).scrollTop;
  }
  
  onMount(() => {
    if (viewport) {
      containerHeight = viewport.clientHeight;
    }
  });
  
  afterUpdate(() => {
    if (viewport && containerHeight === 0) {
      containerHeight = viewport.clientHeight;
    }
  });
</script>

<div 
  bind:this={viewport}
  class="virtual-list-viewport"
  on:scroll={handleScroll}
>
  <div class="virtual-list-spacer" style="height: {totalHeight}px;">
    <div class="virtual-list-content" style="transform: translateY({offsetY}px);">
      {#each visibleItems as item (item.id)}
        <slot {item} />
      {/each}
    </div>
  </div>
</div>

<style>
  .virtual-list-viewport {
    height: 100%;
    overflow-y: auto;
    position: relative;
  }
  
  .virtual-list-spacer {
    position: relative;
    width: 100%;
  }
  
  .virtual-list-content {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    will-change: transform;
  }
</style>
