---
name: Moments Architecture
description: How standalone Moment cards are modeled, stored, rendered, and valued
---

## Rule
Moments are MaplogSong entries with synthetic IDs (moment::timestamp::rand), NOT Apple Music tracks. They carry tags: ['moment'] and rarityType = MOMENT_RARITY (slug 'moment', tier 8).

**Why:** Needed standalone artist clips not tied to any playlist/song. Reusing MaplogSong avoids new context infrastructure; songs.filter by tags identifies them.

**How to apply:** When adding moment-specific logic, identify them via `card.tags?.includes('moment') || card.rarityType.slug === 'moment'`. Use `presenceForCard(card) === 'moment'` for rendering branches.

## Key facts
- addMoment() in MusicKitContext — throws on duplicate title (case-insensitive)
- cardId = songId + '::moment'; mediaStore key = cardId (same as all other media)
- MOMENT_RARITY defined in cardTemplates.ts, imported into MusicKitContext
- Value: 10k flat — cardValue checks slug === 'moment' BEFORE epic check
- Artist pages: automatic (moments have artist field, filter works)
- No music playback — onPlay = undefined passed from CardView for moments

## Mute logic (CardView)
- topCardEarly = song?.cards[0] resolved BEFORE moment state hooks (avoids use-before-declare bug)
- momentMuted defaults to isPlaying; re-syncs on displaySongId change
- Auto-mutes if isPlaying becomes true while unmuted
- Unmuting pauses active song (pausedByMomentRef tracks this); re-muting or navigation resumes it

## Rendering
- Art slot: MediaSlot with muted prop — React muted attr not reactive; driven via videoRef.current.muted
- Info section: full-width dark-red pill badge only (no title/artist/genre text)
- Border: card-moment-glow CSS (white breathing glow, 5s, white border-color override)
- MomentStars: already wired in SoundmapCard for presence === 'moment'
- Edit Mode: MomentsManager section (first) with add form + per-entry video upload
