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
| `epic-common` | Pulsing neon green (`epic-neon-common` CSS class) | `#22c55e` override in CardView | Numbered cards |
| `epic-uncommon` | Pulsing neon purple (`epic-neon-uncommon` CSS class) | `#a855f7` override in CardView | Numbered cards |
| `epic-rare` | Rotating rainbow (`EpicBorderWrap` wrapper + `epic-rainbow-wrap` CSS) | Art color (no override) | Numbered cards |
| `epic-unnumbered` | None | Art color | No number badge |

**Key rule:** Only `epic-common/uncommon/rare` get colored borders. `epic-unnumbered` and all legacy epic slugs (`epic`, `special-edition`, `streak-epic`, etc.) get no colored border (unnumbered) or the old gold `epicFrameStyle` (legacy).

## Special epics (future — will override border)
- `special-epic`, `streak-epic`, `pridemap`, `coachella`, `summersplash` — keep gold `epicFrameStyle` for now
- Future: special epics override the numbered epic border colors

## Presence routing
`presenceForCard()` in `cardTemplates.ts`:
- Tags checked first: `epic | radiant | lyrics | moment | regular`
- Slug fallback: `slug.includes('epic') || slug === 'special-edition'` → 'epic'
- All four epic-* slugs contain 'epic' so they route correctly without tag

## Media slot behavior
- Canvas epic (video uploaded via EditMode) → `<video>` autoplay/muted/loop
- Still epic (no upload, has artworkUrl) → `ParallaxArt` (DeviceOrientation tilt-pan of zoomed art)
- No artwork either → Film icon hint

## Number badge
- `EpicPins` shows number when `card.variantLabel?.startsWith('#')`
- Numbered epics (common/uncommon/rare) carry a variantLabel like `#2`
- Future: custom badge design to replace current white pill; rarity/genre badge overlays also planned

## Why border is outside the card
The neon border uses `box-shadow` (common/uncommon) or a wrapper div with `overflow:hidden` + rotating `::before` conic-gradient (rare). Box-shadow is not clipped by the card's `overflow:hidden` so it radiates outward naturally. Rare needs the wrapper because box-shadow cannot do gradients.
