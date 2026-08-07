import React, { useRef, useState, useEffect } from 'react';
import type { MaplogCard } from '@/lib/types';
import { epicFrameForCard, radiantPatternCss, type EpicBorderKind } from '@/lib/cardTemplates';
import { useCardMedia } from '@/lib/useCardMedia';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Rendering layers for the special rarities (epic / moment / lyrics /
 * radiant), composed by SoundmapCard. Built from the user's Soundmap
 * reference captures: video slots, pins, frames, star fields, lyric quotes,
 * and the spinnable shimmering radiant.
 */

// ── Media slot (epics & moments) ──────────────────────────────────────────────

/**
 * Parallax album-art fill for still (no-video) epic cards.
 * Responds to device orientation (tilt) to pan a zoomed-in copy of the
 * artwork, giving a live depth effect on iOS/Android.
 *
 * iOS 13+ requires an explicit user-gesture permission call before
 * DeviceOrientationEvent fires.
 *
 * If the user has opted into motion controls globally (maplog:motionControls),
 * we attempt to request permission automatically on mount; otherwise we show
 * a "Tap to enable tilt" overlay until they grant it per-card.
 */
const MOTION_GRANTED_KEY = 'maplog:motionGranted';

function ParallaxArt({ artworkUrl, title }: { artworkUrl: string; title: string }) {
  // object-position x: 50 = centered, pans between ~20 and ~80 on tilt
  const [xPct, setXPct] = useState(50);
  // Low-pass filter on the raw gamma reading (-1 … +1)
  const smoothX = useRef(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const needsIosPerm = typeof (DeviceOrientationEvent as any).requestPermission === 'function';

  // 'granted'  = events will fire
  // 'auto'     = attempt requestPermission() on mount (pref on, or previously granted)
  // 'unknown'  = no pref, no history
  // 'denied'   = user declined
  const [iosPerm, setIosPerm] = useState<'granted' | 'auto' | 'unknown' | 'denied'>(() => {
    if (!needsIosPerm) return 'granted';
    const motionPref  = localStorage.getItem('maplog:motionControls') === '1';
    const prevGranted = localStorage.getItem(MOTION_GRANTED_KEY) === '1';
    return (motionPref || prevGranted) ? 'auto' : 'unknown';
  });

  // Silently attempt iOS permission on mount when pref is on or previously granted.
  useEffect(() => {
    if (iosPerm !== 'auto') return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (DeviceOrientationEvent as any).requestPermission()
      .then((r: string) => {
        if (cancelled) return;
        if (r === 'granted') {
          localStorage.setItem(MOTION_GRANTED_KEY, '1');
          setIosPerm('granted');
        } else {
          setIosPerm('unknown');
        }
      })
      .catch(() => { if (!cancelled) setIosPerm('unknown'); });
    return () => { cancelled = true; };
  }, [iosPerm]);

  useEffect(() => {
    if (iosPerm !== 'granted') return;
    let mounted = true;
    // Exponential low-pass: alpha=0.12 → heavy smoothing, no jitter
    const ALPHA = 0.12;
    // Pan range: ±RANGE% from center (50%). object-fit:cover guarantees no gaps.
    // Artwork is square; container is taller-than-wide, so the image always
    // overflows horizontally — any object-position within 0-100% is safe.
    const RANGE = 28;
    const handler = (e: DeviceOrientationEvent) => {
      if (!mounted) return;
      // gamma = left(-90°)…right(90°); clamp to ±1 at ±25°
      const raw = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 25));
      smoothX.current = ALPHA * raw + (1 - ALPHA) * smoothX.current;
      setXPct(50 + smoothX.current * RANGE);
    };
    window.addEventListener('deviceorientation', handler, { passive: true });
    return () => { mounted = false; window.removeEventListener('deviceorientation', handler); };
  }, [iosPerm]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/*
        object-fit: cover fills the entire container regardless of aspect ratio.
        Container is taller than wide; square artwork scales to fill the height,
        overflowing horizontally. object-position pans only on x — y is always
        50% so top and bottom of the art are always flush with the card edges.
        No gap is ever possible because cover always fills the full area.
      */}
      <img
        src={artworkUrl}
        alt={title}
        className="absolute inset-0 w-full h-full select-none pointer-events-none"
        style={{
          objectFit: 'cover',
          objectPosition: `${xPct}% 50%`,
          transition: 'object-position 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      />
    </div>
  );
}

