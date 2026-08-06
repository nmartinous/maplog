import { getAllCardMedia, replaceAllCardMedia, type CardMedia } from './mediaStore';
import {
  streamZip, unzipToBlobs, assertWithinZipCap,
  MAX_BACKUP_BYTES, BACKUP_SIZE_WARN_BYTES, formatBytes,
} from './backupStream';

export { MAX_BACKUP_BYTES, BACKUP_SIZE_WARN_BYTES, formatBytes };

/**
 * Backup — versioned export/import of everything the user authors outside
 * Apple Music playlists: collection (cards, tags, override metadata),
 * profile, badges, artist pages, showcases, notes, playlists, playlist
 * links, tag rules, player prefs — plus uploaded card media from IndexedDB.
 *
 * Format: a zip containing `manifest.json` (version + all localStorage
 * payloads) and `media/<n>` files (one per card upload, mapped by the
 * manifest). Legacy plain-JSON collection exports are also importable.
 *
 * Memory: export and import stream through fflate's Zip/Unzip APIs in small
 * chunks, and accumulated bytes are folded into Blobs (browser-managed,
 * off-heap storage) as they grow — see backupStream.ts. This keeps large
 * video-heavy backups from freezing or crashing iOS Safari, where the old
 * zipSync/unzipSync approach held everything in memory at once.
 */

export const BACKUP_VERSION = 1;

/** Legacy plain-JSON exports come from localStorage, so they're small. */
export const MAX_LEGACY_JSON_BYTES = 64 * 1024 * 1024; // 64 MiB

/** Every user-authored localStorage key covered by the backup. */
export const BACKUP_KEYS = [
  'maplog:collection',
  'maplog:profile',
  'maplog:artistBadges',
  'maplog:artistData',
  'maplog:showcase',
  'maplog:tagRules',
  'maplog:overrideMeta',
  'maplog:userPlaylists',
  'maplog:playlistLinks',
  'maplog:conflicts',
  'maplog:playerPrefs',
  'maplog:recentlyPlayed',
] as const;

interface MediaManifestEntry {
  cardId: string;
  file: string;       // path inside the zip, e.g. "media/0"
  mimeType: string;
  updatedAt: string;
}

interface BackupManifest {
  format: 'maplog-backup';
  version: number;
  createdAt: string;
  /** localStorage key → raw JSON string (exactly as stored) */
  data: Record<string, string>;
  media: MediaManifestEntry[];
}

export interface BackupSummary {
  songs: number;
  cards: number;
  mediaFiles: number;
  createdAt: string | null;
  version: number;
  /** true when this is a legacy plain-JSON collection export */
  legacy: boolean;
}

// ── Export ─────────────────────────────────────────────────────────────────────

function collectLocalStorageData(): Record<string, string> {
  const data: Record<string, string> = {};
  for (const key of BACKUP_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw != null) data[key] = raw;
  }
  return data;
}

/**
 * Estimate the backup size BEFORE building it (media bytes + manifest data),
 * so the UI can warn or refuse up front rather than after the expensive part.
 */
export async function estimateBackupBytes(): Promise<number> {
  const mediaEntries = await getAllCardMedia();
  const mediaBytes = mediaEntries.reduce((n, m) => n + m.blob.size, 0);
  const dataBytes = Object.values(collectLocalStorageData())
    .reduce((n, s) => n + s.length, 0);
  return mediaBytes + dataBytes;
}

export async function createBackupZip(): Promise<Blob> {
  const data = collectLocalStorageData();
  const mediaEntries = await getAllCardMedia();

  // Guard against exceeding the zip format's 4 GiB limit before starting.
  assertWithinZipCap(mediaEntries.reduce((n, m) => n + m.blob.size, 0));

  const media: MediaManifestEntry[] = mediaEntries.map((m, i) => ({
    cardId: m.cardId,
    file: `media/${i}`,
    mimeType: m.mimeType,
    updatedAt: m.updatedAt,
  }));

  const manifest: BackupManifest = {
    format: 'maplog-backup',
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    data,
    media,
  };

  return streamZip(
    JSON.stringify(manifest),
    mediaEntries.map((m, i) => ({ path: `media/${i}`, blob: m.blob })),
  );
}

// ── Import ─────────────────────────────────────────────────────────────────────

export interface ParsedBackup {
  manifest: BackupManifest;
  /** zip entry path → contents (Blob keeps large media off the JS heap) */
  files: Record<string, Blob>;
  summary: BackupSummary;
}

function countCollection(raw: string | undefined): { songs: number; cards: number } {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return { songs: 0, cards: 0 };
    return {
      songs: parsed.length,
      cards: parsed.reduce((n: number, s: any) => n + (Array.isArray(s?.cards) ? s.cards.length : 0), 0),
    };
  } catch {
    return { songs: 0, cards: 0 };
  }
}

