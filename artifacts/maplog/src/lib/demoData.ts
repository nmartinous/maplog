import type { MaplogSong } from './types';

// Artwork: picsum with seeded slugs so images are stable across reloads
const art = (seed: string) => `https://picsum.photos/seed/maplog-${seed}/500/500`;

const COMMON:   object = { slug: 'regular-common',   name: 'Common',   category: 'Regular', tier: 1 };
const UNCOMMON: object = { slug: 'regular-uncommon', name: 'Uncommon', category: 'Regular', tier: 2 };
const RARE:     object = { slug: 'regular-rare',     name: 'Rare',     category: 'Regular', tier: 3 };
const SHINY_RARE: object = { slug: 'shiny-rare',     name: 'Shiny Rare', category: 'Shiny', tier: 6 };

export const DEMO_SONGS: MaplogSong[] = [
  {
    id: 'demo-1',
    title: 'Signal Echo',
    artist: 'Meridian Blue',
    album: 'Ultraviolet Transit',
    genre: 'Electronic',
    durationMs: 222000,
    artworkUrl: art('signal'),
    cards: [
      { id: 'demo-1::common', artworkUrl: art('signal'), rarityType: COMMON as any, variantLabel: null },
    ],
  },
  {
    id: 'demo-2',
    title: 'Glass Hours',
    artist: 'The Pale Coast',
    album: 'Tidal Memory',
    genre: 'Indie Rock',
    durationMs: 255000,
    artworkUrl: art('glass'),
    cards: [
      { id: 'demo-2::uncommon', artworkUrl: art('glass'), rarityType: UNCOMMON as any, variantLabel: null },
      { id: 'demo-2::common',   artworkUrl: art('glass'), rarityType: COMMON   as any, variantLabel: null },
    ],
  },
  {
    id: 'demo-3',
    title: 'Cassette Dreams',
    artist: 'Nightform',
    album: 'Low Fidelity Night',
    genre: 'Lo-fi',
    durationMs: 178000,
    artworkUrl: art('cassette'),
    cards: [
      { id: 'demo-3::rare', artworkUrl: art('cassette'), rarityType: RARE as any, variantLabel: null },
    ],
  },
  {
    id: 'demo-4',
    title: 'Orbit Lane',
    artist: 'Solar Twin',
    album: 'Second Sun EP',
    genre: 'Dream Pop',
    durationMs: 301000,
    artworkUrl: art('orbit'),
    cards: [
      { id: 'demo-4::common', artworkUrl: art('orbit'), rarityType: COMMON as any, variantLabel: null },
    ],
  },
  {
    id: 'demo-5',
    title: 'Flicker',
    artist: 'Sable Season',
    album: 'Autumn Circuit',
    genre: 'Folk',
    durationMs: 213000,
    artworkUrl: art('flicker'),
    cards: [
      { id: 'demo-5::rare',     artworkUrl: art('flicker'), rarityType: RARE     as any, variantLabel: null },
      { id: 'demo-5::uncommon', artworkUrl: art('flicker'), rarityType: UNCOMMON as any, variantLabel: 'Day 1' },
    ],
  },
  {
    id: 'demo-6',
    title: 'Golden Static',
    artist: 'The Parallax',
    album: 'Interference Patterns',
    genre: 'Art Pop',
    durationMs: 284000,
    artworkUrl: art('golden'),
    cards: [
      { id: 'demo-6::rare',       artworkUrl: art('golden'), rarityType: RARE as any, variantLabel: null },
      { id: 'demo-6::shiny-rare', artworkUrl: art('golden'), rarityType: SHINY_RARE as any, variantLabel: null },
    ],
  },
  {
    id: 'demo-7',
    title: 'Vanta',
    artist: 'Resonance Field',
    album: 'Null Space',
    genre: 'Ambient',
    durationMs: 372000,
    artworkUrl: art('vanta'),
    cards: [
      { id: 'demo-7::common', artworkUrl: art('vanta'), rarityType: COMMON as any, variantLabel: null },
    ],
  },
  {
    id: 'demo-8',
    title: 'Threshold',
    artist: 'Morning Fault',
    album: 'The Collapse Suite',
    genre: 'Post-Rock',
    durationMs: 329000,
    artworkUrl: art('threshold'),
    cards: [
      { id: 'demo-8::rare',     artworkUrl: art('threshold'), rarityType: RARE     as any, variantLabel: null },
      { id: 'demo-8::uncommon', artworkUrl: art('threshold'), rarityType: UNCOMMON as any, variantLabel: null },
    ],
  },
  {
    id: 'demo-9',
    title: 'Last Broadcast',
    artist: 'The Cartographers',
    album: 'Uncharted Frequencies',
    genre: 'Cinematic',
    durationMs: 247000,
    artworkUrl: art('broadcast'),
    cards: [
      { id: 'demo-9::uncommon', artworkUrl: art('broadcast'), rarityType: UNCOMMON as any, variantLabel: null },
    ],
  },
  {
    id: 'demo-10',
    title: 'Infinite Room',
    artist: 'Echo Vessel',
    album: 'Aperture',
    genre: 'Electronic',
    durationMs: 453000,
    artworkUrl: art('infinite'),
    cards: [
      { id: 'demo-10::rare', artworkUrl: art('infinite'), rarityType: RARE as any, variantLabel: null },
    ],
  },
];
