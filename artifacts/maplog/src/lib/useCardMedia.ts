import { useEffect, useState } from 'react';
import { getCardMedia } from './mediaStore';

export interface CardMediaView {
  url: string;
  type: 'image' | 'video';
}

/**
 * Reference-counted media cache: each mounted consumer of a card id holds a
 * ref; the object URL is revoked when the last consumer unmounts (media
 * uploads can be tens of MB, so session-lifetime retention is not OK on
 * mobile). Edit Mode calls invalidateCardMedia after upload/remove, which
 * revokes and notifies mounted consumers so they refetch immediately.
 */
interface Entry {
  view: CardMediaView | null;
  loaded: boolean;
  refs: number;
  listeners: Set<() => void>;
  generation: number;
}

const cache = new Map<string, Entry>();

function getEntry(cardId: string): Entry {
  let e = cache.get(cardId);
  if (!e) {
    e = { view: null, loaded: false, refs: 0, listeners: new Set(), generation: 0 };
    cache.set(cardId, e);
  }
  return e;
}

function releaseEntry(cardId: string): void {
  const e = cache.get(cardId);
  if (!e) return;
  e.refs -= 1;
  if (e.refs <= 0) {
    if (e.view) URL.revokeObjectURL(e.view.url);
    cache.delete(cardId);
  }
}

function load(cardId: string, e: Entry): void {
  const gen = e.generation;
  getCardMedia(cardId)
    .then(m => {
      // Stale load (invalidated or fully released meanwhile) — discard
      if (cache.get(cardId) !== e || e.generation !== gen) return;
      e.view = m ? { url: URL.createObjectURL(m.blob), type: m.type } : null;
      e.loaded = true;
      e.listeners.forEach(fn => fn());
    })
    .catch(() => {
      if (cache.get(cardId) !== e || e.generation !== gen) return;
      e.view = null;
      e.loaded = true;
      e.listeners.forEach(fn => fn());
    });
}

/** Resolve Edit Mode-uploaded media for a card slot (null while loading / none). */
export function useCardMedia(cardId: string | null | undefined): CardMediaView | null {
  const [, force] = useState(0);

  useEffect(() => {
    if (!cardId) return;
    const e = getEntry(cardId);
    e.refs += 1;
    const listener = () => force(n => n + 1);
    e.listeners.add(listener);
    if (!e.loaded) load(cardId, e);
    else force(n => n + 1); // entry may have resolved between render and effect
    return () => {
      e.listeners.delete(listener);
      releaseEntry(cardId);
    };
  }, [cardId]);

  if (!cardId) return null;
  return cache.get(cardId)?.view ?? null;
}

/**
 * Drop a card's cached media (call after upload/remove in Edit Mode).
 * Revokes the old URL and makes mounted consumers refetch immediately.
 */
export function invalidateCardMedia(cardId: string): void {
  const e = cache.get(cardId);
  if (!e) return;
  if (e.view) URL.revokeObjectURL(e.view.url);
  e.view = null;
  e.loaded = false;
  e.generation += 1;
  if (e.refs > 0) {
    load(cardId, e);
  } else {
    cache.delete(cardId);
  }
}
