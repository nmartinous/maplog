import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Hash, Film, Check, Upload, ChevronRight, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MaplogCard, MaplogSong } from '@/lib/types';
import { putCardMedia } from '@/lib/mediaStore';
import { cn } from '@/lib/utils';

export interface WizardItem {
  song: MaplogSong;
  card: MaplogCard;
  /** true for epic-common / epic-uncommon / epic-rare (numbered playlists) */
  isNumbered: boolean;
}

interface EpicImportWizardProps {
  items: WizardItem[];
  /** Called for each card when the wizard completes that item */
  onSave: (songId: string, cardId: string, label: string | null, isCanvas: boolean) => void;
  onDone: () => void;
}

/** Per-item decisions collected before saving */
interface Decision {
  numberText: string; // raw input, will be prefixed with #; empty = skip
  isCanvas: boolean;
  videoFile: File | null;
}

const DEFAULT_DECISION = (): Decision => ({
  numberText: '',
  isCanvas: false,
  videoFile: null,
});

/**
 * Bottom-sheet wizard that appears after syncing epic playlists.
 * For each epic card it asks:
 *   1. (if from a numbered playlist) Copy number (optional, skippable)
 *   2. Canvas video or parallax art?
 *   3. If canvas — upload the screen recording.
 */
export function EpicImportWizard({ items, onSave, onDone }: EpicImportWizardProps) {
  const [idx, setIdx] = useState(0);
  const [decisions, setDecisions] = useState<Decision[]>(
    () => items.map(() => DEFAULT_DECISION()),
  );
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const item = items[idx];
  const dec  = decisions[idx];
  const total = items.length;

  const patchDec = (patch: Partial<Decision>) => {
    setDecisions(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  };

  // ── Determine which steps to show ─────────────────────────────────────────
  // Step A: copy number (only for numbered playlists — skippable)
  // Step B: canvas or parallax (always)
  // Step C: video upload (only if isCanvas)
  type Step = 'number' | 'canvas' | 'upload';

  const steps: Step[] = [
    ...(item.isNumbered ? ['number' as Step] : []),
    'canvas',
    ...(dec.isCanvas ? ['upload' as Step] : []),
  ];

  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[stepIdx] ?? 'canvas';

  const goNextStep = () => {
    // Recompute steps each time (isCanvas may have changed)
    const freshSteps: Step[] = [
      ...(item.isNumbered ? ['number' as Step] : []),
      'canvas',
      ...(dec.isCanvas ? ['upload' as Step] : []),
    ];
    if (stepIdx < freshSteps.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      advanceItem();
    }
  };

  const advanceItem = () => {
    if (idx < total - 1) {
      setIdx(idx + 1);
      setStepIdx(0);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const d  = decisions[i];
      // Save number label (if entered)
      const label = d.numberText.trim() ? `#${d.numberText.trim()}` : null;
      onSave(it.song.id, it.card.id, label, d.isCanvas);
      // Save video if provided
      if (d.isCanvas && d.videoFile) {
        try {
          await putCardMedia(it.card.id, d.videoFile);
        } catch (err) {
          console.warn('[EpicImportWizard] Failed to save video for', it.card.id, err);
        }
      }
    }
    setSaving(false);
    onDone();
  };

  const borderColor = item.card.rarityType.slug === 'epic-common'   ? '#22c55e'
                    : item.card.rarityType.slug === 'epic-uncommon'  ? '#a855f7'
                    : item.card.rarityType.slug === 'epic-rare'      ? '#f59e0b'
                    : '#ffffff';

  const accentClass = item.card.rarityType.slug === 'epic-common'   ? 'text-green-400'
                    : item.card.rarityType.slug === 'epic-uncommon'  ? 'text-purple-400'
                    : item.card.rarityType.slug === 'epic-rare'      ? 'text-amber-400'
                    : 'text-white';

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      />

      {/* Sheet */}
      <motion.div
        key="sheet"
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-[#0d0d14] border-t border-white/10 shadow-2xl pb-safe"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 36 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
              Epic Import · {idx + 1} of {total}
            </p>
            <p className={cn('font-display font-bold text-lg leading-tight mt-0.5', accentClass)}>
              {item.song.title}
            </p>
            <p className="text-xs text-white/50">{item.song.artist}</p>
          </div>
          <div className="flex items-center gap-3">
            {item.card.artworkUrl && (
              <img
                src={item.card.artworkUrl}
                alt=""
                className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                style={{ boxShadow: `0 0 16px -4px ${borderColor}88` }}
              />
            )}
            <button
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
              onClick={onDone}
              aria-label="Skip"
            >
              <X className="w-4 h-4 text-white/50" />
            </button>
          </div>
        </div>

        {/* Progress dots */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5 pb-3">
            {items.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-all',
                  i < idx  ? 'bg-white/40'
                  : i === idx ? 'w-3 bg-white/80'
                  : 'bg-white/15',
                )}
              />
            ))}
          </div>
        )}

        <div className="h-px bg-white/8 mx-6" />

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${idx}-${stepIdx}`}
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18 }}
            className="px-6 pt-5 pb-6 space-y-5"
          >

            {/* ── STEP: Copy Number ── */}
            {step === 'number' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center shrink-0">
                    <Hash className="w-4 h-4 text-white/60" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">What is the copy number?</p>
                    <p className="text-xs text-white/45 mt-0.5">Displays a copy-number badge on the card. Leave blank to skip.</p>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    placeholder="e.g. 47"
                    className="w-full h-12 rounded-2xl bg-black/30 border border-white/10 px-4 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={dec.numberText}
                    onChange={e => patchDec({ numberText: e.target.value.replace(/[^0-9]/g, '') })}
                  />
                  {dec.numberText ? (
                    <p className="text-xs text-white/35 mt-1.5 px-1">Will be displayed as #{dec.numberText}</p>
                  ) : (
                    <p className="text-xs text-white/25 mt-1.5 px-1">No badge will be shown.</p>
                  )}
                </div>

                <Button
                  className="w-full rounded-full font-bold h-11"
                  onClick={goNextStep}
                >
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            )}

            {/* ── STEP: Canvas or Parallax ── */}
            {step === 'canvas' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center shrink-0">
                    <Film className="w-4 h-4 text-white/60" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">Does this epic have a canvas video?</p>
                    <p className="text-xs text-white/45 mt-0.5">Canvas epics play a full-screen clip. Parallax epics pan the album art with tilt.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    className={cn(
                      'rounded-2xl border p-4 flex flex-col items-center gap-2 transition-all',
                      dec.isCanvas
                        ? 'bg-white/10 border-white/20'
                        : 'bg-transparent border-white/8 opacity-60',
                    )}
                    onClick={() => patchDec({ isCanvas: true })}
                  >
                    <Film className="w-6 h-6 text-white/70" />
                    <span className="text-xs font-bold text-white">Canvas video</span>
                  </button>
                  <button
                    className={cn(
                      'rounded-2xl border p-4 flex flex-col items-center gap-2 transition-all',
                      !dec.isCanvas
                        ? 'bg-white/10 border-white/20'
                        : 'bg-transparent border-white/8 opacity-60',
                    )}
                    onClick={() => patchDec({ isCanvas: false, videoFile: null })}
                  >
                    <Image className="w-6 h-6 text-white/70" />
                    <span className="text-xs font-bold text-white">Parallax art</span>
                  </button>
                </div>

                <Button
                  className="w-full rounded-full font-bold h-11"
                  onClick={goNextStep}
                >
                  {dec.isCanvas ? <>Upload video <ChevronRight className="w-4 h-4 ml-1" /></> : <>Done <Check className="w-4 h-4 ml-1" /></>}
                </Button>
              </>
            )}

            {/* ── STEP: Video upload ── */}
            {step === 'upload' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center shrink-0">
                    <Upload className="w-4 h-4 text-white/60" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">Upload the canvas recording</p>
                    <p className="text-xs text-white/45 mt-0.5">Full-screen screen recording of the epic in Soundmap. Stored on this device.</p>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null;
                    patchDec({ videoFile: f });
                  }}
                />

                {dec.videoFile ? (
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
                    <Film className="w-5 h-5 text-green-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{dec.videoFile.name}</p>
                      <p className="text-xs text-white/45">{(dec.videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button
                      className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
                      onClick={() => patchDec({ videoFile: null })}
                    >
                      <X className="w-3.5 h-3.5 text-white/50" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="w-full h-24 rounded-2xl border border-dashed border-white/15 bg-white/3 hover:bg-white/6 flex flex-col items-center justify-center gap-2 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-6 h-6 text-white/30" />
                    <span className="text-xs font-bold text-white/40 uppercase tracking-wider">Choose video</span>
                  </button>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="rounded-full text-white/40 font-bold h-11 flex-1"
                    onClick={advanceItem}
                  >
                    Skip
                  </Button>
                  <Button
                    className="rounded-full font-bold h-11 flex-2"
                    disabled={!dec.videoFile || saving}
                    onClick={goNextStep}
                    style={{ flex: 2 }}
                  >
                    {saving ? 'Saving…' : idx === total - 1 ? <><Check className="w-4 h-4 mr-1" /> Save</> : <>Save & continue <ChevronRight className="w-4 h-4 ml-1" /></>}
                  </Button>
                </div>
              </>
            )}

          </motion.div>
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
