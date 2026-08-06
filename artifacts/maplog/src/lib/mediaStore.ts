/**
 * Media store — IndexedDB persistence for card-slot uploads (videos/images).
 *
 * localStorage cannot hold media-sized assets (~5MB quota, string-only), so
 * card media lives in IndexedDB keyed by card id. The JSON collection stays
 * in localStorage; renderers look media up by card id.
 *
 * Known limitation: if a card is removed and later re-added by a playlist
 * sync, it gets a new id and previously attached media is orphaned (kept in
 * the store, no longer shown). The export/import task will handle remap/GC.
 */

const DB_NAME = 'maplog-media';
const STORE = 'cardMedia';
const DB_VERSION = 1;

export interface CardMedia {
  cardId: string;
  type: 'image' | 'video';
  mimeType: string;
  blob: Blob;
  updatedAt: string; // ISO
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'cardId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    let result: T;
    req.onsuccess = () => { result = req.result; };
    // Only report success once the transaction actually commits — resolving on
    // request success can claim a write saved that later aborts (e.g. quota).
    t.oncomplete = () => { db.close(); resolve(result); };
    t.onerror = () => { db.close(); reject(t.error ?? req.error ?? new Error('IndexedDB request failed')); };
    t.onabort = () => { db.close(); reject(t.error ?? new Error('IndexedDB transaction aborted')); };
  }));
}

export async function putCardMedia(cardId: string, file: Blob & { type?: string }): Promise<CardMedia> {
  const mimeType = file.type || 'application/octet-stream';
  const type: CardMedia['type'] = mimeType.startsWith('video/') ? 'video' : 'image';
  const entry: CardMedia = { cardId, type, mimeType, blob: file, updatedAt: new Date().toISOString() };
  await tx('readwrite', s => s.put(entry));
  return entry;
}

export async function getCardMedia(cardId: string): Promise<CardMedia | null> {
  const res = await tx<CardMedia | undefined>('readonly', s => s.get(cardId));
  return res ?? null;
}

export async function deleteCardMedia(cardId: string): Promise<void> {
  await tx('readwrite', s => s.delete(cardId));
}

/**
 * Atomically replace ALL stored media with the given entries (backup restore).
 * Runs clear + puts in a single readwrite transaction, so a mid-restore
 * failure (e.g. quota) aborts the whole transaction and existing media
 * survives untouched.
 */
export async function replaceAllCardMedia(entries: CardMedia[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    store.clear();
    for (const entry of entries) store.put(entry);
    t.oncomplete = () => { db.close(); resolve(); };
    t.onerror = () => { db.close(); reject(t.error ?? new Error('IndexedDB request failed')); };
    t.onabort = () => { db.close(); reject(t.error ?? new Error('IndexedDB transaction aborted')); };
  });
}

/** Every stored media entry (used by backup export). */
export async function getAllCardMedia(): Promise<CardMedia[]> {
  const res = await tx<CardMedia[]>('readonly', s => s.getAll());
  return res ?? [];
}

/** All card ids that currently have media attached. */
export async function listMediaCardIds(): Promise<string[]> {
  const keys = await tx<IDBValidKey[]>('readonly', s => s.getAllKeys());
  return keys.map(String);
}

/**
 * Garbage-collect media entries whose card ids are no longer in the
 * collection.  Call this after any sync that may have dropped cards.
 * Returns the number of entries deleted.
 *
 * Runs as a single readwrite transaction so it never deletes an entry
 * that was just written by a concurrent upload (the upload's put would
 * win or the transaction would serialize).
 */
export async function gcOrphanedMedia(activeCardIds: string[]): Promise<number> {
  const activeSet = new Set(activeCardIds);
  const db = await openDb();
  return new Promise<number>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    const keysReq = store.getAllKeys();
    let deleted = 0;
    keysReq.onsuccess = () => {
      const keys = keysReq.result as IDBValidKey[];
      for (const key of keys) {
        if (!activeSet.has(String(key))) {
          store.delete(key);
          deleted++;
        }
      }
    };
    t.oncomplete = () => { db.close(); resolve(deleted); };
    t.onerror   = () => { db.close(); reject(t.error ?? new Error('gcOrphanedMedia failed')); };
    t.onabort   = () => { db.close(); reject(t.error ?? new Error('gcOrphanedMedia aborted')); };
  });
}
