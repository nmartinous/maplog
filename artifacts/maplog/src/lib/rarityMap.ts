import type { MaplogRarityType } from './types';

/**
 * Maps the suffix after "Maplog · " in a playlist name to rarity metadata.
 * Example: "Maplog · Shiny Rare" → { slug: 'shiny-rare', ... }
 */
const RARITY_MAP: Record<string, MaplogRarityType> = {
  'Common':          { slug: 'regular-common',   name: 'Common',          category: 'Regular',         tier: 1  },
  'Uncommon':        { slug: 'regular-uncommon', name: 'Uncommon',        category: 'Regular',         tier: 2  },
  'Rare':            { slug: 'regular-rare',     name: 'Rare',            category: 'Regular',         tier: 3  },
  'Shiny Common':    { slug: 'shiny-common',     name: 'Shiny Common',    category: 'Shiny',           tier: 4  },
  'Shiny Uncommon':  { slug: 'shiny-uncommon',   name: 'Shiny Uncommon',  category: 'Shiny',           tier: 5  },
  'Shiny Rare':      { slug: 'shiny-rare',       name: 'Shiny Rare',      category: 'Shiny',           tier: 6  },
  'Epic':            { slug: 'epic',             name: 'Epic',            category: 'Epic',            tier: 7  },
  'Special Edition': { slug: 'special-edition',  name: 'Special Edition', category: 'Special Edition', tier: 7  },
  'Special Epic':    { slug: 'special-epic',     name: 'Special Epic',    category: 'Special Epic',    tier: 8  },
  'Streak Epic':     { slug: 'streak-epic',      name: 'Streak Epic',     category: 'Streak Epic',     tier: 8  },
  'Moment':          { slug: 'moment',           name: 'Moment',          category: 'Moment',          tier: 8  },
  'Lyric':           { slug: 'lyric',            name: 'Lyric',           category: 'Lyric',           tier: 9  },
  'Radiant':         { slug: 'radiant',          name: 'Radiant',         category: 'Radiant',         tier: 10 },
};

const PREFIX = 'Maplog · ';

export function isMaplogPlaylist(name: string): boolean {
  return name.startsWith(PREFIX);
}

export function rarityFromPlaylistName(name: string): MaplogRarityType | null {
  if (!name.startsWith(PREFIX)) return null;
  const key = name.slice(PREFIX.length).trim();
  return RARITY_MAP[key] ?? null;
}

/** Representative slug for each category — used to render styled filter pills */
export const CATEGORY_SLUG: Record<string, string> = {
  'Regular':         'regular-common',
  'Shiny':           'shiny-common',
  'Epic':            'epic',
  'Special Edition': 'special-edition',
  'Special Epic':    'special-epic',
  'Streak Epic':     'streak-epic',
  'Lyric':           'lyric',
  'Radiant':         'radiant',
  'Moment':          'moment',
};

/** All rarity category names for filter chips */
export const ALL_CATEGORIES = [
  'All', 'Regular', 'Shiny', 'Epic',
  'Special Edition', 'Special Epic', 'Streak Epic',
  'Lyric', 'Radiant', 'Moment',
] as const;

/** All rarity types in tier order (for pickers) */
export const ALL_RARITIES: MaplogRarityType[] = Object.values(RARITY_MAP)
  .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

/**
 * Rarities that can be linked to an Apple Music playlist in Settings.
 * Base tiers + shiny tiers (each shiny tier is its own playlist so the
 * copy's base rarity is unambiguous).
 */
export const LINKABLE_RARITY_TIERS: MaplogRarityType[] = [
  RARITY_MAP['Common'],
  RARITY_MAP['Uncommon'],
  RARITY_MAP['Rare'],
  RARITY_MAP['Shiny Common'],
  RARITY_MAP['Shiny Uncommon'],
  RARITY_MAP['Shiny Rare'],
];

/** Parse a human-entered rarity label (case-insensitive, aliased) → rarity object */
export function rarityFromLabel(label: string): MaplogRarityType | null {
  const s = label.trim();
  if (!s) return null;

  // Exact case-insensitive key match
  const exactKey = Object.keys(RARITY_MAP).find(k => k.toLowerCase() === s.toLowerCase());
  if (exactKey) return RARITY_MAP[exactKey];

  // Common aliases / abbreviations
  const aliases: Record<string, string> = {
    'common':          'Common',
    'uncommon':        'Uncommon',
    'rare':            'Rare',
    'shiny':           'Shiny Rare',
    'shiny common':    'Shiny Common',
    'shiny uncommon':  'Shiny Uncommon',
    'shiny rare':      'Shiny Rare',
    'epic':            'Epic',
    'se':              'Special Edition',
    'special':         'Special Edition',
    'special edition': 'Special Edition',
    'special epic':    'Special Epic',
    'streak':          'Streak Epic',
    'streak epic':     'Streak Epic',
    'moment':          'Moment',
    'lyric':           'Lyric',
    'radiant':         'Radiant',
    'regular':         'Common',
    'normal':          'Common',
  };
  const aliased = aliases[s.toLowerCase()];
  if (aliased) return RARITY_MAP[aliased];

  // Partial prefix match as last resort
  const partialKey = Object.keys(RARITY_MAP).find(k => k.toLowerCase().startsWith(s.toLowerCase()));
  if (partialKey) return RARITY_MAP[partialKey];

  return null;
}
