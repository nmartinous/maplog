import type { MaplogCard, MaplogSong } from './types';

/**
 * Internal tag system — the data backbone for songs vs tracks.
 *
 * A TRACK is one Apple Music/Deezer track (a MaplogSong). A SONG (in Soundmap
 * terms) is one collected copy of a track — a MaplogCard. Every card carries a
 * tag pool (canonical lowercase strings, no '#'). Tags are never shown to the
 * user as raw hashtags — they drive filtering, valuation, and rendering.
 *
 * Rule model (config-driven so Edit Mode can extend it later):
 * - Exactly one PRESENCE tag per copy: regular | epic | radiant | lyrics | moment.
 * - 'regular' copies need exactly one BASE RARITY: common | uncommon | rare.
 * - Uniqueness: a track may hold at most one copy tagged T unless the copy
 *   also holds an override tag from OVERRIDES[T]
 *   (e.g. two 'regular' copies are fine if one is also 'shiny' or 'day1').
 * - Two 'regular' copies with DIFFERENT base rarities always conflict,
 *   regardless of overrides.
 * - Copies with byte-identical tag pools are exact duplicates → silently deduped.
 */

// ── Rule configuration ─────────────────────────────────────────────────────────

export interface TagRules {
  /** Exactly one of these per copy — what kind of card it is */
  presenceTags: string[];
  /** Base rarity tags; required (exactly one) for copies of these presence tags */
  baseRarities: string[];
  /** Presence tags that require a base rarity tag */
  requiresBaseRarity: string[];
  /** tag → override tags that allow an extra copy carrying that tag */
  overrides: Record<string, string[]>;
}

export const DEFAULT_TAG_RULES: TagRules = {
  presenceTags: ['regular', 'epic', 'radiant', 'lyrics', 'moment'],
  baseRarities: ['common', 'uncommon', 'rare'],
  requiresBaseRarity: ['regular'],
  overrides: {
    regular: ['shiny', 'day1', 'week1', 'halloween', 'lovers', 'grammy', 'aprilfools'],
    shiny:   ['day1', 'week1'],
    epic:    ['streak', 'freshman', 'lucky', 'coachella', 'mayflower', 'pridemap', 'summersplash'],
    radiant: [],
    lyrics:  [],
    moment:  [],
  },
};

const RULES_KEY = 'maplog:tagRules';

/** Load rules — user extensions (added via Edit Mode later) merge over defaults. */
export function loadTagRules(): TagRules {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (!raw) return DEFAULT_TAG_RULES;
    const saved = JSON.parse(raw) as Partial<TagRules>;
    return {
      presenceTags: uniq([...DEFAULT_TAG_RULES.presenceTags, ...(saved.presenceTags ?? [])]),
      baseRarities: uniq([...DEFAULT_TAG_RULES.baseRarities, ...(saved.baseRarities ?? [])]),
      requiresBaseRarity: uniq([...DEFAULT_TAG_RULES.requiresBaseRarity, ...(saved.requiresBaseRarity ?? [])]),
      overrides: { ...DEFAULT_TAG_RULES.overrides, ...(saved.overrides ?? {}) },
    };
  } catch {
    return DEFAULT_TAG_RULES;
  }
}

/** Merge a partial patch into the saved rule extensions (never clobbers other keys). */
export function saveTagRules(patch: Partial<TagRules>): void {
  let saved: Partial<TagRules> = {};
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (raw) saved = JSON.parse(raw) as Partial<TagRules>;
  } catch { /* start fresh */ }
  localStorage.setItem(RULES_KEY, JSON.stringify({ ...saved, ...patch }));
}

// ── Tag pool helpers ───────────────────────────────────────────────────────────

const uniq = <T,>(a: T[]) => [...new Set(a)];

/** Canonical form: lowercase, trimmed, deduped, sorted. */
export function normalizeTags(tags: string[]): string[] {
  return uniq(tags.map(t => t.trim().toLowerCase()).filter(Boolean)).sort();
}

