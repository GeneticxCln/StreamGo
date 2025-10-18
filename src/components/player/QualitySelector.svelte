<script lang="ts">
  export let qualities: Array<{label: string; index: number; height?: number}> = [];
  export let currentQuality: number = -1;
  export let onChange: (index: number) => void;

  function handleSelect(index: number) {
    currentQuality = index;
    onChange(index);
  }
</script>

<div class="quality-selector">
  <button 
    class="quality-btn"
    class:active={currentQuality === -1}
    on:click={() => handleSelect(-1)}
  >
    Auto
  </button>
  
  {#each qualities as quality (quality.index)}
    <button 
      class="quality-btn"
      class:active={currentQuality === quality.index}
      on:click={() => handleSelect(quality.index)}
    >
      {quality.label}
    </button>
  {/each}
</div>

<style>
  .quality-selector {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .quality-btn {
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.9rem;
  }
  
  .quality-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .quality-btn.active {
    background: var(--accent-color, #0066ff);
    border-color: var(--accent-color, #0066ff);
  }
</style>
