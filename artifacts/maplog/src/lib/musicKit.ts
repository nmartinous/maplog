/**
 * MusicKit JS v3 loader + singleton access.
 *
 * Loads the MusicKit script dynamically (so index.html stays untouched),
 * fetches the developer token from the API server, and configures a single
 * shared instance. Both MusicKitContext (auth/search) and AudioPlayerContext
 * (full-song playback) use this module.
 */

// Type declarations for the CDN global live in ./musickit.d.ts

const SCRIPT_SRC = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';

let configurePromise: Promise<any> | null = null;

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.MusicKit) return resolve();
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      document.addEventListener('musickitloaded', () => resolve(), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load MusicKit JS'));
    document.addEventListener('musickitloaded', () => resolve(), { once: true });
    document.head.appendChild(script);
  });
}

/**
 * Load + configure MusicKit once. Resolves with the shared instance.
 * Rejects if the token endpoint or the script fails — callers should fall
 * back to preview playback.
 */
export function initMusicKit(): Promise<any> {
  if (configurePromise) return configurePromise;
  configurePromise = (async () => {
    const res = await fetch('/api/apple-music/token');
    if (!res.ok) throw new Error('Could not fetch Apple Music developer token');
    const { token } = await res.json();

    await loadScript();
    await window.MusicKit!.configure({
      developerToken: token,
      app: { name: 'Maplog', build: '1.0.0' },
    });
    return window.MusicKit!.getInstance();
  })();
  configurePromise.catch(() => { configurePromise = null; });
  return configurePromise;
}

/** Synchronous access to the configured instance (null until initMusicKit resolves). */
export function getMusicKitInstance(): any | null {
  try {
    return window.MusicKit ? window.MusicKit.getInstance() : null;
  } catch {
    return null;
  }
}
