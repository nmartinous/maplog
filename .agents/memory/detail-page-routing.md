---
name: Maplog detail-page routing
description: Two card detail pages exist; know which one users actually reach before adding gestures
---
Maplog has TWO full-screen card pages: `/song/:id` (SongDetail — embla multi-card, flip via Info button, queue/menu) and `/card/:id` (CardView — measured-scale hero card, horizontal collection swipe + vertical filtered swipe).

**Why:** A whole filtered-swipe feature was built into CardView, but nothing in the app links to `/card/` — Collection, Artist, PlaylistDetail, MiniPlayer, Showcase all navigate to `/song/`. The user reported the feature "not working" for days; the real bug was the entry point.

**How to apply:** Before adding/altering gestures or navigation on a card detail page, grep for which route the entry points actually use. Gesture features must land in SongDetail (or the routes must be unified). Filter state is shared via sessionStorage helpers in `lib/collectionFilter.ts`.
