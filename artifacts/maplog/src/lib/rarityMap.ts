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

/** All rarity category names for filter chips */
export const ALL_CATEGORIES = [
  'All', 'Regular', 'Shiny', 'Epic',
  'Special Edition', 'Special Epic', 'Streak Epic',
  'Lyric', 'Radiant', 'Moment',
] as const;
