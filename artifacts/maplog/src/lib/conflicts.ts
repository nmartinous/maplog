import type { MaplogSong } from './types';
import type { ConflictCopy } from './tags';

/**
 * Persisted conflict queue — copies pulled out of the collection during
 * import/refresh because they violated tag rules. They wait here until the
 * user resolves them (keep one copy, or discard) in the conflict-resolution
 * screen (later part of Edit Mode).
 */

const CONFLICTS_KEY = 'maplog:conflicts';

export interface TagConflict {
  id: string;
  /** The track the copies belong to */
  trackId: string;
  title: string;
  artist: string;
  artworkUrl: string;
  /** Why these copies were pulled out */
  reason: string;
  /** The conflicting copies (full cards so any of them can be restored) */
  copies: ConflictCopy[];
  /** The track data without the conflicting cards, for restoring a copy */
  track: Omit<MaplogSong, 'cards'>;
  createdAt: string; // ISO
}

export function loadConflicts(): TagConflict[] {
  try {
    const raw = localStorage.getItem(CONFLICTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveConflicts(conflicts: TagConflict[]): void {
  localStorage.setItem(CONFLICTS_KEY, JSON.stringify(conflicts));
}

/**
 * Stable fingerprint of a conflict — track + reason + normalized copy tag
 * pools. Re-running a refresh without fixing the playlists re-detects the
 * same conflict; the fingerprint lets the scan upsert instead of piling up
 * duplicate queue entries.
 */
export function conflictFingerprint(c: Pick<TagConflict, 'trackId' | 'reason' | 'copies'>): string {
  const pools = c.copies
    .map(cp => [...(cp.card.tags ?? [])].sort().join(','))
    .sort()
    .join(';');
  return `${c.trackId}|${c.reason}|${pools}`;
}

export function makeConflictId(): string {
  return `cf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** "Song 1 - Song 2 > Conflict" line for the post-import summary + copy button. */
export function conflictLine(c: TagConflict): string {
  const names = c.copies.map(cp => `${c.title} (${cp.label})`);
  return `${names.join(' - ')} > Conflict`;
}
