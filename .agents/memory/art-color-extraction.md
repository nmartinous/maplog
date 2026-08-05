---
name: Art Color Extraction
description: Why card color extraction must use fetch+createImageBitmap, not a crossOrigin <img>.
---

# Card Art Color Extraction (useArtColor)

Rule: extract artwork colors with `fetch(url, { mode: 'cors' })` → `createImageBitmap` (with an `<img src=blobURL>` decode fallback for old Safari). Never use a `crossOrigin="anonymous"` `<img>` pointed at the CDN URL, and never cache extraction *failures*.

**Why:** Both mzstatic (Apple) and dzcdn (Deezer) send `Access-Control-Allow-Origin: *`, yet extraction still failed on iOS — Safari can serve a cached non-CORS copy of an artwork URL (loaded elsewhere as a plain `<img>`) to a crossOrigin `<img>`, tainting the canvas. That made every common card fall back to the rarity green (#166534), which the user reported as "the color picker isn't working". Caching the fallback on error then pinned green for the whole session.

**How to apply:** any future pixel-reading of remote images in this app must go through a CORS-mode fetch (its cache entry is separate from the `<img>` cache). Cache only successful extractions.
