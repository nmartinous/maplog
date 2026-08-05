---
name: Framer Motion pitfalls in Maplog
description: AnimatePresence patterns that broke UI state visibility during the revamp
---

# Framer Motion pitfalls

**Rule:** Avoid `AnimatePresence mode="wait"` for state-driven swaps of always-visible chrome (MiniPlayer empty↔playing). Use `mode="popLayout"` with `initial={false}` and short explicit transitions instead.

**Why:** With `mode="wait"`, the new element cannot mount until the old element's exit animation completes. If exit stalls (rAF throttling, heavy main-thread work), the UI freezes showing stale state — e2e testing caught the MiniPlayer stuck on "Nothing playing" while a song was playing.

**How to apply:** Reserve `mode="wait"` for full-page route transitions where a brief gap is acceptable. For inline state swaps, prefer popLayout or plain crossfades that don't gate mounting on exit completion.

**Also:** design subagents may stub out components with `return null // omitted for brevity` when restyling large files — always grep the diff for `return null` / "omitted" after a design pass and restore functionality.

## CSS transitions fighting motion transforms
A Tailwind `transition-transform` class on an element framer-motion animates via `x`/`scale` causes visible stutter — CSS interpolates the same transform the library is driving. Remove the CSS transition and use `whileTap`/tween easing (`[0.32,0.72,0,1]`) instead. Springs with low damping on entrance (`scale: 0` → 1) also read as "grow then snap"; prefer short tweens for entrances.

## Testing note
Player/queue state is in-memory only — UI testers must navigate via the app's tab bar, never page.goto()/URL loads, or playback appears reset ("Nothing playing") and looks like a false regression.