export function sameTagPool(a: string[], b: string[]): boolean {
  const na = normalizeTags(a), nb = normalizeTags(b);
  return na.length === nb.length && na.every((t, i) => t === nb[i]);
}

/**
 * Migration: derive a tag pool from a legacy rarityType slug.
 * Returns null for unknown slugs — the card stays untagged and validation
 * routes it to conflict resolution instead of persisting a guessed mapping.
 */
export function tagsFromRaritySlug(slug: string): string[] | null {
  switch (slug) {
    case 'regular-common':   return ['regular', 'common'];
    case 'regular-uncommon': return ['regular', 'uncommon'];
    case 'regular-rare':     return ['regular', 'rare'];
    case 'shiny-common':     return ['regular', 'shiny', 'common'];
    case 'shiny-uncommon':   return ['regular', 'shiny', 'uncommon'];
    case 'shiny-rare':       return ['regular', 'shiny', 'rare'];
    case 'epic':             return ['epic'];
    case 'special-edition':  return ['epic', 'specialedition'];
    case 'special-epic':     return ['epic', 'specialepic'];
    case 'streak-epic':      return ['epic', 'streak'];
    case 'moment':           return ['moment'];
    case 'lyric':            return ['lyrics'];
    case 'radiant':          return ['radiant'];
    default:                 return null; // unknown — let validation surface it
  }
}

/** Ensure a card carries a tag pool (in-place-safe: returns a new card if changed). */
export function ensureCardTags(card: MaplogCard): MaplogCard {
  if (card.tags && card.tags.length > 0) return card;
  const derived = tagsFromRaritySlug(card.rarityType.slug);
  if (!derived) return card; // unknown slug: stay untagged, validation flags it
  return { ...card, tags: normalizeTags(derived) };
}

/** Human label for a tag pool, e.g. ['regular','shiny','rare'] → "Shiny Rare". */
export function labelForTags(tags: string[] | undefined): string {
  if (!tags || tags.length === 0) return 'Unknown';
  const t = new Set(normalizeTags(tags));
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const SPECIAL: Record<string, string> = {
    day1: 'Day 1', week1: 'Week 1', aprilfools: 'April Fools',
    specialedition: 'Special Edition', specialepic: 'Special Epic',
    summersplash: 'Summer Splash', pridemap: 'Pridemap',
  };
  const rules = DEFAULT_TAG_RULES;
  const presence = rules.presenceTags.find(p => t.has(p));
  const base = rules.baseRarities.find(b => t.has(b));
  const mods = [...t].filter(x => x !== presence && x !== base && !rules.presenceTags.includes(x));
  const word = (x: string) => SPECIAL[x] ?? cap(x);
  const parts = [...mods.sort().map(word)];
  if (presence && presence !== 'regular') parts.push(word(presence === 'lyrics' ? 'lyrics' : presence));
  if (base) parts.push(word(base));
  if (parts.length === 0 && presence) parts.push(word(presence));
  return parts.join(' ') || 'Unknown';
}

// ── Validation / conflict detection ───────────────────────────────────────────

export interface ConflictCopy {
  card: MaplogCard;         // full card (with tags) so it can be restored
  label: string;            // human label, e.g. "Shiny Rare"
}

export interface TrackValidation {
  /** Cards that passed validation (already exact-deduped) */
  validCards: MaplogCard[];
  /** Number of exact duplicates silently removed */
  deduped: number;
  /** Groups of copies that violate a rule together (all pulled from collection) */
  conflictGroups: { reason: string; copies: ConflictCopy[] }[];
}

/**
 * Validate one track's copies against the tag rules.
 * Exact duplicates are deduped silently; rule violations produce conflict
 * groups whose copies must be removed from the collection and queued.
 */
