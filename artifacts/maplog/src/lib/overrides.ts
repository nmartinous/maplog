import { DEFAULT_TAG_RULES, loadTagRules, saveTagRules, normalizeTags } from './tags';

/**
 * Override rarity manager — user-created override tags layered on top of the
 * built-in tag rules, plus display metadata for renderers that land later
 * (epics/moments/lyrics/radiants task).
 *
 * The uniqueness rules live in the tag rule engine (maplog:tagRules — merged
 * over DEFAULT_TAG_RULES by loadTagRules); the display/value metadata lives
 * here under maplog:overrideMeta.
 */

const META_KEY = 'maplog:overrideMeta';

export interface OverrideMeta {
  /** Canonical tag (lowercase, no '#') */
  tag: string;
  /** Display label, e.g. "Summer Splash" */
  label: string;
  /** Presence tags this override applies to (grants an extra copy of each) */
  appliesTo: string[];
  /** Optional value multiplier (like shiny's ×50); 1/absent = no effect */
  valueMultiplier?: number;
  /** Display metadata — stored now, rendered by later tasks */
  pin?: string;         // emoji or short text pinned on the art
  flavorText?: string;
  subjectText?: string;
  frame?: string;       // frame style key
  background?: string;  // background style key / CSS color
  createdAt: string;    // ISO
}

let metaCache: OverrideMeta[] | null = null;

export function loadOverrideMeta(): OverrideMeta[] {
  if (metaCache) return metaCache;
  try {
    const raw = localStorage.getItem(META_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    metaCache = Array.isArray(parsed) ? parsed : [];
  } catch {
    metaCache = [];
  }
  return metaCache;
}

function saveOverrideMeta(list: OverrideMeta[]): void {
  metaCache = list;
  localStorage.setItem(META_KEY, JSON.stringify(list));
}

export function canonicalTag(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Built-in override tags (read-only in the manager UI). */
export function builtInOverrideTags(): Set<string> {
  return new Set(Object.values(DEFAULT_TAG_RULES.overrides).flat());
}

/**
 * Create or update a custom override: registers the tag in the rule engine's
 * overrides map (so uniqueness exceptions apply immediately) and stores its
 * display metadata.
 */
export function upsertOverride(meta: Omit<OverrideMeta, 'createdAt'> & { createdAt?: string }): OverrideMeta {
  const tag = canonicalTag(meta.tag || meta.label);
  if (!tag) throw new Error('Override needs a name.');
  const appliesTo = normalizeTags(meta.appliesTo);
  if (appliesTo.length === 0) throw new Error('Pick at least one rarity this override applies to.');

  // 1. Rule engine: extend the overrides map (persisted extension merges over defaults)
  const rules = loadTagRules();
  const overrides: Record<string, string[]> = { ...rules.overrides };
  for (const presence of Object.keys(overrides)) {
    const has = overrides[presence].includes(tag);
    const should = appliesTo.includes(presence);
    if (should && !has) overrides[presence] = [...overrides[presence], tag];
    if (!should && has && !builtInOverrideTags().has(tag)) {
      overrides[presence] = overrides[presence].filter(t => t !== tag);
    }
  }
  for (const presence of appliesTo) {
    if (!overrides[presence]) overrides[presence] = [tag];
  }
  saveTagRules({ overrides });

  // 2. Display metadata
  const list = loadOverrideMeta();
  const existing = list.find(m => m.tag === tag);
  const entry: OverrideMeta = {
    ...existing,
    ...meta,
    tag,
    appliesTo,
    createdAt: existing?.createdAt ?? meta.createdAt ?? new Date().toISOString(),
  };
  saveOverrideMeta([...list.filter(m => m.tag !== tag), entry]);
  return entry;
}

/** Remove a custom override from the rule engine and its metadata. */
export function deleteOverride(tag: string): void {
  if (builtInOverrideTags().has(tag)) throw new Error('Built-in overrides cannot be deleted.');
  const rules = loadTagRules();
  const overrides: Record<string, string[]> = {};
  for (const [presence, tags] of Object.entries(rules.overrides)) {
    overrides[presence] = tags.filter(t => t !== tag);
  }
  saveTagRules({ overrides });
  saveOverrideMeta(loadOverrideMeta().filter(m => m.tag !== tag));
}

/** tag → value multiplier for all custom overrides that carry one. */
export function overrideMultipliers(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of loadOverrideMeta()) {
    if (m.valueMultiplier && m.valueMultiplier !== 1) out[m.tag] = m.valueMultiplier;
  }
  return out;
}
