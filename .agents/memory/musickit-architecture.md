---
name: MusicKit Architecture
description: How Maplog's Apple Music integration works — data flow, types, playlist conventions, and playback engine.
---

# MusicKit Architecture

## Core principle
No backend, no database. Apple Music playlists are the database. The frontend reads playlists named "Maplog · <RarityName>", maps songs to rarity cards, and streams audio via MusicKit JS.

## Rarity convention
Playlist name format: `Maplog · Common`, `Maplog · Rare`, `Maplog · Shiny Rare`, etc.
Full map in `artifacts/maplog/src/lib/rarityMap.ts`.

## Key types (src/lib/types.ts)
- `MaplogSong` — id (MusicKit library ID e.g. "i.XXX"), title, artist, album, genre, durationMs, artworkUrl, cards[]
- `MaplogCard` — id, artworkUrl, rarityType (slug/name/category/tier), variantLabel
- These REPLACE the old `Song`/`CollectedCard` from `@workspace/api-client-react`

## Context structure
- `MusicKitContext` (src/context/MusicKitContext.tsx) — SDK init, auth, playlist loading, exposes songs[]
- `AudioPlayerContext` (src/context/AudioPlayerContext.tsx) — wraps MusicKit player, same external API as before

## Developer token
- Stored in `localStorage('maplog:developerToken')` or `VITE_MUSICKIT_TOKEN` env var
- If missing → Setup page shown (token entry with instructions)
- Token is a JWT (ES256), valid up to 6 months, NOT a secret (it's in the JS bundle)

## Playback engine
- `getMusicKit()` returns `window.MusicKit.getInstance()` (singleton)
- `play(song)` → `music.setQueue({ song: song.id })` + `music.play()`
- Time/state updates come from MusicKit events (`playbackTimeDidChange`, `playbackStateDidChange`)
- MusicKit PlaybackState.playing === 2, ended === 5

## Artwork URLs
Apple Music artwork URLs have `{w}` and `{h}` template vars — always replace before displaying:
`url.replace('{w}', '500').replace('{h}', '500')`

## Song IDs in URLs
Library song IDs are strings like "i.XXXXXXXX" — must be `encodeURIComponent()` in links and `decodeURIComponent()` in route params.

**Why:** `/song/:id` captures the raw path segment; special chars in MusicKit IDs break routing without encoding.

## What was NOT removed
The Express API server (`artifacts/api-server`) and PostgreSQL DB (`lib/db`) still exist but are no longer called from the frontend. They can be removed later if desired.
