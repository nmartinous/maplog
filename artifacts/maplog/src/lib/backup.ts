import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { getAllCardMedia, replaceAllCardMedia, type CardMedia } from './mediaStore';

/**
 * Backup — versioned export/import of everything the user authors outside
 * Apple Music playlists: collection (cards, tags, override metadata),
 * profile, badges, artist pages, showcases, notes, playlists, playlist
 * links, tag rules, player prefs — plus uploaded card media from IndexedDB.
 *
 * Format: a zip containing `manifest.json` (version + all localStorage
 * payloads) and `media/<n>` files (one per card upload, mapped by the
 * manifest). Legacy plain-JSON collection exports are also importable.
 */

export const BACKUP_VERSION = 1;

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

export async function createBackupZip(): Promise<Blob> {
  const data: Record<string, string> = {};
  for (const key of BACKUP_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw != null) data[key] = raw;
  }

  const mediaEntries = await getAllCardMedia();
  const files: Record<string, Uint8Array> = {};
  const media: MediaManifestEntry[] = [];
  for (let i = 0; i < mediaEntries.length; i++) {
    const m = mediaEntries[i];
    const path = `media/${i}`;
    files[path] = new Uint8Array(await m.blob.arrayBuffer());
    media.push({ cardId: m.cardId, file: path, mimeType: m.mimeType, updatedAt: m.updatedAt });
  }

  const manifest: BackupManifest = {
    format: 'maplog-backup',
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    data,
    media,
  };
  files['manifest.json'] = strToU8(JSON.stringify(manifest));

  // Media blobs are already compressed formats (jpg/mp4); level 0 keeps
  // export fast. The manifest is small either way.
  const zipped = zipSync(files, { level: 0 });
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}

// ── Import ─────────────────────────────────────────────────────────────────────

export interface ParsedBackup {
  manifest: BackupManifest;
  files: Record<string, Uint8Array>;
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
  const bytes = new Uint8Array(await file.arrayBuffer());

  // Legacy JSON export (starts with '[' — an array of songs)
  const head = strFromU8(bytes.slice(0, 1)).trim();
  if (file.name.endsWith('.json') || head === '[') {
    const text = strFromU8(bytes);
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

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("Couldn't read that file — it isn't a Maplog backup.");
  }
  const manifestRaw = files['manifest.json'];
  if (!manifestRaw) throw new Error('This zip is missing its Maplog manifest.');

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(strFromU8(manifestRaw));
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
      const bytes = files[entry.file];
      if (!bytes) throw new Error('This backup is incomplete or corrupted — nothing was changed.');
      const buf = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
        ? bytes.buffer as ArrayBuffer
        : bytes.slice().buffer as ArrayBuffer;
      const blob = new Blob([buf], { type: entry.mimeType });
      entries.push({
        cardId: entry.cardId,
        type: entry.mimeType.startsWith('video/') ? 'video' : 'image',
        mimeType: entry.mimeType,
        blob,
        updatedAt: entry.updatedAt ?? new Date().toISOString(),
      });
    }
    // Single transaction: clear + writes commit together or not at all.
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
