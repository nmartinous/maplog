/**
 * Sync engine — bidirectional pull/push between the local device and
 * the user's Google Drive.
 *
 * Drive file layout (inside the user's own Drive):
 *   Harmony/
 *     harmony-data.json   — all localStorage metadata, per-key timestamps
 *     media/
 *       <cardId>.mp4      — moment video blobs
 *       <cardId>.jpg      — uploaded card art blobs
 *
 * Pull strategy:  compare per-key updatedAt on Drive vs local; take whichever
 *   is newer (key-level merge, not all-or-nothing).
 *
 * Push strategy:  send keys that are newer locally; send media that is newer
 *   locally or missing from Drive; delete Drive media for cards no longer
 *   in the local collection.
 *
 * Conflict resolution: last-write-wins per key. This is intentionally simple
 *   and appropriate for a small, mostly-single-user collection.
 */

import { syncRegistry } from './registry';
import { getAllCardMedia, putCardMediaEntry } from '@/lib/mediaStore';
import {
  findOrCreateFolder, listFiles,
  readFileText, readFileBlob,
  uploadJson, uploadBlob, deleteFile,
} from './driveClient';
import {
  DRIVE_FOLDER_NAME, DRIVE_DATA_FILENAME,
  DRIVE_MEDIA_FOLDER, SYNC_DATA_VERSION,
} from './config';

// ── Persisted sync metadata (local, not synced) ───────────────────────────────

const META_KEY = 'harmony:sync:meta';

interface SyncMeta {
  connected: boolean;
  googleEmail: string | null;
  /** Drive ID of the root Harmony/ folder */
  folderId: string | null;
  /** Drive ID of the Harmony/media/ subfolder */
  mediaFolderId: string | null;
  /** Drive ID of harmony-data.json */
  dataFileId: string | null;
  /** ISO timestamp of the last successful sync */
  lastSyncAt: string | null;
  /** Per-key timestamps as of the last sync (used for delta detection) */
  keyTimestamps: Record<string, string>;
  /** Per-cardId timestamps as of the last media sync */
  mediaTimestamps: Record<string, string>;
  /** Per-cardId Drive file IDs for media (avoids repeated folder listings) */
  mediaFileIds: Record<string, string>;
}

function loadMeta(): SyncMeta {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? 'null') ?? defaultMeta();
  } catch {
    return defaultMeta();
  }
}

function saveMeta(m: SyncMeta): void {
  // Use the original setItem to avoid triggering our own dirty tracker.
  syncRegistry.suppressTracking(() => localStorage.setItem(META_KEY, JSON.stringify(m)));
}

function defaultMeta(): SyncMeta {
  return {
    connected: false,
    googleEmail: null,
    folderId: null,
    mediaFolderId: null,
    dataFileId: null,
    lastSyncAt: null,
    keyTimestamps: {},
    mediaTimestamps: {},
    mediaFileIds: {},
  };
}

// ── Device identity ───────────────────────────────────────────────────────────

const DEVICE_ID_KEY = 'harmony:sync:deviceId';

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    syncRegistry.suppressTracking(() => localStorage.setItem(DEVICE_ID_KEY, id!));
  }
  return id;
}

// ── Drive data format ─────────────────────────────────────────────────────────

interface SyncData {
  version: number;
  syncedAt: string;
  deviceId: string;
  keys: Record<string, { value: string; updatedAt: string }>;
}

// ── Folder bootstrapping ──────────────────────────────────────────────────────

async function ensureFolders(meta: SyncMeta): Promise<SyncMeta> {
  if (!meta.folderId) {
    meta.folderId = await findOrCreateFolder(DRIVE_FOLDER_NAME);
  }
  if (!meta.mediaFolderId) {
    meta.mediaFolderId = await findOrCreateFolder(DRIVE_MEDIA_FOLDER, meta.folderId);
  }
  return meta;
}

// ── Pull ──────────────────────────────────────────────────────────────────────

export interface PullResult { pulled: number; mediaFetched: number }

export async function pull(): Promise<PullResult> {
  let meta = loadMeta();
  meta = await ensureFolders(meta);
  let pulled = 0;
  let mediaFetched = 0;

  // ── Metadata keys ────────────────────────────────────────────────────────────

  if (!meta.dataFileId) {
    const files = await listFiles(meta.folderId!);
    const df = files.find(f => f.name === DRIVE_DATA_FILENAME);
    if (df) meta.dataFileId = df.id;
  }

  if (meta.dataFileId) {
    let driveData: SyncData;
    try {
      driveData = JSON.parse(await readFileText(meta.dataFileId));
    } catch {
      // File unreadable — skip metadata pull this cycle
      saveMeta(meta);
      return { pulled: 0, mediaFetched: 0 };
    }

    for (const key of syncRegistry.allKeys) {
      const driveEntry = driveData.keys?.[key];
      if (!driveEntry) continue;
      const localTs = meta.keyTimestamps[key] ?? null;
      if (!localTs || driveEntry.updatedAt > localTs) {
        // Drive version is newer — write locally without triggering dirty
        syncRegistry.suppressTracking(() => localStorage.setItem(key, driveEntry.value));
        meta.keyTimestamps[key] = driveEntry.updatedAt;
        syncRegistry.setKeyTimestamp(key, driveEntry.updatedAt);
        pulled++;
      }
    }
  }

  // ── Media blobs ──────────────────────────────────────────────────────────────

  if (meta.mediaFolderId) {
    const driveMediaFiles = await listFiles(meta.mediaFolderId);
    for (const df of driveMediaFiles) {
      // File name format: <cardId>.<ext>
      const cardId = df.name.replace(/\.[^.]+$/, '');
      const driveTs = df.appProperties?.updatedAt ?? null;
      const localTs = meta.mediaTimestamps[cardId] ?? null;
      if (!driveTs || (localTs && localTs >= driveTs)) continue;

      const mimeType = df.mimeType ?? 'application/octet-stream';
      const blob = await readFileBlob(df.id, mimeType);
      await putCardMediaEntry({
        cardId,
        type: mimeType.startsWith('video/') ? 'video' : 'image',
        mimeType,
        blob,
        updatedAt: driveTs,
      });
      meta.mediaTimestamps[cardId] = driveTs;
      meta.mediaFileIds[cardId] = df.id;
      mediaFetched++;
    }
  }

  meta.lastSyncAt = new Date().toISOString();
  saveMeta(meta);
  return { pulled, mediaFetched };
}

