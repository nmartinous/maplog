/**
 * SyncRegistry — central ledger for the sync system.
 *
 * Responsibilities:
 *  1. Know which localStorage keys need syncing (core BACKUP_KEYS + custom contributors)
 *  2. Track which keys have changed since the last push (dirty tracking)
 *  3. Notify listeners so the debounced auto-push can fire
 *
 * To add a new feature to sync: call `syncRegistry.register({ keys: ['maplog:myFeature'] })`.
 * Core BACKUP_KEYS are registered automatically by the sync engine at startup.
 */

import { BACKUP_KEYS } from '@/lib/backup';

// ── Contributor interface ─────────────────────────────────────────────────────

export interface SyncContributor {
  /**
   * localStorage keys this contributor owns.
   * All BACKUP_KEYS are auto-covered; only add keys beyond that list here.
   */
  keys?: readonly string[];

  /**
   * Returns the card IDs whose media (IndexedDB blobs) need syncing.
   * Only implement for features that use putCardMedia.
   * The core collection already registers all card media automatically.
   */
  getMediaCardIds?(): Promise<string[]>;
}

type DirtyListener = (key: string) => void;

// ── Registry class ────────────────────────────────────────────────────────────

class SyncRegistryClass {
  private contributors: SyncContributor[] = [];
  private keyTimestamps: Record<string, string> = {};
  private dirtyKeys = new Set<string>();
  private dirtyListeners: DirtyListener[] = [];
  private _suppress = false;
  private patched = false;

  // ── Key set ─────────────────────────────────────────────────────────────────

  /** Every localStorage key the sync system covers. */
  get allKeys(): readonly string[] {
    const core = BACKUP_KEYS as readonly string[];
    const custom = this.contributors.flatMap(c => c.keys ?? []);
    return [...new Set([...core, ...custom])];
  }

  // ── Contributor registration ─────────────────────────────────────────────────

  /**
   * Register a sync contributor. Call once per feature that owns localStorage
   * keys or media beyond the core BACKUP_KEYS list.
   *
   * @example
   *   syncRegistry.register({ keys: ['maplog:myNewFeature'] });
   */
  register(contributor: SyncContributor): void {
    this.contributors.push(contributor);
  }

  getContributors(): readonly SyncContributor[] {
    return this.contributors;
  }

  // ── Dirty tracking ───────────────────────────────────────────────────────────

  /**
   * Called by the localStorage patch when a covered key is written.
   * No-op when tracking is suppressed (i.e. the sync engine is writing).
   */
  onKeyWritten(key: string): void {
    if (this._suppress) return;
    if (!(this.allKeys as string[]).includes(key)) return;
    const now = new Date().toISOString();
    this.keyTimestamps[key] = now;
    this.dirtyKeys.add(key);
    for (const l of this.dirtyListeners) l(key);
  }

  /** Subscribe to dirty events. Returns an unsubscribe function. */
  onDirty(listener: DirtyListener): () => void {
    this.dirtyListeners.push(listener);
    return () => {
      this.dirtyListeners = this.dirtyListeners.filter(l => l !== listener);
    };
  }

  /** Keys written since the last clearDirty(). */
  getDirtyKeys(): ReadonlySet<string> {
    return this.dirtyKeys;
  }

  /** Call after a successful push. */
  clearDirty(): void {
    this.dirtyKeys.clear();
  }

  // ── Timestamp management ─────────────────────────────────────────────────────

  getKeyTimestamp(key: string): string | null {
    return this.keyTimestamps[key] ?? null;
  }

  setKeyTimestamp(key: string, ts: string): void {
    this.keyTimestamps[key] = ts;
  }

  /** Bulk-load timestamps saved from a previous session (called on SyncContext mount). */
  loadKeyTimestamps(timestamps: Record<string, string>): void {
    Object.assign(this.keyTimestamps, timestamps);
  }

  getAllKeyTimestamps(): Record<string, string> {
    return { ...this.keyTimestamps };
  }

  // ── Suppression ──────────────────────────────────────────────────────────────

  /**
   * Run fn() without dirty-tracking its localStorage writes.
   * Used by the sync engine when writing pulled data so it doesn't
   * immediately re-queue a push of the just-pulled content.
   */
  suppressTracking<T>(fn: () => T): T {
    this._suppress = true;
    try { return fn(); } finally { this._suppress = false; }
  }

  // ── localStorage patch ───────────────────────────────────────────────────────

  /**
   * Monkey-patch Storage.prototype.setItem so writes to covered keys are
   * automatically tracked. Call once during sync setup.
   */
  installStoragePatch(): void {
    if (this.patched) return;
    this.patched = true;
    const registry = this;
    const proto = Storage.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, 'setItem')!.value as
      (this: Storage, key: string, value: string) => void;

    Object.defineProperty(proto, 'setItem', {
      configurable: true,
      writable: true,
      value(this: Storage, key: string, value: string) {
        original.call(this, key, value);
        if (this === localStorage) {
          registry.onKeyWritten(key);
        }
      },
    });
  }
}

export const syncRegistry = new SyncRegistryClass();
