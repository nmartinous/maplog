/**
 * CardView — full-screen card-view route (/card/:id)
 *
 * Layout mirrors the approved zone constants from the Canvas mockup:
 *   • Top bar   — page-top (status-bar-safe) + nav controls
 *   • Card zone — flex-1, fills whatever remains after actual chrome heights
 *   • Bottom    — MiniPlayer + MobileNav live in AppShell; not rendered here
 *
 * The slot respects DEFAULT_SLOT_W_RATIO = 0.75 and CARD_ASPECT = 3/4.5.
 * The card never clips the zone: we measure the rendered card dimensions
 * (natural hero size, SoundmapCard info section is fixed-height, not
 * proportional to width) and apply transform:scale() to make it fit.
 * No overflow:hidden is used to clip content.
 *
 * Swipe navigation: swipe left/right (or tap arrow buttons) moves to the
 * adjacent song in the collection. URL updates to /card/:id.
 */

import React, {
  useRef, useState, useLayoutEffect, useEffect, useMemo, useCallback,
} from 'react';
import { useParams, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Disc3 } from 'lucide-react';

import { useMusicKit } from '@/context/MusicKitContext';
import { usePlayer } from '@/context/AudioPlayerContext';
import { useArtColor } from '@/lib/useArtColor';
import { SoundmapCard } from '@/components/SoundmapCard';
import { Button } from '@/components/ui/button';
import { presenceForCard, epicBorderKind } from '@/lib/cardTemplates';

// ── Zone constants (from mockup-sandbox/src/components/mockups/zoneConstants.ts) ─
/** Card slot is 75 % of viewport width at most. */
const DEFAULT_SLOT_W_RATIO = 0.75;
/** Minimum horizontal pan distance (px) to count as a swipe. */
const SWIPE_THRESHOLD = 40;

// ── Rarity fallback border colours (mirrors SoundmapCard) ────────────────────
function rarityColor(slug: string): string {
  const map: Record<string, string> = {
    'regular-common':   '#166534',
    'regular-uncommon': '#7e22ce',
    'regular-rare':     '#c2410c',
    'shiny-common':     '#4ade80',
    'shiny-uncommon':   '#d946ef',
    'shiny-rare':       '#f97316',
    'epic':             '#b48400',
    'epic-numbered':    '#b48400',
    'epic-common':      '#22c55e',
    'epic-uncommon':    '#a855f7',
    'epic-rare':        '#f59e0b',
    'epic-unnumbered':  '#444444',
    'special-edition':  '#be185d',
    'special-epic':     '#e11d48',
    'streak-epic':      '#ea580c',
    'radiant':          '#7c3aed',
    'lyric':            '#92400e',
    'moment':           '#991b1b',
  };
  return map[slug] ?? '#444444';
}

// ── useMeasuredScale ──────────────────────────────────────────────────────────
/**
 * Returns refs for the card zone and the card element, plus the CSS scale
 * factor that shrinks the card to fit the zone (≤ 1).
 */
function useMeasuredScale(slotWRatio: number, songId: string | undefined) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const [card, setCard] = useState<{ w: number; h: number } | null>(null);
  const [zone, setZone] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    setCard({ w: el.offsetWidth, h: el.offsetHeight });
  }, [songId]);

  useLayoutEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    setZone({ w: el.clientWidth, h: el.clientHeight });
  }, []);

  useEffect(() => {
    const observers: ResizeObserver[] = [];

    const cardEl = cardRef.current;
    if (cardEl) {
      const obs = new ResizeObserver(() => {
        setCard({ w: cardEl.offsetWidth, h: cardEl.offsetHeight });
      });
      obs.observe(cardEl);
      observers.push(obs);
    }

    const zoneEl = zoneRef.current;
    if (zoneEl) {
      const obs = new ResizeObserver(() => {
        setZone({ w: zoneEl.clientWidth, h: zoneEl.clientHeight });
      });
      obs.observe(zoneEl);
      observers.push(obs);
    }

    return () => observers.forEach(o => o.disconnect());
  }, []);

  const scale = useMemo(() => {
    if (!card || !zone || card.h === 0 || card.w === 0) return 1;
    const margin = 16;
    const maxW = zone.w * slotWRatio - margin;
    const maxH = zone.h - margin;
    return Math.min(1, maxW / card.w, maxH / card.h);
  }, [card, zone, slotWRatio]);

  return { zoneRef, cardRef, scale, card };
}

// ── Slide animation variants ──────────────────────────────────────────────────
/**
 * direction: 1 = navigating forward (next), -1 = navigating back (prev).
 * The card enters from the leading edge and the old card exits to the opposite.
 */
