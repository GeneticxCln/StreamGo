<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore, hasUnsavedChanges } from '../../stores/settings';
  import ProfileManager from '../ProfileManager.svelte';
  
  // Reactive values for sliders
  let playbackSpeed = 1.0;
  let volume = 0.8;
  
  // Load settings on mount
  onMount(async () => {
    await settingsStore.load();
  });
  
  // Sync slider values with store
  $: if ($settingsStore.settings) {
    playbackSpeed = $settingsStore.settings.playback_speed;
    volume = $settingsStore.settings.volume;
  }
  
  // Handle slider changes
  function handleSpeedChange(event: Event) {
    const value = parseFloat((event.target as HTMLInputElement).value);
    settingsStore.updateSetting('playback_speed', value);
  }
  
  function handleVolumeChange(event: Event) {
    const value = parseFloat((event.target as HTMLInputElement).value);
    settingsStore.updateSetting('volume', value);
  }
  
  // Handle save
  async function handleSave() {
    const success = await settingsStore.save();
    if (success) {
      // Show toast notification (you can add this)
      console.log('Settings saved successfully');
    }
  }
  
  // Handle reset
  function handleReset() {
    if (confirm('Reset all settings to defaults?')) {
      settingsStore.reset();
    }
  }

  // Handle profile switch
  function handleProfileSwitch(event: any) {
    console.log('Profile switched:', event.detail);
    // Reload settings for the new profile
    settingsStore.load();
  }
</script>

