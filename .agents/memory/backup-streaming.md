---
name: Backup streaming
description: Memory-bounded zip export/import rules for Maplog backups (iOS Safari)
---

Backups must never hold media as raw JS buffers: stream with fflate `Zip`/`Unzip`, read input Blobs in ~4 MiB slices, and fold accumulated chunks into Blobs (off-heap) every ~16 MiB. Pure helpers live in `backupStream.ts` and are node-tested via `scripts/test-backup-stream.mjs` (esbuild-bundled, resolved through vite's deps).

**Why:** zipSync/unzipSync froze/crashed iOS Safari on video-heavy backups; a code review also required zip-bomb defenses.

**How to apply:**
- Import must cap decompressed bytes and entry count (zip bomb guard), and reject truncated/zero-entry archives instead of hanging.
- Size checks belong BEFORE the expensive step: check `file.size` before reading, estimate export size from blob sizes before building.
- Classic zip caps out near 4 GiB — refuse larger with a readable error.
- Gotcha: when a callback-driven promise (`fail()` inside fflate ondata) can reject while the feeder loop is still awaiting chunk reads, attach `done.catch(() => {})` immediately or Node/browser reports an unhandled rejection.
