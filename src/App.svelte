<script lang="ts">
  import { onMount } from 'svelte';
  import { navigationStore } from '@/stores/navigationStore';
  import Sidebar from './components/Sidebar.svelte';
  import GlobalSearch from './components/GlobalSearch.svelte';
  import UpdateNotification from './components/UpdateNotification.svelte';

  console.log('App.svelte: Component loaded');

  // Dynamic component loaders
  let HomeSection: any = null;
  let SearchSection: any = null;
  let DiscoverSection: any = null;
  let LibrarySection: any = null;
  let PlaylistsSection: any = null;
  let AddonsSection: any = null;
  let SettingsSection: any = null;
  let DetailSection: any = null;

  async function loadComponent(section: string) {
    console.log(`App.svelte: Loading component for section: ${section}`);
    try {
      switch (section) {
        case 'home':
          if (!HomeSection) {
            console.log('App.svelte: Importing HomeSection');
            HomeSection = (await import('./components/home/HomeSection.svelte')).default;
            console.log('App.svelte: HomeSection imported successfully');
          }
          break;
        case 'search':
          if (!SearchSection) SearchSection = (await import('./components/search/SearchSection.svelte')).default;
          break;
        case 'discover':
          if (!DiscoverSection) DiscoverSection = (await import('./components/discover/DiscoverSection.svelte')).default;
          break;
        case 'library':
          if (!LibrarySection) LibrarySection = (await import('./components/library/LibrarySection.svelte')).default;
          break;
        case 'playlists':
          if (!PlaylistsSection) PlaylistsSection = (await import('./components/playlists/PlaylistsSection.svelte')).default;
          break;
        case 'addons':
          if (!AddonsSection) AddonsSection = (await import('./components/addons/AddonsSection.svelte')).default;
          break;
        case 'settings':
          if (!SettingsSection) SettingsSection = (await import('./components/settings/SettingsSection.svelte')).default;
          break;
        case 'detail':
          if (!DetailSection) DetailSection = (await import('./components/detail/DetailSection.svelte')).default;
          break;
      }
    } catch (e) {
        console.error(`App.svelte: Failed to load component for section: ${section}`, e);
    }
  }

  navigationStore.subscribe(nav => {
    console.log('App.svelte: Navigation changed to:', nav.activeSection);
    loadComponent(nav.activeSection);
  });

  onMount(() => {
    console.log('App.svelte: Component mounted, loading home section');
    loadComponent('home'); // Load initial section
  });

</script>

<div class="app-container">
  <div class="sidebar">
    <div class="logo">🎬 StreamGo</div>
    <ul class="nav-menu">
      <li class="nav-item active">
        <a href="#home">🏠 Home</a>
      </li>
      <li class="nav-item">
        <a href="#search">🔍 Search</a>
      </li>
      <li class="nav-item">
        <a href="#library">📚 Library</a>
      </li>
      <li class="nav-item">
        <a href="#addons">🧩 Add-ons</a>
      </li>
    </ul>
  </div>

  <main class="main-content">
    <header class="main-header">
      <div class="search-bar">
        <input type="text" placeholder="Search for movies and TV shows..." />
      </div>
    </header>

    <div class="content-area">
      <div class="hero-section">
        <div class="hero-content">
          <h2 class="hero-title">Welcome to StreamGo</h2>
          <p class="hero-description">Your modern media center for movies and TV shows. Search for content, build your library, and discover new favorites.</p>
          <button class="btn btn-primary">Start Searching</button>
        </div>
      </div>

      <div class="content-row">
        <div class="content-row-header">
          <h3 class="content-row-title">🔥 Trending Now</h3>
        </div>
        <div class="content-row-items">
          <div class="loading-indicator">Loading content...</div>
        </div>
      </div>

      <div class="content-row">
        <div class="content-row-header">
          <h3 class="content-row-title">⭐ Popular</h3>
        </div>
        <div class="content-row-items">
          <div class="loading-indicator">Loading content...</div>
        </div>
      </div>
    </div>
  </main>
</div>

<UpdateNotification />
