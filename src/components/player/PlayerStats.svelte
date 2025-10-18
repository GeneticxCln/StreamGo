<script lang="ts">
  export let visible: boolean = false;
  export let stats: {
    resolution: string;
    fps: string;
    bitrate: string;
    format: string;
    playbackRate: number;
    volume: number;
    currentTime: string;
    duration: string;
    bufferHealth: string;
    readyState: string;
    networkType: string;
    downlink: string;
    rtt: string | number;
    hlsStats?: {
      currentLevel: string;
      droppedFrames: number;
    };
    dashStats?: {
      currentQuality: string;
      currentBitrate: number;
    };
  };
</script>

{#if visible}
  <div class="stats-overlay">
    <div class="stats-header">
      📊 Streaming Stats 
      <span class="stats-hint">Ctrl+Shift+D</span>
    </div>
    
    <div class="stats-content">
      <div class="stats-group">
        <div class="stats-label">Video</div>
        <div class="stats-item">Resolution: <span class="value">{stats.resolution}</span></div>
        <div class="stats-item">FPS: <span class="value">{stats.fps}</span></div>
        <div class="stats-item">Bitrate: <span class="value">{stats.bitrate}</span></div>
        <div class="stats-item">Format: <span class="value">{stats.format}</span></div>
      </div>
      
      <div class="stats-group">
        <div class="stats-label">Playback</div>
        <div class="stats-item">Speed: <span class="value">{stats.playbackRate}x</span></div>
        <div class="stats-item">Volume: <span class="value">{stats.volume}%</span></div>
        <div class="stats-item">Time: <span class="value">{stats.currentTime} / {stats.duration}</span></div>
      </div>
      
      <div class="stats-group">
        <div class="stats-label">Buffer</div>
        <div class="stats-item">
          Buffered: 
          <span 
            class="value"
            class:health-good={parseFloat(stats.bufferHealth) > 10}
            class:health-medium={parseFloat(stats.bufferHealth) > 5 && parseFloat(stats.bufferHealth) <= 10}
            class:health-poor={parseFloat(stats.bufferHealth) <= 5}
          >
            {stats.bufferHealth}s
          </span>
        </div>
        <div class="stats-item">State: <span class="value">{stats.readyState}</span></div>
      </div>
      
      <div class="stats-group">
        <div class="stats-label">Network</div>
        <div class="stats-item">Type: <span class="value">{stats.networkType}</span></div>
        <div class="stats-item">Downlink: <span class="value">{stats.downlink}</span></div>
        <div class="stats-item">Latency: <span class="value">{stats.rtt}ms</span></div>
      </div>
      
      {#if stats.hlsStats}
        <div class="stats-group">
          <div class="stats-label">HLS</div>
          <div class="stats-item">Level: <span class="value">{stats.hlsStats.currentLevel}</span></div>
          <div class="stats-item">
            Dropped: 
            <span 
              class="value"
              class:health-poor={stats.hlsStats.droppedFrames > 0}
              class:health-good={stats.hlsStats.droppedFrames === 0}
            >
              {stats.hlsStats.droppedFrames}
            </span>
          </div>
        </div>
      {/if}
      
      {#if stats.dashStats}
        <div class="stats-group">
          <div class="stats-label">DASH</div>
          <div class="stats-item">Quality: <span class="value">{stats.dashStats.currentQuality}</span></div>
          <div class="stats-item">Bitrate: <span class="value">{stats.dashStats.currentBitrate} kbps</span></div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .stats-overlay {
    position: absolute;
    top: 60px;
    left: 20px;
    background: rgba(0, 0, 0, 0.9);
    color: #00ff00;
    padding: 1rem;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.6;
    z-index: 999;
    min-width: 300px;
    backdrop-filter: blur(10px);
    pointer-events: none;
  }
  
  .stats-header {
    margin-bottom: 0.75rem;
    font-weight: bold;
    color: #fff;
    font-size: 14px;
    border-bottom: 1px solid rgba(255,255,255,0.2);
    padding-bottom: 0.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .stats-hint {
    color: #666;
    font-size: 11px;
  }
  
  .stats-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .stats-group {
    margin-bottom: 0.5rem;
  }
  
  .stats-label {
    color: #888;
    margin-bottom: 0.25rem;
  }
  
  .stats-item {
    color: #ccc;
    margin: 0.15rem 0;
  }
  
  .value {
    color: #00ff00;
    font-weight: bold;
  }
  
  .value.health-good {
    color: #00ff00;
  }
  
  .value.health-medium {
    color: #ffaa00;
  }
  
  .value.health-poor {
    color: #ff0000;
  }
</style>
