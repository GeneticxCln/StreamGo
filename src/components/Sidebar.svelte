<script lang="ts">
  import { navigationStore } from '@/stores/navigationStore';

  const navItems = [
    { section: 'home', title: 'Home', icon: '<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>' },
    { section: 'search', title: 'Search', icon: '<path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>' },
    { section: 'discover', title: 'Discover', icon: '<path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm3.94 6.06-2.2 5.15a1 1 0 0 1-.53.53l-5.15 2.2a.25.25 0 0 1-.33-.33l2.2-5.15a1 1 0 0 1 .53-.53l5.15-2.2a.25.25 0 0 1 .33.33z"/>' },
    { section: 'library', title: 'Library', icon: '<path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>' },
    { section: 'playlists', title: 'Playlists', icon: '<path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>' },
    { section: 'addons', title: 'Add-ons', icon: '<path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/>' },
  ];
</script>

<nav class="sidebar">
    <div class="sidebar-header">
        <div class="logo">
            <!-- Logo SVG -->
        </div>
    </div>
    <ul class="nav-menu">
        {#each navItems as item}
            <li class="nav-item" class:active={$navigationStore.activeSection === item.section} title={item.title}>
                <a href="#{item.section}" on:click={() => navigationStore.goTo(item.section)} on:keydown={(e) => e.key === 'Enter' && navigationStore.goTo(item.section)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">{@html item.icon}</svg>
                </a>
            </li>
        {/each}
    </ul>
    <div class="sidebar-footer">
        <!-- Theme toggle and settings buttons can be their own components too -->
        <a href="#settings" class="nav-item" class:active={$navigationStore.activeSection === 'settings'} on:click={() => navigationStore.goTo('settings')} title="Settings">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
        </a>
    </div>
</nav>