export function validateTrackCards(cards: MaplogCard[], rules: TagRules = loadTagRules()): TrackValidation {
  // 1) Ensure tags + exact dedupe
  const seen: string[][] = [];
  let deduped = 0;
  const pool: MaplogCard[] = [];
  for (const raw of cards) {
    const card = ensureCardTags(raw);
    const tags = normalizeTags(card.tags ?? []);
    if (tags.length > 0 && seen.some(s => sameTagPool(s, tags))) { deduped++; continue; }
    seen.push(tags);
    pool.push({ ...card, tags });
  }

  const conflictGroups: TrackValidation['conflictGroups'] = [];
  const conflicted = new Set<string>(); // card ids pulled out

  const copyOf = (c: MaplogCard): ConflictCopy => ({
    card: c,
    label: c.tags?.length ? labelForTags(c.tags) : (c.rarityType?.name ?? 'Unknown'),
  });
  const has = (c: MaplogCard, t: string) => (c.tags ?? []).includes(t);

  // 2) Structural checks per copy
  for (const c of pool) {
    if (!c.tags || c.tags.length === 0) {
      conflictGroups.push({
        reason: `Unrecognized rarity "${c.rarityType?.name ?? c.rarityType?.slug ?? 'unknown'}" — pick how to treat this copy`,
        copies: [copyOf(c)],
      });
      conflicted.add(c.id);
      continue;
    }
    const presence = rules.presenceTags.filter(p => has(c, p));
    if (presence.length !== 1) {
      conflictGroups.push({
        reason: presence.length === 0
          ? 'Copy has no card-type tag (Regular/Epic/Radiant/Lyrics/Moment)'
          : `Copy has multiple card-type tags (${presence.join(', ')})`,
        copies: [copyOf(c)],
      });
      conflicted.add(c.id);
      continue;
    }
    if (rules.requiresBaseRarity.includes(presence[0])) {
      const bases = rules.baseRarities.filter(b => has(c, b));
      if (bases.length !== 1) {
        conflictGroups.push({
          reason: bases.length === 0
            ? 'Regular copy is missing a base rarity (Common/Uncommon/Rare)'
            : `Copy has multiple base rarities (${bases.join(', ')})`,
          copies: [copyOf(c)],
        });
        conflicted.add(c.id);
      }
    }
  }

  const live = () => pool.filter(c => !conflicted.has(c.id));

  // 3) Two plain 'regular' copies (no override tag) with different base
  //    rarities conflict regardless of anything else. Overridden copies
  //    (shiny/day1/…) legitimately carry their own base rarity.
  const regularOverrides = rules.overrides['regular'] ?? [];
  const regulars = live().filter(c => has(c, 'regular') && !regularOverrides.some(o => has(c, o)));
  const baseOf = (c: MaplogCard) => rules.baseRarities.find(b => has(c, b));
  const baseSet = uniq(regulars.map(baseOf).filter(Boolean));
  if (baseSet.length > 1) {
    conflictGroups.push({
      reason: `Regular copies disagree on base rarity (${baseSet.join(' vs ')})`,
      copies: regulars.map(copyOf),
    });
    regulars.forEach(c => conflicted.add(c.id));
  }

  // 4) Per-tag uniqueness with overrides
  for (const [tag, overrideTags] of Object.entries(rules.overrides)) {
    const bare = live().filter(c => has(c, tag) && !overrideTags.some(o => has(c, o)));
    if (bare.length > 1) {
      conflictGroups.push({
        reason: `More than one ${labelForTags([tag])} copy without an override tag`,
        copies: bare.map(copyOf),
      });
      bare.forEach(c => conflicted.add(c.id));
    }
  }

  return { validCards: live(), deduped, conflictGroups };
}

/** Convenience: run validation across a whole collection. */
export function validateCollection(songs: MaplogSong[], rules: TagRules = loadTagRules()) {
  return songs.map(song => ({ song, result: validateTrackCards(song.cards, rules) }));
}
