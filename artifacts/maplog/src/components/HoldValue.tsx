import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { abbreviateValue, exactValue, isAbbreviated } from '@/lib/format';

/**
 * Abbreviated number (2.21M) that reveals the exact value in a popover while
 * pressed and held; the popover disappears on release.
 *
 * The popover is position:fixed (anchored via getBoundingClientRect) so it
 * can't be clipped by overflow-hidden panels like the valuation cards.
 * Centering is done via left/top math, not CSS transforms — framer-motion
 * owns the transform property, so translate utility classes would be clobbered.
 */
export function HoldValue({ value, className }: { value: number; className?: string }) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const abbreviated = isAbbreviated(value);
  const ref = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setAnchor(null);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
    window.removeEventListener('touchend', stop);
    window.removeEventListener('mouseup', stop);
  }, []);

  const start = useCallback(() => {
    if (!abbreviated || timerRef.current) return;
    // Listen globally from press start — the finger/mouse can drift off the
    // number (or release before the delay elapses) and must still cancel.
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('touchend', stop);
    window.addEventListener('mouseup', stop);
    // Small delay so quick taps (e.g. scrolling past) don't flash the popover
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const r = ref.current?.getBoundingClientRect();
      if (r) setAnchor({ x: r.left + r.width / 2, y: r.top });
    }, 150);
  }, [abbreviated, stop]);

  // Unmount cleanup
  useEffect(() => stop, [stop]);

  return (
    <span
      ref={ref}
      className={`relative inline-block select-none ${abbreviated ? 'cursor-pointer' : ''} ${className ?? ''}`}
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'pan-y' }}
      onPointerDown={start}
      onMouseDown={start}
      onTouchStart={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      onContextMenu={e => { if (abbreviated) e.preventDefault(); }}
    >
      {abbreviateValue(value)}
      {anchor && (
        <motion.span
          data-testid="hold-value-popover"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
          className="fixed px-3 py-1.5 rounded-xl bg-zinc-800 border border-white/15 shadow-xl text-white text-sm font-bold whitespace-nowrap z-[100] pointer-events-none"
          style={{
            left: anchor.x,
            top: anchor.y - 8,
            // translate is a separate CSS property, so framer-motion's
            // transform animation can't overwrite it
            translate: '-50% -100%',
          }}
        >
          {exactValue(value)}
        </motion.span>
      )}
    </span>
  );
}
