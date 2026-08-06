import React, { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Sparkles, LayoutGrid, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { MaplogSong } from '@/lib/types';
import { SoundmapCard } from '@/components/SoundmapCard';
import {
  type ShowcaseRow, type ShowcaseScope, type ShowcaseLayout, type ShowcaseCardRef,
  LAYOUT_SLOTS, LAYOUT_LABELS, loadShowcaseRows, saveShowcaseRows, newRowId,
  eligibleCards, resolveRow,
} from '@/lib/showcase';

/**
 * Showcase — user-arranged rows of special cards with per-row layouts.
 * Used on the Profile page (all special cards) and per-artist pages
 * (that artist's special cards). Read-only when `readOnly` (demo mode).
 */
export function ShowcaseSection({ scope, songs, readOnly }: {
  scope: ShowcaseScope; songs: MaplogSong[]; readOnly: boolean;
}) {
  const [rows, setRows] = useState<ShowcaseRow[]>(() => loadShowcaseRows(scope));
  const [picking, setPicking] = useState<{ rowId: string } | null>(null);
  const [addingLayout, setAddingLayout] = useState(false);
  const [, navigate] = useLocation();

  const pool = useMemo(
    () => eligibleCards(songs, scope.kind === 'artist' ? scope.artist : undefined),
    [songs, scope],
  );

  const commit = (next: ShowcaseRow[]) => {
    setRows(next);
    if (!saveShowcaseRows(scope, next)) toast.error("Couldn't save the showcase — storage is full.");
  };

  const addRow = (layout: ShowcaseLayout) => {
    const row: ShowcaseRow = { id: newRowId(), layout, cardIds: [] };
    commit([...rows, row]);
    setAddingLayout(false);
    setPicking({ rowId: row.id });
  };

  const removeRow = (rowId: string) => commit(rows.filter(r => r.id !== rowId));

  const toggleCard = (rowId: string, cardId: string) => {
    commit(rows.map(r => {
      if (r.id !== rowId) return r;
      if (r.cardIds.includes(cardId)) return { ...r, cardIds: r.cardIds.filter(id => id !== cardId) };
      if (r.cardIds.length >= LAYOUT_SLOTS[r.layout]) {
        toast.info(`This row holds up to ${LAYOUT_SLOTS[r.layout]} cards.`);
        return r;
      }
      return { ...r, cardIds: [...r.cardIds, cardId] };
    }));
  };

  if (pool.length === 0 && rows.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-6 text-center">
        <Sparkles className="w-8 h-8 text-white/15 mx-auto mb-3" />
        <p className="text-sm text-white/40 leading-relaxed">
          No special cards yet — epics, moments, lyrics, and radiants you collect can be displayed here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {rows.map(row => {
        const cards = resolveRow(row, songs);
        return (
          <div key={row.id} className="relative group/row">
            {!readOnly && (
              <div className="absolute -top-2 -right-2 z-30 flex gap-1.5">
                <button
                  className="w-7 h-7 rounded-full bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 active:scale-90 transition"
                  onClick={() => setPicking(p => p?.rowId === row.id ? null : { rowId: row.id })}
                  aria-label="Edit row cards" data-testid={`edit-row-${row.id}`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  className="w-7 h-7 rounded-full bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center text-white/60 hover:bg-red-500/40 active:scale-90 transition"
                  onClick={() => removeRow(row.id)}
                  aria-label="Remove row" data-testid={`remove-row-${row.id}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {cards.length === 0 ? (
              <button
                disabled={readOnly}
                onClick={() => setPicking({ rowId: row.id })}
                className="w-full rounded-[1.5rem] border-2 border-dashed border-white/10 py-8 text-sm font-bold text-white/30 hover:border-white/20 hover:text-white/50 transition"
              >
                Empty {row.layout} row — tap to pick cards
              </button>
            ) : (
              <RowLayout row={row} cards={cards} onOpen={ref => navigate(`/song/${encodeURIComponent(ref.song.id)}`)} />
            )}

            {/* Card picker for this row */}
            <AnimatePresence>
              {picking?.rowId === row.id && !readOnly && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 rounded-2xl bg-white/[0.03] border border-white/10 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2.5">
                      Pick up to {LAYOUT_SLOTS[row.layout]} · {row.cardIds.length} selected
                    </p>
                    <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
                      {pool.map(ref => {
                        const selected = row.cardIds.includes(ref.card.id);
                        return (
                          <button key={ref.card.id}
                            className={cn('relative shrink-0 rounded-xl transition ring-2', selected ? 'ring-primary' : 'ring-transparent opacity-70 hover:opacity-100')}
                            onClick={() => toggleCard(row.id, ref.card.id)}
                            data-testid={`pick-card-${ref.card.id}`}
                          >
                            <SoundmapCard card={ref.card} title={ref.song.title} artist={ref.song.artist} size="sm" />
                            {selected && (
                              <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-30">
                                <Check className="w-3 h-3 text-white" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      className="mt-2.5 text-xs font-bold text-primary"
                      onClick={() => setPicking(null)}
                      data-testid={`done-picking-${row.id}`}
                    >
                      Done
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Add-row control */}
      {!readOnly && (
        addingLayout ? (
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 space-y-1.5">
            {(Object.keys(LAYOUT_SLOTS) as ShowcaseLayout[]).map(l => (
              <button key={l}
                className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-white/5 text-sm font-bold text-white/80"
                onClick={() => addRow(l)} data-testid={`add-row-${l}`}
              >
                {LAYOUT_LABELS[l]}
              </button>
            ))}
            <button className="w-full text-center py-1.5 text-xs font-bold text-white/40" onClick={() => setAddingLayout(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3.5 flex items-center justify-center gap-2 text-sm font-bold text-white/60 hover:bg-white/[0.06] active:scale-[0.99] transition"
            onClick={() => setAddingLayout(true)} data-testid="add-showcase-row"
          >
            <Plus className="w-4 h-4" /> Add showcase row
          </button>
        )
      )}
    </div>
  );
}

/** Render one row per its layout. */
function RowLayout({ row, cards, onOpen }: {
  row: ShowcaseRow; cards: ShowcaseCardRef[]; onOpen: (ref: ShowcaseCardRef) => void;
}) {
  const cardBtn = (ref: ShowcaseCardRef, size: 'sm' | 'md' | 'lg') => (
    <button key={ref.card.id} className="active:scale-[0.97] transition-transform text-left"
      onClick={() => onOpen(ref)} aria-label={`Open ${ref.song.title}`}>
      <SoundmapCard card={ref.card} title={ref.song.title} artist={ref.song.artist} genre={ref.song.genre} size={size} />
    </button>
  );

  switch (row.layout) {
    case 'hero':
      return <div className="flex justify-center">{cards.slice(0, 1).map(r => cardBtn(r, 'lg'))}</div>;
    case 'duo':
      return <div className="grid grid-cols-2 gap-3 justify-items-center">{cards.slice(0, 2).map(r => cardBtn(r, 'md'))}</div>;
    case 'trio':
      return <div className="grid grid-cols-3 gap-2.5 justify-items-center">{cards.slice(0, 3).map(r => cardBtn(r, 'sm'))}</div>;
    case 'strip':
      return (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
          {cards.map(r => <div key={r.card.id} className="shrink-0">{cardBtn(r, 'sm')}</div>)}
        </div>
      );
  }
}
