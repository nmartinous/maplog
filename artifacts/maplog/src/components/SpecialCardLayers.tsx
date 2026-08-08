import React, { useRef, useState, useEffect } from 'react';
import type { MaplogCard } from '@/lib/types';
import { epicBorderKind, epicFrameForCard, radiantPatternCss, type EpicBorderKind } from '@/lib/cardTemplates';
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
  // Panned imperatively via ref — deviceorientation fires ~60Hz, and driving
  // it through React state restarted the CSS transition every frame, making
  // the layer (and the text composited above it) jitter back and forth.
  const imgRef = useRef<HTMLImageElement | null>(null);
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
    // Pan via TRANSFORM only — compositor-only, never repaints card layer,
    // so the text above stays rock-steady.
    // scale(1.3) gives 15% overflow each side; pan stays within ±12%.
    const RANGE = 12;
    const handler = (e: DeviceOrientationEvent) => {
      if (!mounted || !imgRef.current) return;
      // gamma = left(-90°)…right(90°); clamp to ±1 at ±25°
      const raw = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 25));
      smoothX.current = ALPHA * raw + (1 - ALPHA) * smoothX.current;
      const tx = (-smoothX.current * RANGE).toFixed(3);
      imgRef.current.style.transform = `scale(1.3) translate3d(${tx}%, 0, 0)`;
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
      {/* Normal-fit image panned with scale(1.3) + translate3d — always
          fills the container with no gap, transform is compositor-only. */}
      <img
        ref={imgRef}
        src={artworkUrl}
        alt={title}
        className="absolute inset-0 w-full h-full select-none pointer-events-none"
        style={{
          objectFit: 'cover',
          willChange: 'transform',
          transform: 'scale(1.3) translate3d(0, 0, 0)',
        }}
      />
    </div>
  );
}

/**
 * Card-slot media from Edit Mode uploads; falls back to parallax art.
 *
 * `muted` controls the video's audio output — defaults to true (always
 * silent for canvases/epics). Moment cards in CardView pass false when the
 * user unmutes via the mute button. React's `muted` attribute is not
 * reactive, so we drive it imperatively through a ref.
 */
