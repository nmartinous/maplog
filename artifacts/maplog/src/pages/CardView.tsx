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
 */

import React, {
  useRef, useState, useLayoutEffect, useEffect, useMemo,
} from 'react';
import { useParams, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Disc3 } from 'lucide-react';

import { useMusicKit } from '@/context/MusicKitContext';
import { usePlayer } from '@/context/AudioPlayerContext';
import { useArtColor } from '@/lib/useArtColor';
import { SoundmapCard } from '@/components/SoundmapCard';
import { Button } from '@/components/ui/button';

// ── Zone constants (from mockup-sandbox/src/components/mockups/zoneConstants.ts) ─
/** Card slot is 75 % of viewport width at most. */
const DEFAULT_SLOT_W_RATIO = 0.75;
/** CARD_ASPECT from the mockup (slot geometry). */
// const CARD_ASPECT = 3 / 4.5; // referenced for clarity; unused in scale calc

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
 *
 * How it works:
 *  1. cardRef is placed on the card's natural-size wrapper (no transforms).
 *  2. useLayoutEffect reads offsetWidth / offsetHeight synchronously before
 *     the first browser paint, so scale is computed before the card is visible.
 *  3. ResizeObserver keeps scale current as orientation / window size change.
 *  4. The caller applies `transform: scale(scale)` to cardRef and sizes an
 *     outer layout container to (cardW * scale) × (cardH * scale) so the
 *     layout box matches the visual size — no hidden overflow or clipping.
 */
function useMeasuredScale(slotWRatio: number, songId: string | undefined) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Natural card dimensions (at scale = 1, hero size w-[280px])
  const [card, setCard] = useState<{ w: number; h: number } | null>(null);
  // Available zone dimensions
  const [zone, setZone] = useState<{ w: number; h: number } | null>(null);

  // Synchronous initial measurement — fires before browser paint
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    setCard({ w: el.offsetWidth, h: el.offsetHeight });
  }, [songId]); // re-measure when the song (card) changes

  useLayoutEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    setZone({ w: el.clientWidth, h: el.clientHeight });
  }, []);

  // ResizeObserver keeps measurements current across orientation changes
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
    const margin = 16; // px breathing room on each axis
    const maxW = zone.w * slotWRatio - margin;
    const maxH = zone.h - margin;
    return Math.min(1, maxW / card.w, maxH / card.h);
  }, [card, zone, slotWRatio]);

  return { zoneRef, cardRef, scale, card };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CardView() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { getSong } = useMusicKit();
  const { play, resume, currentSong, isPlaying } = usePlayer();

  const songId = decodeURIComponent(id ?? '');

  // Fall back to the actively-playing song so the mini-player can always
  // open this view even for songs not (or no longer) in the collection.
  const song = getSong(songId) ?? (currentSong?.id === songId ? currentSong : undefined);

  const topCard    = song?.cards[0] ?? null;
  const artworkUrl = topCard?.artworkUrl ?? song?.artworkUrl ?? null;
  const fallback   = topCard ? rarityColor(topCard.rarityType.slug) : '#444444';

  // Vibrant art colour — drives the card-background bleed tint
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

  // ── Adaptive scale based on measured card + zone dimensions ─────────────────
  const { zoneRef, cardRef, scale, card } = useMeasuredScale(
    DEFAULT_SLOT_W_RATIO,
    song?.id,
  );

  // Visual (scaled) dimensions for the layout container.
  // The inner card is position:absolute + transform:scale, so the outer
  // container must explicitly claim the visual footprint to keep flex layout
  // centred and to prevent the card from colliding with chrome.
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
      {/* ── Background: blurred art-colour bleed (covers the full card zone) ── */}
      <div
        className="absolute inset-0 z-0 pointer-events-none transition-[background] duration-700 ease-in-out"
        style={{ background: `color-mix(in srgb, ${artColor} 22%, #09090e)` }}
      />

      <AnimatePresence>
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
            {/* Fade toward the chrome zones at top and bottom */}
            <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/50 to-background" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top bar — page-top adds status-bar-safe padding automatically ── */}
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
        </div>

        {/* Spacer keeps the title centred */}
        <div className="w-11 shrink-0" aria-hidden />
      </div>

      {/* ── Card background zone — flex-1 fills the real remaining height ── */}
      <div
        ref={zoneRef}
        className="relative z-10 flex-1 min-h-0 flex items-center justify-center"
      >
        {/*
         * Layout container: sized to the VISUAL (scaled) card dimensions so
         * flex centering is correct and the card does not overlap chrome.
         * Before measurement (first render) the inner card is in normal flow
         * and the container wraps it naturally.
         */}
        <motion.div
          initial={{ scale: 0.93, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.06 }}
          style={{
            // Once measured: fix the layout box to the visual footprint.
            // Before measurement: auto-size from inner card flow.
            width:    visualW,
            height:   visualH,
            position: 'relative',
            flexShrink: 0,
          }}
        >
          {/*
           * Card wrapper: natural-size card, scaled via CSS transform.
           * position:absolute is activated once we have measurements so the
           * layout container (visualW × visualH) is the single source of truth
           * for the space this element occupies.
           *
           * Before measurements arrive (card is invisible due to Framer Motion
           * initial opacity:0), the card sits in normal flow so the container
           * can size itself correctly on the very first synchronous
           * useLayoutEffect pass.
           */}
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
      </div>
    </motion.div>
  );
}
