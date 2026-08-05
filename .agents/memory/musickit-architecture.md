---
name: MusicKit Architecture
description: Data layer, auth, and playback approach for Maplog (Apple Music + preview fallback)
---

## Current Architecture

**Data layer:** localStorage (`maplog:collection`) stores `MaplogSong[]` in the browser. Apple-sourced songs use prefixed IDs (`apple:<catalogId>`) + `source: 'apple'` to avoid collisions with legacy Deezer numeric IDs; legacy entries have no `source` field and keep working via previews.

**Catalog:** Apple Music. The api-server signs an ES256 developer token from the `.p8` MusicKit key (secrets: `APPLE_TEAM_ID`, `APPLE_MUSICKIT_KEY_ID`, `APPLE_MUSICKIT_PRIVATE_KEY`) and proxies catalog search + song lookup. Exposing the developer token to the client is Apple's intended design for MusicKit JS.

**Playback:** dual engine in `AudioPlayerContext` — MusicKit JS v3 full-song playback for `source==='apple'` when the user has authorized their Apple Music subscription; HTML5 `<audio>` 30s previews otherwise (and as error fallback). Routing effect keys on song id + a "MusicKit ready/auth" tick so playback upgrades when auth arrives; a monotonic request id guards rapid song-change races (never let stale `setQueue` flows call `play`).

**Auth:** `MusicKitContext` loads MusicKit JS dynamically (index.html untouched), configures with the server token, exposes real `hasToken`/`isReady`/`isAuthorized` + `authorize()`. Settings has a "Connect Apple Music" row. The search function is still named `searchDeezer` for interface compatibility but hits the Apple catalog.

## Hard-won lessons
- **Pasted .p8 keys get corrupted**: users retype or OCR keys → Cyrillic lookalike chars, lost newlines. The server's `normalizePrivateKey` rebuilds PEM and, if parsing still fails, recovers the raw P-256 scalar from the DER (`0201010420` marker) and rebuilds PKCS#8 via JWK — the scalar often survives even when OID/pubkey bytes are mangled. Verify a repaired key against Apple's live API (401 = bad token; 404/200 = auth OK).
- SSRF: the playlist-scrape endpoint must validate URL with strict `new URL()` parsing (https, exact `music.apple.com` host, no credentials) — `includes()` checks are bypassable.
- Deezer proxy routes still exist for legacy entries' card-back info (`/api/deezer/track/:id`); don't remove while legacy songs may exist in user collections.

## History
- Apple MusicKit (original plan, blocked on enrollment) → Deezer OAuth (registration closed) → Deezer public API + previews → **Apple Music (current, Aug 2026)** once the developer account activated.
