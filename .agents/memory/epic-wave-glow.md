---
name: Epic wave glow & parallax pan
description: How the orbiting epic border glow and parallax tilt pan must be implemented (iOS PWA rendering pitfalls)
---

**Rule:** The orbiting epic halo must be a blurred *masked conic ring* (padding-box XOR mask on `::before`, blur on the parent, animated `@property --epic-wave` angle) — never a blurred filled rectangle behind the card.
**Why:** A blurred filled rect (any inset, any radius) shows straight box edges through the blur on iOS — user rejected two variants before the ring approach.
**How to apply:** `.epic-wave-glow` in index.css + outer shell in `EpicBorderWrap`. Animation lives on `::before` (`--epic-wave` has `inherits:false`, so animating the parent doesn't reach the pseudo).

**Rule:** ParallaxArt tilt pan must be compositor-only: oversized img (150% width, left -25%, `will-change: transform`) moved with `translate3d(%)` written imperatively to the ref.
**Why:** Panning via `object-position` (state- or ref-driven, with or without CSS transition) repaints the card layer every deviceorientation event → the overlay text visibly shakes on iOS.
