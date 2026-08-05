---
name: iOS PWA Shell Layout
description: How the Maplog app shell is structured for iOS PWA — pitfalls with h-dvh, safe areas, and in-flow vs fixed chrome.
---

# iOS PWA App Shell Layout

## The rule
`html, body, #root { height: 100dvh; overflow: hidden; }` — no padding on these elements.
The root app div uses `h-dvh overflow-hidden` and a flex column.
All scrolling happens inside individual page containers (`overflow-y-auto`).

**Why:** Adding `padding-top: env(safe-area-inset-top)` to html/body shrinks the content area, but `h-dvh` on the child still fills the *full* viewport. The child overflows by exactly `safe-area-inset-top` pixels, and `overflow: hidden` on the body clips the nav off the bottom of the screen.

## Chrome layout (in-flow, not position:fixed)
The mobile shell is a flex column:
```
<div class="h-dvh overflow-hidden flex flex-col">
  <DesktopSidebar />           ← hidden sm:flex, w-56, shrink-0
  <div class="flex-1 flex flex-col overflow-hidden">
    <main class="flex-1 overflow-hidden min-h-0">  ← pages fill h-full
    <MiniPlayer class="shrink-0 h-16">             ← in-flow
    <MobileNav class="shrink-0">                   ← in-flow, paddingBottom: env(safe-area-inset-bottom)
  </div>
</div>
```

**Why in-flow instead of position:fixed:** `position: fixed` on mobile Safari can drift during momentum scrolling if any ancestor has a transform, and causes layout ambiguity with calculated heights. In-flow flex is deterministic.

## Safe area handling
- **Bottom (home indicator):** `paddingBottom: env(safe-area-inset-bottom)` on `<MobileNav>` only.
- **Top (status bar):** NOT added to html/body. Dark app background shows behind status bar — acceptable. Per-page `pt-safe` can be added later.
- **Sides:** Not added (the app is full-width, no notch issues).

## Navigation component split
`Navigation.tsx` exports two named components:
- `DesktopSidebar` — renders as the first flex-row child in the shell (hidden on mobile)
- `MobileNav` — renders as the last flex-col child in the content column (hidden on desktop)

The old default `Navigation` export is kept as a deprecated alias.

## Card color flash fix
`useArtColor` (lib/useArtColor.ts) caches extracted colors in a module-level `artColorCache: Map<string, string>`.
`useState` initialises directly from the cache so re-visited cards render at their final color immediately.
`SoundmapCard.tsx` adds `transition: border-color 0.55s ease, box-shadow 0.55s ease, background-color 0.55s ease` so first-visit extraction is a smooth crossfade, not a snap.
