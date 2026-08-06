import React, { useRef, useState } from 'react';
import type { MaplogCard } from '@/lib/types';
import { epicFrameForCard, radiantPatternCss } from '@/lib/cardTemplates';
import { useCardMedia } from '@/lib/useCardMedia';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { Film, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Rendering layers for the special rarities (epic / moment / lyrics /
 * radiant), composed by SoundmapCard. Built from the user's Soundmap
 * reference captures: video slots, pins, frames, star fields, lyric quotes,
 * and the spinnable shimmering radiant.
 */

// ── Media slot (epics & moments) ──────────────────────────────────────────────

/** Card-slot media from Edit Mode uploads; falls back to artwork + empty-slot hint. */
export function MediaSlot({ card, title, showHint }: { card: MaplogCard; title: string; showHint: boolean }) {
  const media = useCardMedia(card.id);

  if (media?.type === 'video') {
    return <video src={media.url} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />;
  }
  if (media?.type === 'image') {
    return <img src={media.url} alt={title} className="absolute inset-0 w-full h-full object-cover" />;
  }
  // Empty slot — default background over (dimmed) artwork until media is added
  return (
    <>
      {card.artworkUrl ? (
        <img src={card.artworkUrl} alt={title} className="absolute inset-0 w-full h-full object-cover opacity-40" crossOrigin="anonymous" />
      ) : null}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-b from-black/30 to-black/60">
        <Film className="w-[22%] h-[22%] text-white/25" />
        {showHint && <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest">Empty clip slot</p>}
      </div>
    </>
  );
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
