---
name: Framer Motion pitfalls in Maplog
description: AnimatePresence patterns that broke UI state visibility during the revamp
---

# Framer Motion pitfalls

**Rule:** Avoid `AnimatePresence mode="wait"` for state-driven swaps of always-visible chrome (MiniPlayer empty↔playing). Use `mode="popLayout"` with `initial={false}` and short explicit transitions instead.

**Why:** With `mode="wait"`, the new element cannot mount until the old element's exit animation completes. If exit stalls (rAF throttling, heavy main-thread work), the UI freezes showing stale state — e2e testing caught the MiniPlayer stuck on "Nothing playing" while a song was playing.

**How to apply:** Reserve `mode="wait"` for full-page route transitions where a brief gap is acceptable. For inline state swaps, prefer popLayout or plain crossfades that don't gate mounting on exit completion.

**Also:** design subagents may stub out components with `return null // omitted for brevity` when restyling large files — always grep the diff for `return null` / "omitted" after a design pass and restore functionality.
