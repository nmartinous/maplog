import React, { useMemo } from 'react';
import { DEFAULT_TAG_RULES, loadTagRules, type TagRules } from '@/lib/tags';
import { cn } from '@/lib/utils';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** All tags that appear anywhere in the default rules. */
const DEFAULT_ALL_TAGS = new Set<string>([
  ...DEFAULT_TAG_RULES.presenceTags,
  ...DEFAULT_TAG_RULES.baseRarities,
  ...Object.keys(DEFAULT_TAG_RULES.overrides),
  ...Object.values(DEFAULT_TAG_RULES.overrides).flat(),
]);

/** Modifier tags: all override-value tags (deduplicated, excluding presence/base). */
const DEFAULT_MODIFIER_TAGS: string[] = [
  ...new Set(Object.values(DEFAULT_TAG_RULES.overrides).flat()),
].filter(t => !DEFAULT_TAG_RULES.presenceTags.includes(t) && !DEFAULT_TAG_RULES.baseRarities.includes(t));

const CAP_LABELS: Record<string, string> = {
  regular: 'Regular', epic: 'Epic', radiant: 'Radiant', lyrics: 'Lyrics', moment: 'Moment',
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare',
  shiny: 'Shiny', day1: 'Day 1', week1: 'Week 1',
  halloween: 'Halloween', lovers: 'Lovers', grammy: 'Grammy', aprilfools: 'April Fools',
  streak: 'Streak', freshman: 'Freshman', lucky: 'Lucky',
  coachella: 'Coachella', mayflower: 'Mayflower', pridemap: 'Pridemap', summersplash: 'Summer Splash',
};

function label(tag: string) {
  return CAP_LABELS[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1);
}

// ── Conflict logic ─────────────────────────────────────────────────────────────

/** Compute which tags should be disabled given the current selection. */
function deriveDisabled(selected: string[], rules: TagRules): Set<string> {
  const sel = new Set(selected);
  const disabled = new Set<string>();

  const selectedPresence = rules.presenceTags.find(p => sel.has(p)) ?? null;
  const selectedBases = rules.baseRarities.filter(b => sel.has(b));

  // One presence at a time — other presences become disabled
  if (selectedPresence) {
    rules.presenceTags.forEach(p => { if (p !== selectedPresence) disabled.add(p); });
  }

  // Non-regular presence → base rarity chips disabled (they don't apply)
  if (selectedPresence && selectedPresence !== 'regular') {
    rules.baseRarities.forEach(b => disabled.add(b));
  }

  // Any base selected → non-regular presences disabled (base implies regular)
  if (selectedBases.length > 0) {
    rules.presenceTags.forEach(p => { if (p !== 'regular') disabled.add(p); });
    // Remaining bases (not selected) disabled (mutually exclusive)
    rules.baseRarities.forEach(b => { if (!sel.has(b)) disabled.add(b); });
  }

  return disabled;
}

/** Compute the new tag set after toggling `tag` (with auto-deselect). */
export function toggleTag(tag: string, selected: string[], rules: TagRules): string[] {
  const sel = new Set(selected);

  if (sel.has(tag)) {
    sel.delete(tag);
    return [...sel];
  }

  // Auto-remove conflicting tags before adding
  const toRemove = new Set<string>();

  if (rules.presenceTags.includes(tag)) {
    // Adding a presence removes other presences
    rules.presenceTags.forEach(p => { if (p !== tag) toRemove.add(p); });
    // Adding a non-regular presence removes base rarities
    if (tag !== 'regular') {
      rules.baseRarities.forEach(b => toRemove.add(b));
    }
  }

  if (rules.baseRarities.includes(tag)) {
    // Adding a base removes other bases
    rules.baseRarities.forEach(b => { if (b !== tag) toRemove.add(b); });
    // Adding a base implies regular → remove non-regular presences
    rules.presenceTags.forEach(p => { if (p !== 'regular') toRemove.add(p); });
  }

  toRemove.forEach(t => sel.delete(t));
  sel.add(tag);
  return [...sel];
}

// ── Chip ───────────────────────────────────────────────────────────────────────

function Chip({ tag, selected, disabled, onClick }: {
  tag: string; selected: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-bold border transition-colors select-none',
        selected
          ? 'bg-primary text-white border-primary'
          : disabled
            ? 'bg-white/[0.03] text-white/20 border-white/5 cursor-not-allowed'
            : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white',
      )}
    >
      {label(tag)}
    </button>
  );
}

// ── Group ───────────────────────────────────────────────────────────────────────

function Group({ title, tags, selected, disabled, onToggle }: {
  title: string; tags: string[]; selected: Set<string>; disabled: Set<string>; onToggle: (tag: string) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => (
          <Chip
            key={tag}
            tag={tag}
            selected={selected.has(tag)}
            disabled={disabled.has(tag)}
            onClick={() => onToggle(tag)}
          />
        ))}
      </div>
    </div>
  );
}

// ── TagChipPicker ──────────────────────────────────────────────────────────────

interface TagChipPickerProps {
  selected: string[];
  onChange: (next: string[]) => void;
}

export function TagChipPicker({ selected, onChange }: TagChipPickerProps) {
  const rules = useMemo(() => loadTagRules(), []);

  // Custom tags: tags in the loaded rules but NOT in the built-in set
  const customTags = useMemo(() => {
    const custom: string[] = [];
    const addIfNew = (t: string) => { if (!DEFAULT_ALL_TAGS.has(t) && !custom.includes(t)) custom.push(t); };
    rules.presenceTags.forEach(addIfNew);
    rules.baseRarities.forEach(addIfNew);
    Object.values(rules.overrides).flat().forEach(addIfNew);
    return custom;
  }, [rules]);

  const selSet = useMemo(() => new Set(selected), [selected]);
  const disabledSet = useMemo(() => deriveDisabled(selected, rules), [selected, rules]);

  const handleToggle = (tag: string) => {
    if (disabledSet.has(tag)) return; // disabled — no-op
    onChange(toggleTag(tag, selected, rules));
  };

  return (
    <div className="space-y-3">
      <Group
        title="Presence"
        tags={rules.presenceTags.filter(t => DEFAULT_TAG_RULES.presenceTags.includes(t))}
        selected={selSet} disabled={disabledSet} onToggle={handleToggle}
      />
      <Group
        title="Base Rarity"
        tags={rules.baseRarities.filter(t => DEFAULT_TAG_RULES.baseRarities.includes(t))}
        selected={selSet} disabled={disabledSet} onToggle={handleToggle}
      />
      <Group
        title="Modifier"
        tags={DEFAULT_MODIFIER_TAGS}
        selected={selSet} disabled={disabledSet} onToggle={handleToggle}
      />
      {customTags.length > 0 && (
        <Group
          title="Custom Tags"
          tags={customTags}
          selected={selSet} disabled={disabledSet} onToggle={handleToggle}
        />
      )}
    </div>
  );
}