/**
 * Parse a backup file: either a Maplog backup zip or a legacy plain-JSON
 * collection export. Throws with a user-readable message when invalid.
 */
export async function parseBackupFile(file: File): Promise<ParsedBackup> {
  // Refuse oversized inputs BEFORE reading anything into memory.
  if (file.size > MAX_BACKUP_BYTES) {
    throw new Error(
      `This backup is ${formatBytes(file.size)} — larger than Maplog can restore (${formatBytes(MAX_BACKUP_BYTES)} max).`
    );
  }

  // Legacy JSON export (starts with '[' — an array of songs)
  const head = (await file.slice(0, 16).text()).trim();
  if (file.name.endsWith('.json') || head.startsWith('[')) {
    // Legacy exports are localStorage JSON — a few MB at most. Cap well below
    // that ceiling so a huge renamed file can't be loaded into JS memory.
    if (file.size > MAX_LEGACY_JSON_BYTES) {
      throw new Error(
        `That file is ${formatBytes(file.size)} — too large to be a Maplog collection export (${formatBytes(MAX_LEGACY_JSON_BYTES)} max).`
      );
    }
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('Not a valid Maplog backup.');
    const manifest: BackupManifest = {
      format: 'maplog-backup',
      version: 0,
      createdAt: '',
      data: { 'maplog:collection': text },
      media: [],
    };
    const { songs, cards } = countCollection(text);
    return { manifest, files: {}, summary: { songs, cards, mediaFiles: 0, createdAt: null, version: 0, legacy: true } };
  }

  let files: Record<string, Blob>;
  try {
    files = await unzipToBlobs(file);
  } catch {
    throw new Error("Couldn't read that file — it isn't a Maplog backup.");
  }
  const manifestBlob = files['manifest.json'];
  if (!manifestBlob) throw new Error('This zip is missing its Maplog manifest.');

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(await manifestBlob.text());
  } catch {
    throw new Error('The backup manifest is corrupted.');
  }
  if (manifest.format !== 'maplog-backup' || typeof manifest.version !== 'number') {
    throw new Error('Not a valid Maplog backup.');
  }
  if (manifest.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of Maplog — update the app first.');
  }

  const { songs, cards } = countCollection(manifest.data?.['maplog:collection']);
  return {
    manifest,
    files,
    summary: {
      songs,
      cards,
      mediaFiles: manifest.media?.length ?? 0,
      createdAt: manifest.createdAt || null,
      version: manifest.version,
      legacy: false,
    },
  };
}

/**
 * Restore a parsed backup. REPLACES all covered localStorage keys and card
 * media with the backup's contents (keys absent from the backup are removed
 * so the restored state matches the export exactly). Media is restored
 * before localStorage so a media failure aborts without touching data.
 */
export async function restoreBackup({ manifest, files }: ParsedBackup): Promise<void> {
  // 1) Restore media (IndexedDB). Full (v1+) backups are authoritative: the
  //    store is replaced with exactly the backup's media — including clearing
  //    it when the backup has none. Legacy (v0) backups carry no media info,
  //    so existing media is left alone.
  if (manifest.version >= 1) {
    // Fail fast BEFORE any destructive step: every manifest media entry must
    // exist in the zip, or the backup is corrupt and nothing is touched.
    const entries: CardMedia[] = [];
    for (const entry of manifest.media ?? []) {
      const blob = files[entry.file];
      if (!blob) throw new Error('This backup is incomplete or corrupted — nothing was changed.');
      entries.push({
        cardId: entry.cardId,
        type: entry.mimeType.startsWith('video/') ? 'video' : 'image',
        mimeType: entry.mimeType,
        // Re-type the blob without copying its bytes.
        blob: blob.slice(0, blob.size, entry.mimeType),
        updatedAt: entry.updatedAt ?? new Date().toISOString(),
      });
    }
    // Single transaction: clear + writes commit together or not at all.
    // The blobs are references into browser-managed storage, so this stays
    // memory-light even for large backups.
    await replaceAllCardMedia(entries);
  }

  // 2) Restore localStorage keys covered by the backup format
  for (const key of BACKUP_KEYS) {
    const value = manifest.data?.[key];
    if (value != null) {
      localStorage.setItem(key, value);
    } else if (manifest.version >= 1) {
      // Full backups define the complete state; legacy (v0) only carries the
      // collection, so other keys are preserved.
      localStorage.removeItem(key);
    }
  }
}

export function backupFileName(): string {
  return `maplog-backup-${new Date().toISOString().slice(0, 10)}.zip`;
}