// ── Push ──────────────────────────────────────────────────────────────────────

export interface PushResult { pushed: number; mediaPushed: number }

export async function push(): Promise<PushResult> {
  let meta = loadMeta();
  meta = await ensureFolders(meta);
  let pushed = 0;
  let mediaPushed = 0;
  const now = new Date().toISOString();

  // Read existing Drive data for non-overwriting merge of keys we haven't touched
  let existingDriveData: SyncData | null = null;
  if (meta.dataFileId) {
    try {
      existingDriveData = JSON.parse(await readFileText(meta.dataFileId));
    } catch {
      existingDriveData = null;
    }
  }

  // ── Build data.json ───────────────────────────────────────────────────────────

  const keys: SyncData['keys'] = {};
  for (const key of syncRegistry.allKeys) {
    const value = localStorage.getItem(key);
    if (value == null) continue;

    const localTs = meta.keyTimestamps[key] ?? now;
    const driveTs = existingDriveData?.keys?.[key]?.updatedAt ?? null;

    if (!driveTs || localTs >= driveTs) {
      // Local is newer (or Drive doesn't have it) — include ours
      keys[key] = { value, updatedAt: localTs };
      meta.keyTimestamps[key] = localTs;
    } else {
      // Drive is newer — keep Drive's entry (pull should have handled this already)
      keys[key] = existingDriveData!.keys[key];
    }
    pushed++;
  }

  const syncData: SyncData = {
    version: SYNC_DATA_VERSION,
    syncedAt: now,
    deviceId: getDeviceId(),
    keys,
  };

  meta.dataFileId = await uploadJson(
    JSON.stringify(syncData, null, 2),
    DRIVE_DATA_FILENAME,
    meta.folderId!,
    meta.dataFileId,
  );

  // ── Push media ────────────────────────────────────────────────────────────────

  const localMedia = await getAllCardMedia();

  for (const entry of localMedia) {
    const localTs = entry.updatedAt ?? now;
    const driveTs = meta.mediaTimestamps[entry.cardId] ?? null;
    if (driveTs && driveTs >= localTs) continue; // Drive is up to date

    const ext = entry.mimeType.startsWith('video/') ? 'mp4' : 'jpg';
    const fileName = `${entry.cardId}.${ext}`;

    meta.mediaFileIds[entry.cardId] = await uploadBlob(
      entry.blob,
      fileName,
      entry.mimeType,
      meta.mediaFolderId!,
      meta.mediaFileIds[entry.cardId] ?? null,
      { updatedAt: localTs },
    );
    meta.mediaTimestamps[entry.cardId] = localTs;
    mediaPushed++;
  }

  // Remove Drive media entries for cards that no longer exist locally
  const localCardIds = new Set(localMedia.map(m => m.cardId));
  for (const [cardId, fileId] of Object.entries(meta.mediaFileIds)) {
    if (!localCardIds.has(cardId)) {
      try { await deleteFile(fileId); } catch { /* best effort */ }
      delete meta.mediaFileIds[cardId];
      delete meta.mediaTimestamps[cardId];
    }
  }

  syncRegistry.clearDirty();
  meta.lastSyncAt = now;
  saveMeta(meta);
  return { pushed, mediaPushed };
}

// ── Full sync (pull then push) ────────────────────────────────────────────────

export async function sync(): Promise<{ pull: PullResult; push: PushResult }> {
  const pullResult = await pull();
  const pushResult = await push();
  return { pull: pullResult, push: pushResult };
}

// ── Connection management ─────────────────────────────────────────────────────

export function getSyncMeta(): Readonly<SyncMeta> {
  return loadMeta();
}

export function setSyncConnected(connected: boolean, email?: string | null): void {
  const meta = loadMeta();
  meta.connected = connected;
  if (email !== undefined) meta.googleEmail = email;
  if (!connected) {
    meta.folderId = null;
    meta.mediaFolderId = null;
    meta.dataFileId = null;
    meta.mediaFileIds = {};
  }
  saveMeta(meta);
}

/**
 * Reset all per-key timestamps so the next push re-sends everything.
 * Call after a local restore so Drive gets the fresh local state.
 */
export function resetKeyTimestamps(): void {
  const meta = loadMeta();
  meta.keyTimestamps = {};
  meta.mediaTimestamps = {};
  saveMeta(meta);
}

/** Update keyTimestamps in meta from the registry's current in-memory set. */
export function flushRegistryTimestamps(): void {
  const meta = loadMeta();
  const ts = syncRegistry.getAllKeyTimestamps();
  Object.assign(meta.keyTimestamps, ts);
  saveMeta(meta);
}
