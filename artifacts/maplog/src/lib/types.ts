// ── Core domain types ────────────────────────────────────────────────────────

export interface MaplogRarityType {
  slug: string;
  name: string;
  category: string;
  tier: number;
}

/**
 * A single Soundmap card — one rarity tier of a song.
 * Shape is compatible with what SoundmapCard and RarityBadge expect.
 */
export interface MaplogCard {
  id: string;
  artworkUrl: string | null;
  rarityType: MaplogRarityType;
  variantLabel?: string | null;
  /**
   * Internal tag pool (canonical lowercase, no '#'), e.g.
   * ['regular','shiny','rare']. Drives filtering, valuation, and rendering.
   * Optional for backwards compatibility — migrated on load from rarityType.
   */
  tags?: string[];
  /** Uploader flavor text (moments, lyrics) — shown as a quote bubble */
  flavorText?: string | null;
  /** Subject text (lyrics: the lyric line; epics: clip subject) */
  subjectText?: string | null;
  /** Emoji/short-text pin shown bottom-left on epics */
  pin?: string | null;
  /** Radiant pattern template id (see lib/cardTemplates.ts) */
  patternId?: string | null;
}

/**
 * A song in the Maplog collection, sourced from Deezer playlists.
 * A song can have multiple cards if it appears in more than one Maplog playlist.
 */
export interface MaplogSong {
  /** Track ID as a string — Apple Music catalog ID ('apple') or Deezer ID (legacy) */
  id: string;
  /** Which catalog the ID belongs to. Absent = legacy Deezer entry. */
  source?: 'apple' | 'deezer';
  title: string;
  artist: string;
  album: string;
  genre?: string | null;
  durationMs: number;
  /** Full-size album artwork URL */
  artworkUrl: string;
  /** 30-second Deezer preview MP3 URL (null when unavailable) */
  previewUrl?: string | null;
  /** One card per Maplog playlist this song appears in, sorted tier desc */
  cards: MaplogCard[];
}
