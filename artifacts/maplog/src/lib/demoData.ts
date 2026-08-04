import type { MaplogSong } from './types';

// Artwork: picsum with seeded slugs so images are stable across reloads
const art = (seed: string) => `https://picsum.photos/seed/maplog-${seed}/500/500`;

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
      {
        id: 'demo-1::regular-common',
        artworkUrl: art('signal'),
        rarityType: { slug: 'regular-common', name: 'Common', category: 'Regular', tier: 1 },
        variantLabel: null,
      },
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
      {
        id: 'demo-2::regular-uncommon',
        artworkUrl: art('glass'),
        rarityType: { slug: 'regular-uncommon', name: 'Uncommon', category: 'Regular', tier: 2 },
        variantLabel: null,
      },
      {
        id: 'demo-2::regular-common',
        artworkUrl: art('glass'),
        rarityType: { slug: 'regular-common', name: 'Common', category: 'Regular', tier: 1 },
        variantLabel: null,
      },
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
      {
        id: 'demo-3::regular-rare',
        artworkUrl: art('cassette'),
        rarityType: { slug: 'regular-rare', name: 'Rare', category: 'Regular', tier: 3 },
        variantLabel: null,
      },
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
      {
        id: 'demo-4::shiny-common',
        artworkUrl: art('orbit'),
        rarityType: { slug: 'shiny-common', name: 'Shiny Common', category: 'Shiny', tier: 4 },
        variantLabel: null,
      },
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
      {
        id: 'demo-5::shiny-rare',
        artworkUrl: art('flicker'),
        rarityType: { slug: 'shiny-rare', name: 'Shiny Rare', category: 'Shiny', tier: 6 },
        variantLabel: null,
      },
      {
        id: 'demo-5::regular-uncommon',
        artworkUrl: art('flicker'),
        rarityType: { slug: 'regular-uncommon', name: 'Uncommon', category: 'Regular', tier: 2 },
        variantLabel: 'Day 1',
      },
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
      {
        id: 'demo-6::epic',
        artworkUrl: art('golden'),
        rarityType: { slug: 'epic', name: 'Epic', category: 'Epic', tier: 7 },
        variantLabel: null,
      },
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
      {
        id: 'demo-7::special-edition',
        artworkUrl: art('vanta'),
        rarityType: { slug: 'special-edition', name: 'Special Edition', category: 'Special Edition', tier: 7 },
        variantLabel: null,
      },
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
      {
        id: 'demo-8::streak-epic',
        artworkUrl: art('threshold'),
        rarityType: { slug: 'streak-epic', name: 'Streak Epic', category: 'Streak Epic', tier: 8 },
        variantLabel: null,
      },
      {
        id: 'demo-8::shiny-uncommon',
        artworkUrl: art('threshold'),
        rarityType: { slug: 'shiny-uncommon', name: 'Shiny Uncommon', category: 'Shiny', tier: 5 },
        variantLabel: null,
      },
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
      {
        id: 'demo-9::lyric',
        artworkUrl: art('broadcast'),
        rarityType: { slug: 'lyric', name: 'Lyric', category: 'Lyric', tier: 9 },
        variantLabel: null,
      },
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
      {
        id: 'demo-10::radiant',
        artworkUrl: art('infinite'),
        rarityType: { slug: 'radiant', name: 'Radiant', category: 'Radiant', tier: 10 },
        variantLabel: null,
      },
    ],
  },
];
