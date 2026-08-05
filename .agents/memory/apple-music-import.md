---
name: Apple Music import limitations
description: Why Apple Music playlists cannot be scraped and how Maplog imports them instead
---

# Apple Music playlist import

**Rule:** Do not attempt to scrape music.apple.com playlist pages server-side.

**Why:** Verified Aug 2026 — the Apple Music web player is a fully client-side SPA: the page HTML is an empty Vite shell with no embedded track JSON (no usable `serialized-server-data`). The embed player is the same, and `amp-api.music.apple.com` returns 401 without a signed developer JWT. Every scraping path is a dead end until the user's Apple developer enrollment clears.

**How to apply:** The working bridge is the "paste track lines" flow in Settings — user pastes "Artist — Title" lines (em-dash or hyphen), picks a rarity for the batch, and each track is resolved against Deezer for its 30s preview. An unused `/api/apple-music/playlist` route exists in api-server and can be repurposed for real MusicKit API calls once a developer token exists.
