// ── Core domain types (replaces backend API types) ──────────────────────────

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
}

/**
 * A song in the Maplog collection, sourced from Apple Music playlists.
 * A song can have multiple cards if it appears in more than one Maplog playlist.
 */
export interface MaplogSong {
  /** MusicKit library song ID, e.g. "i.XXXXXXXX" */
  id: string;
  title: string;
  artist: string;
  album: string;
  genre?: string;
  durationMs: number;
  /** Resolved artwork URL (no {w}/{h} template vars) */
  artworkUrl: string;
  /** One card per Maplog playlist this song appears in, sorted tier desc */
  cards: MaplogCard[];
}
