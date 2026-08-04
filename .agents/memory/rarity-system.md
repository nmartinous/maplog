---
name: Soundmap Rarity System
description: How Soundmap card rarities compose — base, modifier, and override tiers
---

# Soundmap Rarity Composition

Cards have a **base rarity** that can be modified or overridden:

## Base rarities
- Common
- Uncommon
- Rare

## Modifiers — *add to* the base (both shown / combined)
- Shiny (adds sparkle/rainbow animation)
- Day 1 (adds stamp on art)
- April Fools (adds stamp on art)

## Overrides — *replace* the base entirely
- Epic
- Lyric
- Radiant

**Why:** This distinction matters when displaying card details, filtering, or deriving badge logic. A "Shiny Rare" keeps the Rare visual identity (orange glow) plus the shiny rainbow border. An "Epic" card ignores its underlying base entirely.

**How to apply:** When reading `card.rarityType.slug`, check if it's an override first (epic/lyric/radiant), then check for modifier prefix (shiny-), then treat the remainder as the base (common/uncommon/rare).
