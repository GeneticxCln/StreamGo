// Addon Manifest Loader - Fetches and validates Stremio addon manifests
// Enables installation of community addons from manifest URLs

import { invoke } from './utils';
import { Toast } from './ui-utils';

/**
 * Stremio Addon Manifest structure
 * @see https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
 */
export interface AddonManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  // Stremio supports both: ["catalog", "stream"] OR [{ name: "stream", types: [...] }]
  resources: (string | { name: string; types: string[]; idPrefixes?: string[] })[];
  types: string[];
  catalogs?: Array<{
    type: string;
    id: string;
    name: string;
    extra?: Array<{ name: string; isRequired?: boolean; options?: string[] }>;
  }>;
  idPrefixes?: string[];
  behaviorHints?: {
    adult?: boolean;
    p2p?: boolean;
    configurable?: boolean;
    configurationRequired?: boolean;
  };
  logo?: string;
  background?: string;
  contactEmail?: string;
}

export interface LoadedAddon {
  manifest: AddonManifest;
  transportUrl: string;
  flags?: {
    official?: boolean;
    protected?: boolean;
  };
}

export class AddonManifestLoader {
  /**
   * Load addon manifest from URL
   */
  async loadFromUrl(url: string): Promise<LoadedAddon> {
    // Validate URL format
    if (!this.isValidUrl(url)) {
      throw new Error('Invalid URL format');
    }

    // Normalize URL - handle manifest.json suffix properly
    let normalizedUrl = url.replace(/\/+$/, '');

    // Determine manifest URL
    let manifestUrl = normalizedUrl;
    if (normalizedUrl.endsWith('/manifest.json')) {
      // Already has manifest.json, use as-is
    } else if (normalizedUrl.endsWith('manifest.json')) {
      // Remove manifest.json to get base URL, then add it back
      const base = normalizedUrl.replace(/manifest\.json$/, '');
      manifestUrl = `${base}manifest.json`;
    } else {
      // Add manifest.json
      manifestUrl = `${normalizedUrl}/manifest.json`;
    }

    console.log('Loading addon manifest from:', manifestUrl);

    try {
      // Fetch manifest
      const response = await fetch(manifestUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // 10 second timeout
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const manifest = await response.json() as AddonManifest;

      // Validate manifest structure
      this.validateManifest(manifest);

      // Extract transport URL (base URL without /manifest.json)
      const transportUrl = manifestUrl.replace(/\/manifest\.json$/, '').replace(/manifest\.json$/, '');

      return {
        manifest,
        transportUrl,
        flags: {
          official: this.isOfficialAddon(transportUrl),
          protected: false,
        },
      };
    } catch (error) {
      console.error('Manifest loading error details:', error);

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          throw new Error('Request timed out - addon server not responding');
        }
        throw new Error(`Failed to load manifest: ${error.message}`);
      }

      // Handle non-Error types (strings, objects, etc.)
      if (typeof error === 'string') {
        throw new Error(`Failed to load manifest: ${error}`);
      }

      if (error && typeof error === 'object') {
        const errorMessage = (error as any).message || (error as any).statusText || JSON.stringify(error);
        throw new Error(`Failed to load manifest: ${errorMessage}`);
      }

      throw new Error('Failed to load manifest: Network or server error');
    }
  }

  /**
   * Validate manifest structure
   */
  private validateManifest(manifest: AddonManifest): void {
    const errors: string[] = [];

    // Required fields
    if (!manifest.id || typeof manifest.id !== 'string') {
      errors.push('Missing or invalid "id" field');
    }
    if (!manifest.version || typeof manifest.version !== 'string') {
      errors.push('Missing or invalid "version" field');
    }
    if (!manifest.name || typeof manifest.name !== 'string') {
      errors.push('Missing or invalid "name" field');
    }
    if (!manifest.description || typeof manifest.description !== 'string') {
      errors.push('Missing or invalid "description" field');
    }

    // Resources validation - just check it exists, backend validates structure
    if (!Array.isArray(manifest.resources) || manifest.resources.length === 0) {
      errors.push('Missing or empty "resources" array');
    }

    // Types validation
    if (!Array.isArray(manifest.types) || manifest.types.length === 0) {
      errors.push('Missing or empty "types" array');
    }

    if (errors.length > 0) {
      throw new Error(`Invalid manifest:\n${errors.join('\n')}`);
    }
  }

  /**
   * Check if URL is valid
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Check if addon is from official Stremio domain
   */
  private isOfficialAddon(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname.endsWith('.strem.io') || parsed.hostname === 'strem.io';
    } catch {
      return false;
    }
  }

  /**
   * Install addon from manifest URL
   */
  async installFromUrl(url: string): Promise<void> {
    try {
      // Load and validate manifest
      const loadedAddon = await this.loadFromUrl(url);

      // Check if already installed
      const existingAddons = await invoke<any[]>('get_addons');
      const alreadyInstalled = existingAddons.some(
        (addon) => addon.id === loadedAddon.manifest.id
      );

      if (alreadyInstalled) {
        throw new Error(`Addon "${loadedAddon.manifest.name}" is already installed`);
      }

      // Install via Tauri backend
      await invoke('install_addon', {
        addon_url: loadedAddon.transportUrl,
        // Backward/compat: some older backends expect camelCase key
        addonUrl: loadedAddon.transportUrl,
      });

      Toast.success(`Addon "${loadedAddon.manifest.name}" installed successfully!`);
    } catch (error) {
      console.error('Addon installation failed:', error);

      let errorMessage = 'Installation failed: Unknown error';

      if (error instanceof Error) {
        errorMessage = `Installation failed: ${error.message}`;
      } else if (typeof error === 'string') {
        errorMessage = `Installation failed: ${error}`;
      } else if (error && typeof error === 'object') {
        const message = (error as any).message || (error as any).statusText || JSON.stringify(error);
        errorMessage = `Installation failed: ${message}`;
      }

      Toast.error(errorMessage);
      throw error;
    }
  }

  /**
   * Get addon info without installing
   */
  async getAddonInfo(url: string): Promise<{
    name: string;
    description: string;
    version: string;
    types: string[];
    resources: string[];
    catalogs: number;
    isOfficial: boolean;
  }> {
    const loadedAddon = await this.loadFromUrl(url);
    const { manifest, flags } = loadedAddon;

    return {
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      types: manifest.types,
      resources: manifest.resources.map(r => typeof r === 'string' ? r : r.name),
      catalogs: manifest.catalogs?.length || 0,
      isOfficial: flags?.official || false,
    };
  }
}

// Singleton instance
export const addonManifestLoader = new AddonManifestLoader();

// Make globally available for debugging
if (typeof window !== 'undefined') {
  (window as any).addonManifestLoader = addonManifestLoader;
}
