---
name: iOS PWA fetch caching
description: Same-URL API GETs are cached by iOS Safari PWA — data refresh endpoints need no-store on both ends
---

**Rule:** Any client `fetch()` GET whose response must be fresh (playlist refresh, sync, polling) needs `{ cache: 'no-store' }` on the client AND `Cache-Control: no-store` on the server response.

**Why:** iOS Safari (especially installed PWAs) serves cached responses for repeated same-URL GETs. Maplog's "refresh linked playlists" silently returned a stale playlist snapshot, so newly added Apple Music songs never imported — no error, just stale data.

**How to apply:** When a "refresh"/"sync" feature seems to do nothing on iOS while working in dev, suspect HTTP caching before logic bugs. Also never silently truncate paginated fetches (partial snapshots caused card removals); throw on a failed page instead.

Related: window-level gesture tracking — raw pointer events on iOS get cancelled by scroll heuristics; use Framer Motion pan (`onPanStart`/`onPanEnd`), the same approach RadiantSpin uses.
