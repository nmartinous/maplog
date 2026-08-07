---
name: Epic wave glow & parallax pan
description: How the orbiting epic border glow and parallax tilt pan must be implemented (iOS PWA rendering pitfalls)
---

**Rule:** The waving epic halo must use the EXISTING `::before` conic-gradient on the wrap class (`epic-green-wrap` etc) — un-pause its spin animation and add `filter: blur(8px)` to it. Remove `overflow: hidden` from the wrap (already on the inner). Never use a separate div positioned behind the card with `filter: blur()` — a blurred div always has a rectangular bounding box visible through the blur on iOS, regardless of border-radius or inset.
**Why:** Three attempts with a separate glow div all produced a rectangular box. The ::before is already a scale(2.5) conic gradient that bleeds outside the card when the wrap has no overflow:hidden — the blur is on the pseudo-element itself, so no external bounding box.
**How to apply:** In index.css, the three wrap `::before` rules get `animation: epic-spin-<kind> Xs linear infinite` and `filter: blur(8px)`. The wrap classes drop `overflow: hidden`. The inner classes keep `overflow: hidden`. No extra JSX wrapper needed in EpicBorderWrap.

**Rule:** ParallaxArt tilt pan must be compositor-only: use `scale(1.3) translate3d(x%, 0, 0)` written imperatively to `imgRef.style.transform` (no React state, no CSS transition). Keep the img as `absolute inset-0 w-full h-full object-cover`.
**Why:** (1) Panning via `object-position` (state or ref, with or without CSS transition) repaints the card layer every deviceorientation event → the overlay text visibly shakes on iOS. (2) Using `width: 150%; left: -25%` for the oversized approach caused a visible gap on the right side. scale(1.3) on a normally-fitted image fills the container with no gap and stays within the overflow margin.
