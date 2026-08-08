/**
 * Sync configuration constants.
 *
 * Set VITE_GOOGLE_CLIENT_ID in your environment to enable Drive sync.
 * The client ID is NOT a secret — it is embedded in the browser bundle.
 */

export const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';

/** Root folder created in the user's Google Drive. */
export const DRIVE_FOLDER_NAME = 'Harmony';

/** JSON file inside the root folder that holds all metadata/settings. */
export const DRIVE_DATA_FILENAME = 'harmony-data.json';

/** Sub-folder inside the root folder for card media blobs. */
export const DRIVE_MEDIA_FOLDER = 'media';

/** Bump this when the shape of harmony-data.json changes. */
export const SYNC_DATA_VERSION = 1;

/**
 * Wait this many ms after the last localStorage write before auto-pushing
 * to Drive. 30 s keeps API calls infrequent while still feeling near-live.
 */
export const SYNC_PUSH_DEBOUNCE_MS = 30_000;

/**
 * Never run two full syncs closer than this (ms). Prevents hammering the
 * Drive API during rapid edits (e.g. bulk import).
 */
export const SYNC_COOLDOWN_MS = 10_000;