<section id="settings-section" class="content-section" data-testid="settings-section">
  {#if $settingsStore.loading && !$settingsStore.settings}
    <div class="loading-spinner">Loading settings...</div>
  {:else if $settingsStore.error && !$settingsStore.settings}
    <div class="error-message">
      <p>Error loading settings: {$settingsStore.error}</p>
      <button class="btn btn-secondary" on:click={() => settingsStore.load()}>
        Retry
      </button>
    </div>
  {:else if $settingsStore.settings}
    <div class="settings-header">
      <h2>Settings</h2>
      <p class="settings-subtitle">Configure your StreamGo experience</p>
    </div>
    
    <div class="settings-content">
      <!-- Appearance -->
      <div class="settings-section">
        <h3>🎨 Appearance</h3>
        
        <div class="setting-item">
          <label for="theme-select">Theme</label>
          <select 
            id="theme-select" 
            class="setting-select"
            bind:value={$settingsStore.settings.theme}
            on:change={() => settingsStore.updateSetting('theme', $settingsStore.settings!.theme)}
          >
            <option value="auto">Auto (System)</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="amoled">AMOLED (True Dark)</option>
            <option value="dracula">Dracula</option>
            <option value="solarized-light">Solarized Light</option>
            <option value="solarized-dark">Solarized Dark</option>
            <option value="nord">Nord</option>
          </select>
          <span class="setting-description">Choose your preferred color theme</span>
        </div>
      </div>

      <!-- Video Settings -->
      <div class="settings-section">
        <h3>🎬 Video Settings</h3>
        
        <div class="setting-item">
          <label for="quality-select">Default Video Quality</label>
          <select 
            id="quality-select" 
            class="setting-select"
            bind:value={$settingsStore.settings.quality}
            on:change={() => settingsStore.updateSetting('quality', $settingsStore.settings!.quality)}
          >
            <option value="auto">Auto (Adaptive)</option>
            <option value="2160p">4K (2160p)</option>
            <option value="1440p">QHD (1440p)</option>
            <option value="1080p">Full HD (1080p)</option>
            <option value="720p">HD (720p)</option>
            <option value="480p">SD (480p)</option>
            <option value="360p">Low (360p)</option>
          </select>
          <span class="setting-description">Higher quality requires more bandwidth</span>
        </div>
      </div>

      <!-- Playback -->
      <div class="settings-section">
        <h3>▶️ Playback</h3>
        
        <div class="setting-item">
          <label for="autoplay-toggle">
            <input 
              type="checkbox" 
              id="autoplay-toggle" 
              class="setting-checkbox"
              bind:checked={$settingsStore.settings.autoplay}
              on:change={() => settingsStore.updateSetting('autoplay', $settingsStore.settings!.autoplay)}
            >
            <span>Autoplay next episode</span>
          </label>
          <span class="setting-description">Automatically play next episode in series</span>
        </div>
        
        <div class="setting-item">
          <label for="playback-speed">
            Playback Speed: <span id="speed-value">{playbackSpeed.toFixed(2)}x</span>
          </label>
          <input 
            type="range" 
            id="playback-speed"
            min="0.5" 
            max="2.0" 
            step="0.25"
            bind:value={playbackSpeed}
            on:input={handleSpeedChange}
          >
        </div>
        
        <div class="setting-item">
          <label for="volume">
            Default Volume: <span id="volume-value">{Math.round(volume * 100)}%</span>
          </label>
          <input 
            type="range" 
            id="volume"
            min="0" 
            max="1" 
            step="0.1"
            bind:value={volume}
            on:input={handleVolumeChange}
          >
        </div>
      </div>

      <!-- Language & Region -->
      <div class="settings-section">
        <h3>🌐 Language & Region</h3>

        <div class="setting-item">
          <label for="ui-language">Interface Language</label>
          <select
            id="ui-language"
            class="setting-select"
            bind:value={$settingsStore.settings.ui_language}
            on:change={() => settingsStore.updateSetting('ui_language', $settingsStore.settings!.ui_language)}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="it">Italiano</option>
            <option value="pt">Português</option>
            <option value="ru">Русский</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
            <option value="zh">简体中文</option>
            <option value="ar">العربية</option>
            <option value="hi">हिन्दी</option>
          </select>
          <span class="setting-description">Language for the user interface</span>
        </div>

        <div class="setting-item">
          <label for="region">Region</label>
          <select
            id="region"
            class="setting-select"
            bind:value={$settingsStore.settings.region}
            on:change={() => settingsStore.updateSetting('region', $settingsStore.settings!.region)}
          >
            <option value="auto">Auto (System)</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="CA">Canada</option>
            <option value="AU">Australia</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="IT">Italy</option>
            <option value="ES">Spain</option>
            <option value="JP">Japan</option>
            <option value="KR">South Korea</option>
            <option value="CN">China</option>
            <option value="IN">India</option>
            <option value="BR">Brazil</option>
            <option value="MX">Mexico</option>
            <option value="AR">Argentina</option>
            <option value="RU">Russia</option>
          </select>
          <span class="setting-description">Regional settings for content and formatting</span>
        </div>
      </div>

      <!-- Subtitles -->
      <div class="settings-section">
        <h3>📝 Subtitles</h3>

        <div class="setting-item">
          <label for="subtitle-language">Subtitle Language</label>
          <select
            id="subtitle-language"
            class="setting-select"
            bind:value={$settingsStore.settings.subtitle_language}
            on:change={() => settingsStore.updateSetting('subtitle_language', $settingsStore.settings!.subtitle_language)}
          >
            <option value="none">None</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="pt">Portuguese</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
            <option value="zh">Chinese (Simplified)</option>
          </select>
        </div>
      </div>

      <!-- Notifications -->
      <div class="settings-section">
        <h3>🔔 Notifications</h3>
        
        <div class="setting-item">
          <label for="notifications-toggle">
            <input 
              type="checkbox" 
              id="notifications-toggle" 
              class="setting-checkbox"
              bind:checked={$settingsStore.settings.notifications_enabled}
              on:change={() => settingsStore.updateSetting('notifications_enabled', $settingsStore.settings!.notifications_enabled)}
            >
            <span>Enable episode notifications</span>
          </label>
          <span class="setting-description">Get notified when new episodes are available</span>
        </div>
      </div>

      <!-- Privacy -->
      <div class="settings-section">
        <h3>🔒 Privacy</h3>
        
        <div class="setting-item">
          <label for="telemetry-toggle">
            <input 
              type="checkbox" 
              id="telemetry-toggle" 
              class="setting-checkbox"
              bind:checked={$settingsStore.settings.telemetry_enabled}
              on:change={() => settingsStore.updateSetting('telemetry_enabled', $settingsStore.settings!.telemetry_enabled)}
            >
            <span>Send anonymous usage statistics</span>
          </label>
          <span class="setting-description">Help improve StreamGo (no personal data collected)</span>
        </div>
        
        <div class="setting-item">
          <label for="auto-update-toggle">
            <input 
              type="checkbox" 
              id="auto-update-toggle" 
              class="setting-checkbox"
              bind:checked={$settingsStore.settings.auto_update}
              on:change={() => settingsStore.updateSetting('auto_update', $settingsStore.settings!.auto_update)}
            >
            <span>Automatic updates</span>
          </label>
          <span class="setting-description">Keep StreamGo up to date automatically</span>
        </div>
      </div>

      <!-- Integrations -->
      <div class="settings-section">
        <h3>🔗 Integrations</h3>
        
        <div class="setting-item">
          <label for="tmdb-api-key">TMDB API Key</label>
          <input 
            type="password" 
            id="tmdb-api-key"
            class="setting-input"
            placeholder="Paste your TMDB API key"
            bind:value={$settingsStore.settings.tmdb_api_key}
            on:input={() => settingsStore.updateSetting('tmdb_api_key', $settingsStore.settings!.tmdb_api_key)}
          >
          <span class="setting-description">Used for Search (Discover works via addons)</span>
        </div>
      </div>

      <!-- Profile Management -->
      <div class="settings-section">
        <h3>👤 Profile Management</h3>
        <p class="section-description">Manage multiple user profiles with separate settings and content</p>
        <ProfileManager on:profileSwitched={handleProfileSwitch} />
      </div>

      <!-- Action Buttons -->
      <div class="settings-actions">
        <button
          class="btn btn-primary"
          on:click={handleSave}
          disabled={!$hasUnsavedChanges || $settingsStore.loading}
        >
          {#if $settingsStore.loading}
            Saving...
          {:else}
            💾 Save Settings
          {/if}
        </button>

        <button
          class="btn btn-secondary"
          on:click={handleReset}
          disabled={$settingsStore.loading}
        >
          🔄 Reset to Defaults
        </button>
      </div>
      
      {#if $hasUnsavedChanges}
        <p class="unsaved-warning">⚠️ You have unsaved changes</p>
      {/if}
      
      {#if $settingsStore.error}
        <p class="error-message">{$settingsStore.error}</p>
      {/if}
    </div>
  {/if}
</section>

<style>
  /* Component-specific styles */
  .unsaved-warning {
    color: var(--warning-color, #fbbf24);
    text-align: center;
    margin-top: 1rem;
    font-weight: 500;
  }
  
  .error-message {
    color: var(--accent-color, #ff4757);
    text-align: center;
    margin-top: 1rem;
  }
  
  .loading-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--text-secondary);
  }
  
  .setting-input {
    width: 100%;
    padding: 10px 15px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background-color: var(--background-secondary);
    color: var(--text-primary);
    font-size: 14px;
  }
  
  .setting-input:focus {
    outline: none;
    border-color: var(--primary-color);
  }
  
  /* Reuse existing StreamGo styles for everything else */
</style>