/** Card-slot media from Edit Mode uploads; falls back to parallax art. No other content. */
export function MediaSlot({ card, title }: { card: MaplogCard; title: string }) {
  const media = useCardMedia(card.id);

  if (media?.type === 'video') {
    return (
      <video
        src={media.url}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        // Slight zoom clips the video's own internal borders so only the
        // card content fills the slot — container overflow:hidden does the crop
        style={{ transform: 'scale(1.16)', transformOrigin: 'center' }}
      />
    );
  }
  if (media?.type === 'image') {
    return <img src={media.url} alt={title} className="absolute inset-0 w-full h-full object-cover" />;
  }
  // No upload — parallax artwork (or dark void if no artwork URL)
  if (card.artworkUrl) {
    return <ParallaxArt artworkUrl={card.artworkUrl} title={title} />;
  }
  return null;
}

// ── Epic pins ─────────────────────────────────────────────────────────────────

/** Top-right number pin (numbered epics) + bottom-left emoji/image pin. */
export function EpicPins({ card, cardWidth }: { card: MaplogCard; cardWidth: number }) {
  const numbered = card.variantLabel?.startsWith('#') ? card.variantLabel : null;
  const pin = card.pin ?? null;
  const pinSize = Math.max(20, cardWidth * 0.17);
  return (
    <>
      {numbered && (
        <div className="absolute top-1.5 right-1.5 z-20 bg-white text-black font-black rounded-full leading-none shadow-lg border border-black/10"
          style={{ fontSize: Math.max(9, cardWidth * 0.06), padding: '0.35em 0.6em' }}>
          {numbered}
        </div>
      )}
      {pin && (
        <div className="absolute bottom-1.5 left-1.5 z-20 leading-none select-none drop-shadow-lg" style={{ fontSize: pinSize }} title="Pin">
          {pin}
        </div>
      )}
    </>
  );
}

// ── Epic frame overlay ────────────────────────────────────────────────────────

export function epicFrameStyle(card: MaplogCard): React.CSSProperties {
  const frame = epicFrameForCard(card);
  return {
    border: '2px solid transparent',
    backgroundImage: `linear-gradient(color-mix(in srgb, ${frame.glow} 14%, #0a0a0f), color-mix(in srgb, ${frame.glow} 14%, #0a0a0f)), ${frame.borderGradient}`,
    backgroundOrigin: 'border-box',
    backgroundClip: 'padding-box, border-box',
    boxShadow: `0 0 22px -4px ${frame.glow}88, 0 0 0 1px ${frame.glow}22`,
  };
}

// ── Moment star field ─────────────────────────────────────────────────────────

/** Deterministic pseudo-random star positions per card id. */
export function MomentStars({ seed }: { seed: string }) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rand = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 2 ** 32; };
  const stars = Array.from({ length: 18 }, (_, i) => ({
    left: rand() * 100, top: rand() * 100,
    size: 1 + rand() * 2.2, delay: rand() * 4, key: i,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden rounded-[inherit]" aria-hidden>
      {stars.map(s => (
        <span key={s.key} className="moment-star"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
      ))}
    </div>
  );
}

// ── Flavor / lyric text ───────────────────────────────────────────────────────

export function FlavorBubble({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <div className={cn(
      'relative rounded-2xl bg-[#b98b8b]/90 text-[#2a1416] font-bold leading-snug shadow-md',
      compact ? 'text-[9px] px-2 py-1' : 'text-[11px] px-3 py-1.5',
    )}>
      “{text}”
    </div>
  );
}

export function LyricSubject({ text, cardWidth }: { text: string; cardWidth: number }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 px-2.5 pb-2.5 pt-8 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
      <p className="font-display font-black text-white leading-tight drop-shadow"
        style={{ fontSize: Math.max(10, cardWidth * 0.055) }}>
        “{text}”
      </p>
    </div>
  );
}