export function MediaSlot({ card, title, muted = true }: {
  card: MaplogCard; title: string; muted?: boolean;
}) {
  const media = useCardMedia(card.id);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  /**
   * Two-pronged muted sync:
   *
   * 1. Callback ref — runs synchronously in React's commit phase, BEFORE the
   *    browser processes autoPlay. Setting `.muted` here (not via the HTML
   *    attribute) lets us start an unmuted video on mount without a separate
   *    user-gesture step. The `muted` HTML attribute is omitted entirely so
   *    there is no attribute-vs-property conflict.
   *
   * 2. useEffect — handles subsequent prop changes (e.g. user taps mute btn).
   *    Setting `.muted = true` always works; `.muted = false` also works here
   *    because it is triggered synchronously from a button onClick (user gesture).
   */
  const refCallback = React.useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el) el.muted = muted;         // set before browser starts autoPlay
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],                                  // mount-only; subsequent changes via effect
  );

  React.useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  if (media?.type === 'video') {
    return (
      <video
        ref={refCallback}
        src={media.url}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        // NO muted attribute — muted state is owned exclusively by .muted
        // property set in refCallback + effect, avoiding the attribute/property
        // conflict that would lock the video into always-muted on iOS.
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
export function EpicPins({
  card,
  cardWidth,
  kind,
}: {
  card: MaplogCard;
  cardWidth: number;
  kind?: EpicBorderKind;
}) {
  const numbered = card.variantLabel?.startsWith('#') ? card.variantLabel : null;
  const pin      = card.pin ?? null;
  const pinSize  = Math.max(20, cardWidth * 0.17);

  const isRare = kind === 'rare';
  const color  = kind === 'common'   ? '#4ade80'
               : kind === 'uncommon' ? '#c084fc'
               : 'rgba(255,255,255,0.8)'; // rare uses rainbow class, others fallback

  return (
    <>
      {numbered && (
        <div
          className={cn(
            'absolute top-2 right-2 z-30 font-black rounded-full leading-none shadow-lg',
            isRare ? 'epic-pin-base epic-pin-num' : '',
          )}
          style={{
            fontSize:   Math.max(9, cardWidth * 0.06),
            padding:    '0.35em 0.6em',
            background: '#0a0a0f',
            // Rare gets its border from the .epic-rare-chrome box-shadow animation.
            ...(isRare ? {} : { color, border: `1.5px solid ${color}` }),
          }}
        >
          {numbered}
        </div>
      )}
      {pin && (
        <div
          className="absolute bottom-1.5 left-1.5 z-20 leading-none select-none drop-shadow-lg"
          style={{ fontSize: pinSize }}
          title="Pin"
        >
          {pin}
        </div>
      )}
    </>
  );
}

// ── Epic card overlay (info-area badges, artist tap, play button) ─────────────

/**
 * Overlays the invisible info section of typed epic cards.
 *
 * Layout mirrors the native Soundmap video-card info section:
 *   - Title (parallax-only — canvas already shows its own)
 *   - Artist name (always visible and tappable for both canvas and parallax)
 *   - Flex-1 spacer to push the action row to the bottom
 *   - Action row (left-aligned): RarityBadge | genre badge | play button
 *     These three sit in the SAME horizontal row so they cover the native
 *     video card's "+Epic", "♪ icon", and "▶" elements exactly.
 */
export function EpicCardOverlay({
  card,
  title,
  artist,
  genre,
  cardWidth,
  onArtistClick,
  onPlay,
  isPlaying = false,
}: {
  card: MaplogCard;
  title: string;
  artist: string;
  genre?: string | null;
  cardWidth: number;
  onArtistClick?: () => void;
  onPlay?: () => void;
  isPlaying?: boolean;
}) {
  const kind = epicBorderKind(card);
  if (kind !== 'common' && kind !== 'uncommon' && kind !== 'rare') return null;

  const media    = useCardMedia(card.id);
  const hasMedia = media !== null;

  /*
   * Measurement-based layout, taken from the user's untouched Soundmap
   * reference capture (inner card 408×656px) and scaled width-fit onto our
   * card (canvas videos are object-fit:cover, width-bound, vertical crop):
   *   left padding 31px → 20px   | title ~26px → 17px bold
   *   artist ~19px → 12px        | artist line center ≈42px above bottom
   *   action row bottom ≈2px     | play = small grey ▶ on the artist line
   * All values scale with cardWidth so md/lg cards stay aligned too.
   */
  const f  = cardWidth / 266;
  const px = (n: number) => Math.round(n * f);

  // Subtle drop shadow — matches how the native canvas video renders its own
  // text (a heavier glow-stroke made parallax text look mismatched next to it)
  const textStroke: React.CSSProperties = {
    textShadow: '0 1px 4px rgba(0,0,0,0.75), 0 0 2px rgba(0,0,0,0.5)',
  };

  // Play badge styled to match the top-right number pin (same dark shell +
  // per-kind neon border). Opaque, so it fully covers the video's own ▶.
  const isRareEpic = kind === 'rare';
  const pinColor = kind === 'common' ? '#4ade80' : '#c084fc';
  // Rare epics get the animated rainbow chrome (same class as the number pin);
  // common/uncommon use their static neon color.
  const playBadgeClass = isRareEpic ? 'epic-pin-base epic-pin-play' : '';
  const playBadgeStyle: React.CSSProperties = {
    width: px(32),
    height: px(32),
    background: '#0a0a0f',
    boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
    ...(isRareEpic ? {} : { border: `1.5px solid ${pinColor}`, color: pinColor }),
  };

  const playGlyph = isPlaying ? (
    <svg width={px(12)} height={px(12)} viewBox="0 0 10 10" fill="currentColor">
      <rect x="1.5" y="1" width="2.5" height="8" rx="0.5" />
      <rect x="6"   y="1" width="2.5" height="8" rx="0.5" />
    </svg>
  ) : (
    <svg width={px(12)} height={px(12)} viewBox="0 0 10 10" fill="currentColor">
      <path d="M2 1.5L9 5L2 8.5V1.5Z" />
    </svg>
  );

  return (
    // z-[25]: above MediaSlot (z-[1]) and art/info (z-[2]); below EpicPins (z-30).
    // Everything is anchored to the CARD bottom (not the info section) because
    // the canvas video fills the whole card and draws its chrome near the edge.
    <div className="absolute inset-0 z-[25] pointer-events-none">

      {/* ── Parallax: visible title + artist + grey ▶, mirroring the video layout ── */}
      {!hasMedia && (
        <div
          className="absolute flex flex-col"
          // Calibration: whole block right 2px / up 1px
          style={{ left: px(20) + 2, right: px(20) - 2, bottom: px(44) + 1 }}
        >
          {/* Sized/positioned to mirror the canvas video's own text: title
              ~15px bold, artist ~13px near-white directly below. */}
          <p
            className="font-extrabold leading-tight truncate w-full text-white relative"
            style={{ fontSize: px(17), top: 7, ...textStroke }}
          >
            {title}
          </p>
          <div className="flex items-center justify-between" style={{ marginTop: px(7) }}>
            <button
              type="button"
              className="pointer-events-auto leading-tight truncate text-left text-white/95 active:opacity-60 transition-opacity min-w-0 flex-1"
              style={{ fontSize: px(14), fontWeight: 600, ...textStroke }}
              onClick={e => { e.stopPropagation(); onArtistClick?.(); }}
              aria-label={`View artist ${artist}`}
            >
              {artist}
            </button>
            {/* Play badge on the artist line — styled like the number pin */}
            <button
              type="button"
              className={`pointer-events-auto shrink-0 rounded-full active:opacity-60 transition-opacity flex items-center justify-center ${playBadgeClass}`}
              style={playBadgeStyle}
              onClick={e => { e.stopPropagation(); onPlay?.(); }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {playGlyph}
            </button>
          </div>
        </div>
      )}

      {/* ── Canvas: artist tap zone (invisible) + VISIBLE play glyph over the video's ▶ ── */}
      {hasMedia && (
        <>
          <button
            type="button"
            className="absolute pointer-events-auto opacity-0 select-none"
            style={{ left: px(20), bottom: px(44), width: '55%', height: px(20) }}
            onClick={e => { e.stopPropagation(); onArtistClick?.(); }}
            aria-label={`View artist ${artist}`}
          />
          {/* Play badge — opaque number-pin styling sits ON TOP of the video's
              own play glyph so it's fully hidden and reflects OUR playing state. */}
          <button
            type="button"
            className={`absolute pointer-events-auto rounded-full active:opacity-60 transition-opacity flex items-center justify-center ${playBadgeClass}`}
            // Raised + slightly larger: canvas videos place their own ▶ at
            // slightly different heights, so the badge covers all variants.
            style={{ ...playBadgeStyle, right: px(15), bottom: px(43) + 1 }}
            onClick={e => { e.stopPropagation(); onPlay?.(); }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {playGlyph}
          </button>
        </>
      )}

      {/* ── Action row: epic pill + genre badge, covering the video's pill row.
             The genre badge is wide enough to also cover the video's lyric
             (speech-bubble + number) chip that sits right of its genre pill. ── */}
      <div
        className="absolute flex items-center pointer-events-auto"
        // Final calibration: +1px right (both pills), pills 1px taller
        style={{ left: px(16) + 1, bottom: px(21), gap: px(4) }}
      >
        {/* Scaled epic pill (RarityBadge has fixed sizing → too big on cards) */}
        <span
          className="inline-flex items-center font-bold rounded-full text-[#eac54f] leading-none shrink-0"
          style={{
            fontSize: px(11),
            padding: `${px(5) + 0.5}px ${px(7)}px`,
            gap: px(3),
            background: 'linear-gradient(90deg, #6b5800 0%, #4a2a00 100%)',
            border: '1px solid #b4840055',
            boxShadow: '0 0 8px #b4840050',
          }}
        >
          <svg width={px(10)} height={px(10)} viewBox="0 0 10 10" fill="none" className="shrink-0" aria-hidden>
            <polygon points="5,0.5 9.5,5 5,9.5 0.5,5" fill="#eac54f" />
            <polygon points="5,0.5 9.5,5 5,4.2" fill="white" fillOpacity="0.22" />
          </svg>
          Epic
        </span>
        {genre && (
          <span
            className="inline-flex items-center font-semibold rounded-full bg-[#18181f] text-white/60 border border-white/15 leading-none overflow-hidden"
            style={{
              fontSize: px(11),
              padding: `${px(5) + 0.5}px ${px(10)}px`,
              gap: px(4),
              // Wide enough to also cover Soundmap's genre + speech-bubble
              // count chips (badge row spans both in the reference layout)
              minWidth: px(108),
              maxWidth: px(150),
            }}
          >
            <svg width={px(9)} height={px(9)} viewBox="0 0 9 9" fill="none" className="shrink-0 flex-none">
              <path d="M1 1.5h7M1 4.5h5M1 7.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="truncate">{genre}</span>
          </span>
        )}
      </div>
    </div>
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
export function MomentStars({ seed: _seed }: { seed: string }) {
  // Randomize on every mount so stars feel alive when navigating between cards.
  const [stars] = React.useState(() =>
    Array.from({ length: 48 }, (_, i) => ({
      left:     Math.random() * 100,
      top:      Math.random() * 100,
      // Three size buckets: tiny (0.8–1.6), medium (1.7–3), large (3.1–5)
      size:     Math.random() < 0.55
                  ? 0.8 + Math.random() * 0.8        // tiny — most stars
                  : Math.random() < 0.75
                  ? 1.7 + Math.random() * 1.3        // medium
                  : 3.1 + Math.random() * 1.9,       // large — a few
      delay:    Math.random() * 6,
      duration: 1.5 + Math.random() * 4.5,           // 1.5–6s twinkle speed
      peak:     0.18 + Math.random() * 0.82,          // 0.18–1.0 peak brightness
      key:      i,
    }))
  );
  return (
    <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden rounded-[inherit]" aria-hidden>
      {stars.map(s => (
        <span
          key={s.key}
          className="moment-star"
          style={{
            left: `${s.left}%`,
            top:  `${s.top}%`,
            width:  s.size,
            height: s.size,
            animationDelay:    `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            '--star-peak': s.peak,
          } as React.CSSProperties}
        />
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
  const radiiMap: Record<typeof size, number> = { sm: 12, md: 24, lg: 24, hero: 32 };
  const r = radiiMap[size];

  const wrapClass  = kind === 'common'   ? 'epic-green-wrap'
                   : kind === 'uncommon' ? 'epic-purple-wrap'
                   :                       'epic-rainbow-wrap';
  const innerClass = kind === 'common'   ? 'epic-green-inner'
                   : kind === 'uncommon' ? 'epic-purple-inner'
                   :                       'epic-rainbow-inner';

  const ringClass = kind === 'common'   ? 'epic-wave-ring-green'
                  : kind === 'uncommon' ? 'epic-wave-ring-purple'
                  :                       'epic-wave-ring-rainbow';
  const clipR = r + 12;

  return (
    <div style={{ position: 'relative', borderRadius: r }}>
      {/*
        Rounded overflow:hidden clip — 12px larger than the card on each side.
        The .epic-wave-ring's blur can spread up to 12px outside the card border
        before being clipped to this rounded shape. Rectangular bleed is impossible
        because the clip's own border-radius defines the outer boundary.
      */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: -12,
          borderRadius: clipR,
          overflow: 'hidden',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <div
          className={`epic-wave-ring ${ringClass}`}
          style={{ borderRadius: clipR }}
        />
      </div>
      <div className={wrapClass} style={{ borderRadius: r, padding: 0, position: 'relative', zIndex: 1 }}>
        <div className={innerClass}>{children}</div>
      </div>
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
    <motion.div className="relative select-none" data-radiant-spin style={{ perspective: 1000, touchAction: 'pan-y' }}
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
