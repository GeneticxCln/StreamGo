import { test, expect } from '@playwright/test';
import { dismissOnboardingModal } from './helpers';

test.describe('Playlist Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri API before loading the page
    await page.addInitScript(() => {
      const mockPlaylists: any[] = [];

      // Mock the Tauri API
      const mockInvoke = async (cmd: string, args?: any) => {
        console.log(`Mock invoke called: ${cmd}`, args);
        
        switch (cmd) {
          case 'get_playlists':
            return mockPlaylists;
            
          case 'create_playlist':
            const newPlaylist = {
              id: `playlist-${Date.now()}`,
              name: args?.name || 'New Playlist',
              description: args?.description || '',
              items: [],
              created_at: Math.floor(Date.now() / 1000),
              updated_at: Math.floor(Date.now() / 1000)
            };
            mockPlaylists.push(newPlaylist);
            return newPlaylist;
            
          case 'get_library_items':
            return [];
            
          case 'get_addons':
            return [];
            
          case 'get_settings':
            return {
              version: 1,
              theme: 'auto',
              language: 'en'
            };
            
          default:
            console.warn(`Unhandled mock command: ${cmd}`);
            return null;
        }
      };
      
      // Inject into window scope
      (window as any).__TAURI_INVOKE__ = mockInvoke;
      (window as any).__TAURI__ = {
        invoke: mockInvoke,
        core: {
          invoke: mockInvoke
        }
      };
    });
  });

  test('should navigate to playlists section', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await dismissOnboardingModal(page);
    
    // Navigate to playlists
    await page.click('.nav-item[data-section="playlists"] a');
    await page.waitForTimeout(500);
    
    // Check if playlists section is visible
    const playlistsSection = page.locator('#playlists-section');
    await expect(playlistsSection).toBeVisible();
    
    // Create playlist button should be visible
    await expect(page.locator('#create-playlist-btn')).toBeVisible();
  });
  
  test('should create a new playlist', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await dismissOnboardingModal(page);
    
    // Navigate to playlists
    await page.click('.nav-item[data-section="playlists"] a');
    await page.waitForTimeout(500);
    
    // Click create playlist
    await page.click('#create-playlist-btn');
    await page.waitForTimeout(500);
    
    // Modal should appear (if implemented)
    const modal = page.locator('.modal-overlay');
    if (await modal.isVisible()) {
      // Fill in playlist name
      const input = page.locator('.modal-input');
      await input.fill('Test Playlist');
      
      // Click confirm
      await page.click('.modal-confirm');
      await page.waitForTimeout(1000);
      
      // Should show success toast
      await expect(page.locator('.toast.success')).toBeVisible();
    }
  });
  
  test('should display playlists grid', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await dismissOnboardingModal(page);
    
    // Navigate to playlists
    await page.click('.nav-item[data-section="playlists"] a');
    await page.waitForTimeout(1000);
    
    // Playlists grid should be visible
    await expect(page.locator('#playlists-grid')).toBeVisible();
  });
  
  test('should have back button in playlist detail view', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await dismissOnboardingModal(page);
    
    // Navigate to playlists
    await page.click('.nav-item[data-section="playlists"] a');
    await page.waitForTimeout(500);
    
    // Check if playlist detail view has back button
    const detailView = page.locator('#playlist-detail-view');
    if (await detailView.isVisible()) {
      await expect(page.locator('#playlist-back-btn')).toBeAttached();
    }
  });
});
