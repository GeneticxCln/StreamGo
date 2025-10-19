<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Toast } from '../ui-utils';

  interface UserProfile {
    id: string;
    username: string;
    email?: string;
    preferences: any;
    library_items: string[];
    watchlist: string[];
    favorites: string[];
  }

  let profiles: UserProfile[] = [];
  let currentProfileId: string = 'default_user';
  let loading = true;
  let showCreateForm = false;
  let newProfileName = '';
  let newProfileEmail = '';

  const dispatch = createEventDispatcher();

  onMount(async () => {
    await loadProfiles();
  });

  async function loadProfiles() {
    try {
      loading = true;

      // Get current profile
      const currentSettings = await invoke<any>('get_settings');
      currentProfileId = 'default_user'; // For now, use default profile

      // Load all profiles (in a real implementation, you'd have a backend command for this)
      // For now, we'll work with the default profile
      profiles = [
        {
          id: 'default_user',
          username: 'Default User',
          email: undefined,
          preferences: currentSettings,
          library_items: [],
          watchlist: [],
          favorites: []
        }
      ];

    } catch (error) {
      console.error('Failed to load profiles:', error);
      Toast.error('Failed to load profiles');
    } finally {
      loading = false;
    }
  }

  async function createProfile() {
    if (!newProfileName.trim()) {
      Toast.error('Please enter a profile name');
      return;
    }

    try {
      const profileId = `profile_${Date.now()}`;
      const newProfile: UserProfile = {
        id: profileId,
        username: newProfileName.trim(),
        email: newProfileEmail.trim() || undefined,
        preferences: {
          version: 1,
          theme: 'dark',
          language: 'en',
          notifications_enabled: true,
          auto_update: true,
          autoplay: true,
          quality: 'auto',
          playback_speed: 1.0,
          volume: 0.8,
          subtitle_language: 'en',
          telemetry_enabled: false
        },
        library_items: [],
        watchlist: [],
        favorites: []
      };

      // In a real implementation, you'd save this to the backend
      profiles = [...profiles, newProfile];

      Toast.success(`Profile "${newProfile.username}" created successfully!`);
      showCreateForm = false;
      newProfileName = '';
      newProfileEmail = '';

      dispatch('profileCreated', { profile: newProfile });
    } catch (error) {
      console.error('Failed to create profile:', error);
      Toast.error('Failed to create profile');
    }
  }

  async function switchProfile(profileId: string) {
    try {
      // In a real implementation, you'd load the profile's settings
      currentProfileId = profileId;
      const profile = profiles.find(p => p.id === profileId);

      if (profile) {
        // Apply profile settings to the app
        // This would involve updating the settings store
        Toast.success(`Switched to profile "${profile.username}"`);
        dispatch('profileSwitched', { profile });
      }
    } catch (error) {
      console.error('Failed to switch profile:', error);
      Toast.error('Failed to switch profile');
    }
  }

  async function deleteProfile(profileId: string) {
    if (profileId === 'default_user') {
      Toast.error('Cannot delete the default profile');
      return;
    }

    const confirmed = confirm('Are you sure you want to delete this profile? This action cannot be undone.');
    if (!confirmed) return;

    try {
      // In a real implementation, you'd delete from backend
      profiles = profiles.filter(p => p.id !== profileId);
      Toast.success('Profile deleted successfully');

      if (currentProfileId === profileId) {
        await switchProfile('default_user');
      }

      dispatch('profileDeleted', { profileId });
    } catch (error) {
      console.error('Failed to delete profile:', error);
      Toast.error('Failed to delete profile');
    }
  }

  function getProfileStats(profile: UserProfile) {
    return {
      libraryCount: profile.library_items.length,
      watchlistCount: profile.watchlist.length,
      favoritesCount: profile.favorites.length
    };
  }
</script>

