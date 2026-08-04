---
name: MusicKit Architecture
description: Data layer, auth, and playback approach for Maplog
---

## Current Architecture (self-contained, no streaming service account required)

**Data layer:** localStorage (`maplog:collection` key) stores `MaplogSong[]` directly in the browser. No external service login needed.

**Track search:** Deezer's public API (no auth, no App ID) via a thin CORS proxy at `/api/deezer/search?q=...` on the api-server. The proxy lives in `artifacts/api-server/src/routes/deezer.ts`.

**Audio playback:** 30-second preview MP3s from `track.preview` on Deezer search results, played via HTML5 `<audio>` in `AudioPlayerContext`.

**Why:** Deezer requires new app registrations (closed periods), and Spotify was rejected by the user. The public Deezer API requires no registration and returns preview URLs freely. CORS blocked direct browser calls, so the proxy is the only required server-side piece.

**How to apply:**
- `MusicKitContext` exports `addToCollection(song, rarity)`, `removeFromCollection(songId)`, `searchDeezer(query)` — all self-contained.
- `hasToken`, `isReady`, `isAuthorized` are always `true` — no setup screen shown.
- Demo mode still works via `isDemoMode` / `enterDemoMode` / `exitDemoMode`.

## History (for reference)
- Originally: Apple Music / MusicKit JS (requires Apple Developer enrollment — still pending)
- Then: Deezer SDK with OAuth (App ID required, registration closed)
- Now: Deezer public API + localStorage (no account of any kind)
