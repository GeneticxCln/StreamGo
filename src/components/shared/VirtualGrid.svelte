<script lang="ts">
  import { onMount, afterUpdate, tick } from 'svelte';
  
  export let items: any[] = [];
  export let itemHeight: number = 400;
  export let itemWidth: number = 200;
  export let gap: number = 16;
  export let minColumns: number = 2;
  
  let viewport: HTMLElement;
  let containerWidth = 0;
  let scrollTop = 0;
  let viewportHeight = 0;
  
  $: columns = Math.max(minColumns, Math.floor((containerWidth + gap) / (itemWidth + gap)));
  $: rowHeight = itemHeight + gap;
  $: totalRows = Math.ceil(items.length / columns);
  $: totalHeight = totalRows * rowHeight;
  
  $: overscan = 1;
  $: firstVisibleRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  $: lastVisibleRow = Math.min(
    totalRows,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan
  );
  
  $: visibleRows = Array.from(
    { length: lastVisibleRow - firstVisibleRow },
    (_, i) => firstVisibleRow + i
  );
  
  $: offsetY = firstVisibleRow * rowHeight;
  
  function getItemsForRow(rowIndex: number) {
    const startIndex = rowIndex * columns;
    const endIndex = Math.min(startIndex + columns, items.length);
    return items.slice(startIndex, endIndex);
  }
  
  function handleScroll(e: Event) {
    scrollTop = (e.target as HTMLElement).scrollTop;
  }
  
  function updateDimensions() {
    if (viewport) {
      const rect = viewport.getBoundingClientRect();
      containerWidth = rect.width;
      viewportHeight = rect.height;
    }
  }
  
  onMount(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  });
  
  afterUpdate(async () => {
    await tick();
    if (containerWidth === 0 || viewportHeight === 0) {
      updateDimensions();
    }
  });
</script>

<div 
  bind:this={viewport}
  class="virtual-grid-viewport"
  on:scroll={handleScroll}
>
  <div class="virtual-grid-spacer" style="height: {totalHeight}px;">
    <div 
      class="virtual-grid-content" 
      style="
        transform: translateY({offsetY}px);
        display: grid;
        grid-template-columns: repeat({columns}, 1fr);
        gap: {gap}px;
        padding: {gap}px;
      "
    >
      {#each visibleRows as rowIndex (rowIndex)}
        {#each getItemsForRow(rowIndex) as item (item.id)}
          <slot item={item} />
        {/each}
      {/each}
    </div>
  </div>
</div>

<style>
  .virtual-grid-viewport {
    height: 100%;
    width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
  }
  
  .virtual-grid-spacer {
    position: relative;
    width: 100%;
  }
  
  .virtual-grid-content {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    will-change: transform;
  }
</style>