<div class="profile-manager">
  <!-- Header -->
  <div class="profile-header">
    <h2>👤 Profile Management</h2>
    <p class="profile-subtitle">Manage multiple user profiles with separate settings and content</p>
  </div>

  <!-- Current Profile -->
  <div class="current-profile-section">
    <h3>Current Profile</h3>
    {#if profiles.length > 0}
      {@const currentProfile = profiles.find(p => p.id === currentProfileId)}
      {#if currentProfile}
        {@const stats = getProfileStats(currentProfile)}
        <div class="current-profile-card">
          <div class="profile-avatar">
            {currentProfile.username.charAt(0).toUpperCase()}
          </div>
          <div class="profile-info">
            <h4>{currentProfile.username}</h4>
            {#if currentProfile.email}
              <p class="profile-email">{currentProfile.email}</p>
            {/if}
            <div class="profile-stats">
              <span class="stat-item">📚 {stats.libraryCount} items</span>
              <span class="stat-item">⏰ {stats.watchlistCount} watchlist</span>
              <span class="stat-item">❤️ {stats.favoritesCount} favorites</span>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <!-- All Profiles -->
  <div class="profiles-section">
    <div class="profiles-header">
      <h3>All Profiles</h3>
      <button class="btn btn-primary" on:click={() => showCreateForm = true}>
        + Create Profile
      </button>
    </div>

    {#if loading}
      <div class="loading-state">
        <div class="loading-spinner">Loading profiles...</div>
      </div>
    {:else}
      <div class="profiles-grid">
        {#each profiles as profile (profile.id)}
          {@const stats = getProfileStats(profile)}
          {@const isCurrent = profile.id === currentProfileId}

          <div class="profile-card" class:active={isCurrent}>
            <div class="profile-card-header">
              <div class="profile-avatar">
                {profile.username.charAt(0).toUpperCase()}
              </div>
              <div class="profile-card-info">
                <h4 class="profile-name">{profile.username}</h4>
                {#if profile.email}
                  <p class="profile-email">{profile.email}</p>
                {/if}
              </div>
              {#if isCurrent}
                <span class="current-badge">Current</span>
              {/if}
            </div>

            <div class="profile-stats">
              <div class="stat-item">
                <span class="stat-icon">📚</span>
                <span class="stat-text">{stats.libraryCount} Library</span>
              </div>
              <div class="stat-item">
                <span class="stat-icon">⏰</span>
                <span class="stat-text">{stats.watchlistCount} Watchlist</span>
              </div>
              <div class="stat-item">
                <span class="stat-icon">❤️</span>
                <span class="stat-text">{stats.favoritesCount} Favorites</span>
              </div>
            </div>

            <div class="profile-actions">
              {#if !isCurrent}
                <button
                  class="btn btn-secondary"
                  on:click={() => switchProfile(profile.id)}
                >
                  Switch To
                </button>
              {/if}
              {#if profile.id !== 'default_user'}
                <button
                  class="btn btn-danger"
                  on:click={() => deleteProfile(profile.id)}
                >
                  Delete
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Create Profile Modal -->
  {#if showCreateForm}
    <div class="modal-overlay" on:click={() => showCreateForm = false}>
      <div class="modal-content" on:click|stopPropagation>
        <div class="modal-header">
          <h3>Create New Profile</h3>
          <button class="close-btn" on:click={() => showCreateForm = false}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label for="profile-name">Profile Name *</label>
            <input
              type="text"
              id="profile-name"
              bind:value={newProfileName}
              placeholder="Enter profile name"
              required
            />
          </div>

          <div class="form-group">
            <label for="profile-email">Email (Optional)</label>
            <input
              type="email"
              id="profile-email"
              bind:value={newProfileEmail}
              placeholder="Enter email address"
            />
          </div>

          <div class="form-info">
            <p>Each profile maintains separate:</p>
            <ul>
              <li>Settings and preferences</li>
              <li>Library and watch history</li>
              <li>Watchlist and favorites</li>
              <li>Playlists</li>
            </ul>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" on:click={() => showCreateForm = false}>
            Cancel
          </button>
          <button class="btn btn-primary" on:click={createProfile}>
            Create Profile
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .profile-manager {
    padding: 20px;
    max-width: 1000px;
    margin: 0 auto;
  }

  .profile-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .profile-header h2 {
    margin: 0 0 8px 0;
    font-size: 2.5rem;
    color: var(--text-primary);
  }

  .profile-subtitle {
    margin: 0;
    color: var(--text-secondary);
    font-size: 1.1rem;
  }

  .current-profile-section {
    margin-bottom: 40px;
  }

  .current-profile-section h3 {
    margin: 0 0 16px 0;
    color: var(--text-primary);
    font-size: 1.3rem;
  }

  .current-profile-card {
    display: flex;
    align-items: center;
    gap: 20px;
    background: var(--background-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 24px;
  }

  .profile-avatar {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: var(--primary-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .profile-info h4 {
    margin: 0 0 4px 0;
    font-size: 1.3rem;
    color: var(--text-primary);
  }

  .profile-email {
    margin: 0 0 8px 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .profile-stats {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .stat-item {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .profiles-section {
    margin-bottom: 40px;
  }

  .profiles-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .profiles-header h3 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.3rem;
  }

  .loading-state {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 60px;
    color: var(--text-secondary);
  }

  .profiles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
  }

  .profile-card {
    background: var(--background-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 20px;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .profile-card.active {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
  }

  .profile-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  .profile-card-header {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
  }

  .profile-card .profile-avatar {
    width: 48px;
    height: 48px;
    font-size: 1.2rem;
  }

  .profile-card-info {
    flex: 1;
  }

  .profile-name {
    margin: 0 0 4px 0;
    font-size: 1.1rem;
    color: var(--text-primary);
  }

  .profile-card .profile-email {
    margin: 0 0 8px 0;
    font-size: 0.85rem;
  }

  .current-badge {
    background: var(--primary-color);
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .profile-card .profile-stats {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .profile-card .stat-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
  }

  .stat-icon {
    font-size: 1rem;
  }

  .profile-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .profile-actions .btn {
    flex: 1;
    min-width: 100px;
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: var(--background-primary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h3 {
    margin: 0;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 8px;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--background-tertiary);
    color: var(--text-primary);
  }

  .modal-body {
    padding: 24px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    color: var(--text-primary);
    font-weight: 500;
  }

  .form-group input {
    width: 100%;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background-color: var(--background-secondary);
    color: var(--text-primary);
    font-size: 16px;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  .form-info {
    background: var(--background-secondary);
    padding: 16px;
    border-radius: 8px;
    margin-top: 20px;
  }

  .form-info p {
    margin: 0 0 12px 0;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .form-info ul {
    margin: 0;
    padding-left: 20px;
    color: var(--text-secondary);
  }

  .form-info li {
    margin-bottom: 4px;
    font-size: 0.85rem;
  }

  .modal-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding: 20px 24px;
    border-top: 1px solid var(--border-color);
  }

  @media (max-width: 768px) {
    .profile-manager {
      padding: 16px;
    }

    .current-profile-card {
      flex-direction: column;
      text-align: center;
    }

    .profile-stats {
      justify-content: center;
    }

    .profiles-header {
      flex-direction: column;
      gap: 16px;
      align-items: stretch;
    }

    .profiles-grid {
      grid-template-columns: 1fr;
    }

    .profile-actions {
      flex-direction: column;
    }
  }
</style>