// ── Radiant ───────────────────────────────────────────────────────────────────

export function RadiantPatternOverlay({ patternId, color, opacity = 0.5 }: {
  patternId: string | null | undefined; color: string; opacity?: number;
}) {
  return (
    <div className="absolute inset-0 pointer-events-none rounded-[inherit] radiant-pattern-drift"
      style={{ ...radiantPatternCss(patternId, color), opacity, mixBlendMode: 'screen' }} aria-hidden />
  );
}

// ── Epic neon border wrapper ──────────────────────────────────────────────────

/**
 * Wraps typed epic cards in their animated rotating-conic border.
 * - common:    green shades, cycling with audio-visualizer wave effect
 * - uncommon:  purple shades, same wave effect
 * - rare:      full rainbow spectrum
 * - unnumbered: no border — renders children unchanged
 */
export function EpicBorderWrap({
  kind,
  size,
  children,
}: {
  kind: EpicBorderKind;
  size: 'sm' | 'md' | 'lg' | 'hero';
  children: React.ReactNode;
}) {
  if (kind === 'unnumbered') return <>{children}</>;

  // Radius matches the card body's Tailwind rounded class exactly (no padding gap)
  const radiiMap: Record<typeof size, number> = { sm: 12, md: 16, lg: 16, hero: 24 };
  const r = radiiMap[size];

  const wrapClass  = kind === 'common'   ? 'epic-green-wrap'
                   : kind === 'uncommon' ? 'epic-purple-wrap'
                   :                       'epic-rainbow-wrap';
  const innerClass = kind === 'common'   ? 'epic-green-inner'
                   : kind === 'uncommon' ? 'epic-purple-inner'
                   :                       'epic-rainbow-inner';

  return (
    // padding: 0 — card body fills the full wrapper; box-shadow glow ring
    // provides the colored border without an internal gap
    <div className={wrapClass} style={{ borderRadius: r, padding: 0 }}>
      <div className={innerClass}>{children}</div>
    </div>
  );
}

/**
 * Drag-to-spin wrapper for radiant cards: horizontal drag spins the card
 * around Y with a spring settle onto whichever face is closest. `back` is
 * shown (mirrored) on the reverse side.
 */
export function RadiantSpin({ children, back, enabled }: {
  children: React.ReactNode; back: React.ReactNode; enabled: boolean;
}) {
  const rotY = useMotionValue(0);
  const springY = useSpring(rotY, { stiffness: 160, damping: 22 });
  const startRot = useRef(0);

  if (!enabled) {
    return <div className="relative">{children}</div>;
  }

  return (
    <motion.div className="relative select-none" style={{ perspective: 1000, touchAction: 'pan-y' }}
      // Framer's pan gesture tracks at window level — robust against pointer
      // capture, delegation quirks, and the media elements inside the card.
      onPanStart={() => { startRot.current = rotY.get(); }}
      onPan={(_, info) => { rotY.jump(startRot.current + info.offset.x * 0.9); }}
      onPanEnd={() => { rotY.set(Math.round(rotY.get() / 180) * 180); }}
      // Block native image drag-and-drop — it cancels the gesture mid-spin
      onDragStartCapture={e => e.preventDefault()}>
      <motion.div style={{ rotateY: springY, transformStyle: 'preserve-3d' }}>
        <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>{children}</div>
        <div className="absolute inset-0"
          style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
          {back}
        </div>
      </motion.div>
      <div className="absolute -bottom-5 inset-x-0 flex items-center justify-center gap-1 pointer-events-none">
        <Sparkles className="w-3 h-3 text-white/30" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Drag to spin</span>
      </div>
    </motion.div>
  );
}