// Horizontal swipes (|dir|=1) slide left/right.
// Vertical filtered swipes (|dir|=2) slide up/down so direction feels natural.
const slideVariants = {
  enter: (dir: number) => {
    const vert = Math.abs(dir) >= 2;
    return vert
      ? { y: dir > 0 ? '60%' : '-60%', x: 0, opacity: 0, scale: 0.88 }
      : { x: dir > 0 ? '60%' : '-60%', y: 0, opacity: 0, scale: 0.88 };
  },
  center: { x: 0, y: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => {
    const vert = Math.abs(dir) >= 2;
    return vert
      ? { y: dir > 0 ? '-60%' : '60%', x: 0, opacity: 0, scale: 0.88 }
      : { x: dir > 0 ? '-60%' : '60%', y: 0, opacity: 0, scale: 0.88 };
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CardView() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { getSong, songs } = useMusicKit();
  const { play, resume, currentSong, isPlaying } = usePlayer();

  const songId = decodeURIComponent(id ?? '');

  // TikTok-style: displaySongId is what's actually shown. It starts at the
  // URL entry song, and filter-swiping updates it locally without touching
  // the URL (avoids routing overhead and the stale-filter race condition).
  const [displaySongId, setDisplaySongId] = useState(songId);

  // Keep displaySongId in sync when the URL changes (browser back, horizontal
  // swipe calling setLocation, or any external navigation).
  useEffect(() => { setDisplaySongId(songId); }, [songId]);

  const song = getSong(displaySongId) ?? (currentSong?.id === displaySongId ? currentSong : undefined);

  // ── Collection navigation ────────────────────────────────────────────────────
  const collectionIndex = useMemo(
    () => songs.findIndex(s => s.id === displaySongId),
    [songs, displaySongId],
  );
  const hasPrev = collectionIndex > 0;
  const hasNext = collectionIndex >= 0 && collectionIndex < songs.length - 1;

  // ── Filter-aware navigation ────────────────────────────────────────────────
  // Read the active collection filter once on mount (sessionStorage written by
  // Collection.tsx). Vertical swipes outside the card navigate within this list.
  const [cvFilter] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('maplog:collection:filter') ?? 'null')
        ?? { search: '', scope: 'all', activeRarity: 'All' };
    } catch { return { search: '', scope: 'all', activeRarity: 'All' }; }
  });

  const filteredSongs = useMemo(() => {
    const { search, scope, activeRarity } = cvFilter;
    if (!search && activeRarity === 'All') return songs;
    const q = search.toLowerCase();
    return songs.filter(s => {
      if (q) {
        const inTitle  = s.title.toLowerCase().includes(q);
        const inArtist = s.artist.toLowerCase().includes(q);
        const inAlbum  = (s.album ?? '').toLowerCase().includes(q);
        const match = scope === 'song'   ? inTitle
                    : scope === 'artist' ? inArtist
                    : scope === 'album'  ? inAlbum
                    : inTitle || inArtist || inAlbum;
        if (!match) return false;
      }
      if (activeRarity !== 'All' && !s.cards.some(c => c.rarityType.category === activeRarity)) return false;
      return true;
    });
  }, [songs, cvFilter]);

  const hasFilterActive = cvFilter.search !== '' || cvFilter.activeRarity !== 'All';
  const filteredIndex = useMemo(
    () => filteredSongs.findIndex(s => s.id === displaySongId),
    [filteredSongs, displaySongId],
  );

  // Track the slide direction so AnimatePresence knows which way to animate.
  const [direction, setDirection] = useState(0);

  const goTo = useCallback((delta: number) => {
    const nextIndex = collectionIndex + delta;
    if (nextIndex < 0 || nextIndex >= songs.length) return;
    const nextSong = songs[nextIndex];
    setDirection(delta);
    setDisplaySongId(nextSong.id);          // immediate visual update
    setLocation(`/card/${encodeURIComponent(nextSong.id)}`); // sync URL
  }, [collectionIndex, songs, setLocation]);

  /**
   * TikTok-style: navigate within the active filter by updating local state
   * only — no URL change, no routing overhead. AnimatePresence animates
   * the card swap via key change on displaySongId.
   */
  const goToFiltered = useCallback((delta: number) => {
    const currentIdx = filteredSongs.findIndex(s => s.id === displaySongId);
    const nextIdx = currentIdx + delta;
    if (nextIdx < 0 || nextIdx >= filteredSongs.length) return;
    setDirection(delta > 0 ? 2 : -2);
    setDisplaySongId(filteredSongs[nextIdx].id);
  }, [filteredSongs, displaySongId]);

  // ── Swipe gesture via Framer Motion pan ─────────────────────────────────────
  // Framer's pan gesture tracks at window level (same approach as RadiantSpin),
  // which is robust on iOS where raw pointer events get cancelled by the
  // browser's scroll/gesture heuristics — the root cause of swipes not firing.
  /** Stable ref to the scaled card element (kept for layout measurements). */
  const cardElRef = useRef<HTMLDivElement | null>(null);
  /**
   * Set to true when a qualifying swipe is detected in onPanEnd.
   * onZoneClickCapture (capture-phase) reads this and stops the click event
   * from reaching any child (e.g. the card tap handler) before resetting it.
   */
  const swipedRef = useRef(false);
  /** True while the current pan started inside a RadiantSpin surface —
   *  those pans belong to the card's drag-to-spin and must not navigate. */
  const ignorePanRef = useRef(false);

  const onZonePanStart = useCallback((e: PointerEvent | MouseEvent | TouchEvent) => {
    swipedRef.current = false;
    const target = e.target as HTMLElement | null;
    ignorePanRef.current = !!target?.closest?.('[data-radiant-spin]');
  }, []);

  const onZonePanEnd = useCallback((_: unknown, info: { offset: { x: number; y: number } }) => {
    if (ignorePanRef.current) { ignorePanRef.current = false; return; }
    const dx = info.offset.x;
    const dy = info.offset.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Predominantly horizontal swipe → prev/next in the full collection
    if (absDx >= SWIPE_THRESHOLD && absDy <= absDx * 0.8) {
      swipedRef.current = true;
      goTo(dx < 0 ? 1 : -1);
      return;
    }

    // Predominantly vertical swipe → prev/next in the active filter.
    if (hasFilterActive && absDy >= SWIPE_THRESHOLD && absDx <= absDy * 0.8) {
      swipedRef.current = true;
      goToFiltered(dy < 0 ? 1 : -1); // swipe up = forward in filter
    }
  }, [goTo, goToFiltered, hasFilterActive]);

  /**
   * Capture-phase click handler on the swipe zone.
   * Fires before any child onClick; stops propagation when a swipe was
   * just recognised so the card's tap handler is never invoked.
   */
  const onZoneClickCapture = useCallback((e: React.MouseEvent) => {
    if (swipedRef.current) {
      swipedRef.current = false;
      e.stopPropagation();
    }
  }, []);

  const topCard    = song?.cards[0] ?? null;
  const artworkUrl = topCard?.artworkUrl ?? song?.artworkUrl ?? null;
  const fallback   = topCard ? rarityColor(topCard.rarityType.slug) : '#444444';

  const artColor = useArtColor(artworkUrl, fallback);

  // For numbered epics override the page bleed with the rarity neon colour so
  // the background matches the card's animated border.
  const epicKindCV = topCard && presenceForCard(topCard) === 'epic'
    ? epicBorderKind(topCard) : null;
  const bleedColor = epicKindCV === 'common'   ? '#22c55e'
                   : epicKindCV === 'uncommon' ? '#a855f7'
                   : artColor; // rare keeps art color; unnumbered/legacy keep art color

  const isCurrent = currentSong?.id === song?.id;

  const handleBack = () => {
    if (window.history.length > 1) window.history.back();
    else setLocation('/');
  };

  const handleCardTap = () => {
    if (!song) return;
    if (isCurrent) { if (!isPlaying) resume(); return; }
    play(song, [song]);
  };

  const { zoneRef, cardRef, scale, card } = useMeasuredScale(
    DEFAULT_SLOT_W_RATIO,
    song?.id,
  );

  const visualW = card ? card.w * scale : undefined;
  const visualH = card ? card.h * scale : undefined;

  // ── Not-found state ──────────────────────────────────────────────────────────
  if (!song || !topCard) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-white/50 bg-background">
        <Disc3 className="w-16 h-16 opacity-20" />
        <p className="text-lg font-bold text-white/70">Song not found</p>
        <Button variant="secondary" className="rounded-full" onClick={handleBack}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      className="h-full flex flex-col overflow-hidden relative bg-background w-full"
    >
      {/* ── Background: blurred art-colour bleed (neon override for numbered epics) ── */}
      <div
        className="absolute inset-0 z-0 pointer-events-none transition-[background] duration-700 ease-in-out"
        style={{ background: `color-mix(in srgb, ${bleedColor} 22%, #09090e)` }}
      />

      <AnimatePresence mode="sync">
        {artworkUrl && (
          <motion.div
            key={artworkUrl}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.38 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85 }}
            className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
          >
            <img
              src={artworkUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover blur-[90px] scale-150 transform-gpu"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/50 to-background" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top bar ── */}
      <div className="page-top relative z-10 flex items-center justify-between px-5 pb-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="w-11 h-11 rounded-full glass-panel hover:bg-white/10 active:scale-90 transition-all text-white shadow-lg"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex flex-col items-center min-w-0 flex-1 mx-3">
          {isCurrent ? (
            <span className="text-[9px] font-black tracking-[0.25em] uppercase text-primary">
              Now Playing
            </span>
          ) : (
            <p className="text-xs font-bold text-white/50 truncate">{song.title}</p>
          )}
          {/* Position indicator — shows filtered count when a filter is active */}
          {collectionIndex >= 0 && songs.length > 1 && (
            <p className="text-[9px] text-white/30 mt-0.5 font-medium">
              {hasFilterActive && filteredIndex >= 0
                ? `${filteredIndex + 1} / ${filteredSongs.length} filtered`
                : `${collectionIndex + 1} / ${songs.length}`}
            </p>
          )}
        </div>

        {/* Spacer keeps the title centred */}
        <div className="w-11 shrink-0" aria-hidden />
      </div>

      {/* ── Card background zone — swipe surface (Framer pan = window-level) ── */}
      <motion.div
        ref={zoneRef}
        className="relative z-10 flex-1 min-h-0 flex items-center justify-center overflow-hidden"
        style={{ touchAction: 'none' }}
        onPanStart={onZonePanStart}
        onPanEnd={onZonePanEnd}
        onClickCapture={onZoneClickCapture}
      >
        {/* Prev arrow */}
        {hasPrev && (
          <button
            type="button"
            aria-label="Previous card"
            onClick={() => goTo(-1)}
            className="absolute left-3 z-20 w-9 h-9 flex items-center justify-center rounded-full glass-panel text-white/60 hover:text-white active:scale-90 transition-all shadow-lg"
            style={{ touchAction: 'manipulation' }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Next arrow */}
        {hasNext && (
          <button
            type="button"
            aria-label="Next card"
            onClick={() => goTo(1)}
            className="absolute right-3 z-20 w-9 h-9 flex items-center justify-center rounded-full glass-panel text-white/60 hover:text-white active:scale-90 transition-all shadow-lg"
            style={{ touchAction: 'manipulation' }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/*
         * AnimatePresence on the card slot — key = songId so each navigation
         * triggers an enter/exit animation with the current direction.
         */}
        <AnimatePresence mode="popLayout" custom={direction}>
          <motion.div
            key={displaySongId}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 320, damping: 32 },
              y: { type: 'spring', stiffness: 320, damping: 32 },
              opacity: { duration: 0.2 },
              scale: { duration: 0.2 },
            }}
            style={{
              width:    visualW,
              height:   visualH,
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <div
              ref={el => { (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = el; cardElRef.current = el; }}
              style={{
                position:        card ? 'absolute' : 'relative',
                top:             card ? 0 : undefined,
                left:            card ? 0 : undefined,
                transformOrigin: 'top left',
                transform:       card ? `scale(${scale})` : undefined,
              }}
              className="cursor-pointer"
              onClick={epicKindCV ? undefined : handleCardTap}
            >
              <SoundmapCard
                card={topCard}
                title={song.title}
                artist={song.artist}
                genre={song.genre}
                size="hero"
                className="shadow-2xl"
                onArtistClick={() =>
                  setLocation(`/artists/${encodeURIComponent(song.artist)}`)
                }
                onPlay={handleCardTap}
                isPlaying={isCurrent && isPlaying}
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* ── Swipe hint dots ── */}
      {songs.length > 1 && collectionIndex >= 0 && (
        <div className="relative z-10 flex items-center justify-center gap-1.5 pb-3 shrink-0">
          {songs.slice(
            Math.max(0, collectionIndex - 3),
            Math.min(songs.length, collectionIndex + 4),
          ).map((s, i) => {
            const absIdx = Math.max(0, collectionIndex - 3) + i;
            const isActive = absIdx === collectionIndex;
            return (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to ${s.title}`}
                onClick={() => {
                  const delta = absIdx - collectionIndex;
                  if (delta !== 0) goTo(delta);
                }}
                className={`rounded-full transition-all duration-200 ${
                  isActive
                    ? 'w-4 h-1.5 bg-white/80'
                    : 'w-1.5 h-1.5 bg-white/25 hover:bg-white/45'
                }`}
              />
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
