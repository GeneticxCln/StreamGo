<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '@/stores/settings';

  onMount(() => {
    settingsStore.loadSettings();
  });
</script>

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
            <select id="theme-select" class="setting-select" bind:value={$settingsStore.settings.theme}>
                <option value="auto">Auto (System)</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
            </select>
            <span class="setting-description">Choose your preferred color theme</span>
        </div>
    </div>

    <!-- Video Settings -->
    <div class="settings-section">
        <h3>🎬 Video Settings</h3>
        <div class="setting-item">
            <label for="quality-select">Default Video Quality</label>
            <select id="quality-select" class="setting-select" bind:value={$settingsStore.settings.default_quality}>
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
        <div class="setting-item">
            <label for="hardware-accel-toggle">
                <input type="checkbox" id="hardware-accel-toggle" class="setting-checkbox" bind:checked={$settingsStore.settings.hardware_accel}>
                <span>Enable hardware acceleration</span>
            </label>
            <span class="setting-description">Use GPU for better performance and lower CPU usage</span>
        </div>
    </div>

    <!-- Playback -->
    <div class="settings-section">
        <h3>▶️ Playback</h3>
        <div class="setting-item">
            <label for="autoplay-toggle">
                <input type="checkbox" id="autoplay-toggle" class="setting-checkbox" bind:checked={$settingsStore.settings.autoplay_next}>
                <span>Autoplay next episode</span>
            </label>
            <span class="setting-description">Automatically play next episode in series</span>
        </div>
        <div class="setting-item">
            <label for="resume-playback-toggle">
                <input type="checkbox" id="resume-playback-toggle" class="setting-checkbox" bind:checked={$settingsStore.settings.resume_playback}>
                <span>Resume playback</span>
            </label>
            <span class="setting-description">Continue from where you left off</span>
        </div>
    </div>

    <!-- Subtitles -->
    <div class="settings-section">
        <h3>📝 Subtitles</h3>
        <div class="setting-item">
            <label for="subtitles-toggle">
                <input type="checkbox" id="subtitles-toggle" class="setting-checkbox" bind:checked={$settingsStore.settings.subtitles_enabled}>
                <span>Enable subtitles by default</span>
            </label>
        </div>
        <div class="setting-item">
            <label for="subtitle-language">Subtitle Language</label>
            <select id="subtitle-language" class="setting-select" bind:value={$settingsStore.settings.subtitle_language}>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
            </select>
        </div>
        <div class="setting-item">
            <label for="subtitle-size-select">Subtitle Size</label>
            <select id="subtitle-size-select" class="setting-select" bind:value={$settingsStore.settings.subtitle_size}>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
            </select>
        </div>
    </div>

    <div class="settings-actions">
        <button class="btn btn-primary" on:click={() => settingsStore.saveSettings()}>💾 Save Settings</button>
        <button class="btn btn-secondary" on:click={() => settingsStore.resetSettings()}>🔄 Reset to Defaults</button>
    </div>
</div>
