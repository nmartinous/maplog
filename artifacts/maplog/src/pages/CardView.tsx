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
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '60%' : '-60%',
    opacity: 0,
    scale: 0.88,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-60%' : '60%',
    opacity: 0,
    scale: 0.88,
  }),
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CardView() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { getSong, songs } = useMusicKit();
  const { play, resume, currentSong, isPlaying } = usePlayer();

  const songId = decodeURIComponent(id ?? '');

  const song = getSong(songId) ?? (currentSong?.id === songId ? currentSong : undefined);

  // ── Collection navigation ────────────────────────────────────────────────────
  const collectionIndex = useMemo(
    () => songs.findIndex(s => s.id === songId),
    [songs, songId],
  );
  const hasPrev = collectionIndex > 0;
  const hasNext = collectionIndex >= 0 && collectionIndex < songs.length - 1;

  // Track the slide direction so AnimatePresence knows which way to animate.
  const [direction, setDirection] = useState(0);

  const goTo = useCallback((delta: number) => {
    const nextIndex = collectionIndex + delta;
    if (nextIndex < 0 || nextIndex >= songs.length) return;
    const nextSong = songs[nextIndex];
    setDirection(delta);
    setLocation(`/card/${encodeURIComponent(nextSong.id)}`);
  }, [collectionIndex, songs, setLocation]);

  // ── Swipe gesture via pointer events ────────────────────────────────────────
  const pointerStartX = useRef<number | null>(null);
  const pointerStartY = useRef<number | null>(null);
  /**
   * Set to true when a qualifying swipe is detected in onPointerUp.
   * onZoneClickCapture (capture-phase) reads this and stops the click event
   * from reaching any child (e.g. the card tap handler) before resetting it.
   */
  const swipedRef = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only track primary pointer (touch or left mouse)
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerStartX.current = e.clientX;
    pointerStartY.current = e.clientY;
    swipedRef.current = false;
    // Capture the pointer so onPointerUp fires even if the pointer leaves the zone
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (pointerStartX.current === null || pointerStartY.current === null) return;
    const dx = e.clientX - pointerStartX.current;
    const dy = e.clientY - pointerStartY.current;
    pointerStartX.current = null;
    pointerStartY.current = null;

    // Require predominantly horizontal swipe
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dy) > Math.abs(dx) * 0.8) return;

    // Mark that a swipe occurred — the capture-phase click handler will
    // consume the synthetic click that follows pointerUp before it reaches
    // the card's onClick (which would otherwise trigger play/resume).
    swipedRef.current = true;
    if (dx < 0) goTo(1);  // swipe left → next
    else        goTo(-1); // swipe right → prev
  }, [goTo]);

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
      {/* ── Background: blurred art-colour bleed ── */}
      <div
        className="absolute inset-0 z-0 pointer-events-none transition-[background] duration-700 ease-in-out"
        style={{ background: `color-mix(in srgb, ${artColor} 22%, #09090e)` }}
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
          {/* Collection position indicator */}
          {collectionIndex >= 0 && songs.length > 1 && (
            <p className="text-[9px] text-white/30 mt-0.5 font-medium">
              {collectionIndex + 1} / {songs.length}
            </p>
          )}
        </div>

        {/* Spacer keeps the title centred */}
        <div className="w-11 shrink-0" aria-hidden />
      </div>

      {/* ── Card background zone — swipe surface ── */}
      <div
        ref={zoneRef}
        className="relative z-10 flex-1 min-h-0 flex items-center justify-center overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { pointerStartX.current = null; pointerStartY.current = null; swipedRef.current = false; }}
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
            key={songId}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 320, damping: 32 },
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
              ref={cardRef}
              style={{
                position:        card ? 'absolute' : 'relative',
                top:             card ? 0 : undefined,
                left:            card ? 0 : undefined,
                transformOrigin: 'top left',
                transform:       card ? `scale(${scale})` : undefined,
              }}
              className="cursor-pointer"
              onClick={handleCardTap}
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
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

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
