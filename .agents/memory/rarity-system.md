---
name: Rarity System
description: Full rarity architecture — base tiers, modifiers, override types, and the four epic playlist types with their border/visual rules.
---

## Base tiers (via Apple Music playlists)
- **Common** (`regular-common`, tier 1)
- **Uncommon** (`regular-uncommon`, tier 2)
- **Rare** (`regular-rare`, tier 3)

## Modifiers (add on top of base, via tags)
- `shiny` → adds foil overlay + shiny badge; own playlist slugs: `shiny-common/uncommon/rare` (tier 4/5/6)
- `day1` → Day 1 stamp SVG
- `aprilfools` → 🤡 stamp

## Override types (replace base rarity entirely)
- **Epic** — presence='epic'; own playlist slugs; tier 7
- **Lyric** — presence='lyrics'; tier 9
- **Radiant** — presence='radiant'; drag-to-flip; tier 10
- **Moment** — presence='moment'; star field; tier 8

## Epic playlist types (the four standard epic playlists)
Imported via `LINKABLE_RARITY_TIERS`; routed by `epicBorderKind()` in `cardTemplates.ts`:

| Slug | Border | Background bleed | Notes |
|---|---|---|---|
| `epic-common` | Rotating green conic + wave glow (`epic-green-wrap`) | `#22c55e` override in CardView | Numbered cards |
| `epic-uncommon` | Rotating purple conic + wave glow (`epic-purple-wrap`) | `#a855f7` override in CardView | Numbered cards |
| `epic-rare` | Rotating rainbow (`epic-rainbow-wrap`) | Art color (no override) | Numbered cards |
| `epic-unnumbered` | None | Art color | No number badge |

**Key rule:** Only `epic-common/uncommon/rare` get colored rotating borders via `EpicBorderWrap`. `epic-unnumbered` and legacy slugs get no colored border.

**Border structure:** All three numbered types use a wrapper div with `overflow:hidden` + rotating `::before` conic-gradient. The spin animation also varies `filter: blur + brightness` at irregular keyframe intervals, creating a subtle audio-visualizer wave effect as color stops pass the card edges. Green and purple spin at 4.5s; rainbow at 3s.

**No epicNeonClass on the card itself** — border is entirely via the wrapper. The old box-shadow pulse approach was replaced.

## Tags for epic slugs (critical — must be in tagsFromRaritySlug)
- `epic-common` → `['epic', 'common']`
- `epic-uncommon` → `['epic', 'uncommon']`
- `epic-rare` → `['epic', 'rare']`
- `epic-unnumbered` → `['epic']`
- `epic` → `['epic']`
- `special-edition`, `special-epic`, `streak-epic` → `['epic', ...]`

**Without these entries, validation fires "Unrecognized rarity" on every new epic card — even a single copy.** This was the false-conflict bug.

## Special epics (future — will override border)
- `special-epic`, `streak-epic`, `pridemap`, `coachella`, `summersplash` — keep gold `epicFrameStyle` for now

## Epic card layout — content fills entire card
Epic cards suppress the info section (title/artist/badge/genre) entirely.
`showInfo = size !== 'sm' && !isEpic` — set in SoundmapCard.tsx.

## Media slot behavior
- Canvas epic (video uploaded via EpicImportWizard or EditMode) → `<video>` autoplay/muted/loop
- Still epic (no upload, has artworkUrl) → `ParallaxArt` (DeviceOrientation tilt-pan of zoomed art)
- No artwork either → Film icon hint

## Parallax — iOS permission
iOS 13+ requires `DeviceOrientationEvent.requestPermission()` before orientation events fire.
`ParallaxArt` detects this (`typeof DeviceOrientationEvent.requestPermission === 'function'`)
and shows a "Tap to enable tilt" overlay. Image has NO `crossOrigin` attribute (display only).

## Import wizard (EpicImportWizard.tsx)
Appears in RarityPlaylistSync after "Refresh all" when new epic cards are added.
Per-card flow:
1. (if epic-common/uncommon/rare) "Is this numbered?" → number input → saved as `variantLabel: '#N'`
2. "Canvas or parallax?" → canvas → video upload via `putCardMedia(cardId, file)`

`syncRarity` now returns `addedSongs: MaplogSong[]` in addition to `{ added, removed }`.
`updateCardMeta` patch type now includes `variantLabel`.

## Number badge
- `EpicPins` shows number when `card.variantLabel?.startsWith('#')`
- Numbered epics carry a variantLabel like `#2` set through the import wizard

## Why border is a wrapper (not box-shadow)
Conic-gradient borders require `overflow:hidden` + `::before` with scale + rotate — box-shadow can't do gradients. The inner card div sits at `z-index: 1` above the spinning pseudo-element.
