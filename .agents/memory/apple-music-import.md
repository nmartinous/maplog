---
name: Apple Music Import
description: How playlist import works now (official API) and why scraping/paste flows were abandoned.
---

# Apple Music Import

## Current approach (Aug 2026)
Playlist import goes through the official Apple Music API using the developer token: the api-server's `/api/apple-music/playlist?url=` endpoint parses the `pl.…` id out of a music.apple.com link, fetches playlist metadata, and paginates tracks (100/page, capped at 1000), returning songs in the same normalized shape as `/apple-music/search` (including `releaseDate`). The client (Settings → Playlist Import) maps them to `id: 'apple:<catalogId>'` + `source: 'apple'` and bulk-adds with a chosen rarity, skipping songs already owned at that rarity (a mutable set is seeded from the collection and updated during the run so in-playlist duplicates can't double-add).

**Why:** scraping music.apple.com is a dead end (CSR SPA + token-gated API), and paste-lines flows were error-prone (search matching). Once a working developer token existed, the API path made both obsolete — the old `AppleMusicImport`/`BatchImport` paste forms were removed.

**How to apply:** any future Apple catalog features (albums, artist pages) should go through api-server proxy endpoints with the cached developer token, never scraping or client-side Apple API calls.

Single-song adds remain via the Collection page "+" (AddSongSheet: search → rarity → add).
