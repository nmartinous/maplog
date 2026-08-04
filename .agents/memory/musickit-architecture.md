---
name: Streaming Architecture
description: How Maplog connects to a streaming service — currently Deezer. Covers data flow, types, playlist conventions, and the audio player.
---

# Streaming Architecture (Deezer)

## Core principle
No backend, no database. Deezer playlists are the database. The frontend reads playlists named "Maplog · <RarityName>", maps songs to rarity cards, and streams 30-second previews via HTML5 Audio.

## Rarity convention
Playlist name format: `Maplog · Common`, `Maplog · Rare`, `Maplog · Shiny Rare`, etc.
Full map in `artifacts/maplog/src/lib/rarityMap.ts`.

## Key types (src/lib/types.ts)
- `MaplogSong` — id (Deezer track ID as string), title, artist, album, genre, durationMs, artworkUrl, previewUrl (30s MP3), cards[]
- `MaplogCard` — id, artworkUrl, rarityType (slug/name/category/tier), variantLabel

## Context structure
- `MusicKitContext` (src/context/MusicKitContext.tsx) — Deezer implementation behind the same exported names (`MusicKitProvider`, `useMusicKit`)
  - Stores App ID in `localStorage('maplog:deezerAppId')` or `VITE_DEEZER_APP_ID` env var
  - Init: `DZ.init({ appId, channelUrl })` where channelUrl = `${origin}${BASE_URL}channel.html`
  - Auth: `DZ.login()` popup, `DZ.getLoginStatus()` on startup for session persistence
  - API: promisified `DZ.api()` via JSONP — no CORS issues
- `AudioPlayerContext` (src/context/AudioPlayerContext.tsx) — HTML5 Audio with `song.previewUrl`

## Deezer SDK setup requirements
- `public/channel.html` must exist on the same domain (served by Vite from `public/`)
- `<div id="dz-root" style="display:none">` must be in index.html (SDK looks for it)
- SDK loads synchronously from `https://e-cdns-files.dzcdn.net/js/min/dz.js` (no async attr)

## Deezer app registration (user must do this once)
1. developers.deezer.com/myapps → Create Application
2. Set Application domain + Redirect URL to the app's URL
3. Copy App ID (a plain number) → paste into Maplog Setup screen

## Audio playback
- Uses `track.preview` URL from Deezer API — a public 30-second MP3 CDN URL
- Played via `new Audio()` in AudioPlayerContext; no DZ.player widget needed
- Demo mode uses setInterval timer instead (no real audio)

## Session persistence
`DZ.getLoginStatus()` on SDK init checks for existing Deezer session (cookie-based).
If `status === 'connected'`, user is already auth'd and songs load automatically.

## Migrated from Apple Music
Previous architecture used MusicKit JS v3 + JWT developer token. Switched to Deezer because:
- No paid developer enrollment required
- Same-day free App ID
- Same playlist-as-database pattern works identically

**Why same exported names (`useMusicKit`, `MusicKitProvider`):** All consumers (Collection, SongDetail, App) required zero changes.
