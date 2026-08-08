import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const WELCOMED_KEY = 'maplog:welcomed';

/** Play a brief ascending 5-note jingle via the Web Audio API. */
function playJingle() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    // C4 → E4 → G4 → C5 → E5 (major arpeggio)
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25];
    const dur = 0.14;
    const gap = 0.07;
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * (dur + gap);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    });
    setTimeout(() => ctx.close(), (notes.length * (dur + gap) + 0.5) * 1000);
  } catch {
    // silently ignore if Web Audio is unavailable
  }
}

export function WelcomeScreen() {
  const [visible, setVisible] = useState(() => !localStorage.getItem(WELCOMED_KEY));
  const [pressed, setPressed] = useState(false);

  const handleWelcome = async () => {
    if (pressed) return;
    setPressed(true);

    // Play jingle — this is the user gesture that iOS needs for permission prompts.
    playJingle();

    // Request DeviceOrientation permission (iOS 13+).
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const DevOri = DeviceOrientationEvent as any;
      if (typeof DevOri.requestPermission === 'function') {
        const result: string = await DevOri.requestPermission();
        if (result === 'granted') {
          localStorage.setItem('maplog:motionGranted', '1');
        }
      }
    } catch {
      // Non-iOS or user dismissed — that's fine.
    }

    localStorage.setItem(WELCOMED_KEY, '1');
    // Short pause so the jingle plays before fading out.
    setTimeout(() => setVisible(false), 900);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center select-none"
          style={{ background: '#080810', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Ambient glow */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: '35%', left: '50%', transform: 'translate(-50%, -50%)',
              width: 500, height: 500,
              background: 'radial-gradient(circle, rgba(255,60,0,0.12) 0%, transparent 70%)',
              borderRadius: '50%',
            }}
          />

          {/* Wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.55, ease: 'easeOut' }}
            className="relative text-center mb-20"
          >
            <p className="text-white/30 text-xs font-bold tracking-[0.35em] uppercase mb-5">
              Harmony
            </p>
            <h1
              className="font-display font-black leading-none tracking-tight text-white"
              style={{ fontSize: 'clamp(2.8rem, 12vw, 4.5rem)' }}
            >
              YOUR<br />COLLECTION
            </h1>
            <div
              className="mt-5 mx-auto h-px"
              style={{
                width: 80,
                background: 'linear-gradient(90deg, transparent, #ff3c00, transparent)',
              }}
            />
          </motion.div>

          {/* CTA button */}
          <motion.button
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: pressed ? 0 : 1, scale: pressed ? 1.08 : 1 }}
            transition={{ delay: 0.45, duration: 0.4 }}
            onClick={handleWelcome}
            disabled={pressed}
            className="relative rounded-full font-black tracking-widest text-white active:scale-95 transition-transform"
            style={{
              fontSize: '1rem',
              padding: '1rem 2.5rem',
              background: '#ff3c00',
              boxShadow: '0 0 48px rgba(255,60,0,0.55), 0 0 12px rgba(255,60,0,0.3)',
              letterSpacing: '0.18em',
            }}
          >
            WELCOME BACK
          </motion.button>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: pressed ? 0 : 1 }}
            transition={{ delay: 0.75, duration: 0.4 }}
            className="mt-5 text-white/22 text-[10px] tracking-[0.28em] uppercase"
          >
            Tap to begin
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
