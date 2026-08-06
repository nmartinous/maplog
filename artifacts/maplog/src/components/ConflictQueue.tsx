import React from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import { conflictLine } from '@/lib/conflicts';
import { Button } from '@/components/ui/button';
import { Copy, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Conflict queue — copies pulled out of the collection during import because
 * they broke tag rules. Shared by the /conflicts page and Edit Mode.
 */
export function ConflictQueue() {
  const { conflicts, resolveConflict } = useMusicKit();

  const copyAll = async () => {
    const text = conflicts.map(conflictLine).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Conflict list copied.');
    } catch {
      toast.error('Could not copy — long-press to select the text instead.');
    }
  };

  return (
    <div className="space-y-6">
      {conflicts.length > 0 && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-200/80 leading-relaxed">
              These copies broke the collection rules, so both were removed. The best fix is
              in Apple Music: put each track in the right playlists, then refresh again —
              or keep one copy below.
            </p>
            <Button variant="outline" size="sm" onClick={copyAll}
              className="rounded-full bg-white/5 border-white/10 hover:bg-white/10 text-white text-xs font-bold h-8 mt-2">
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy list
            </Button>
          </div>
        </div>
      )}

      {conflicts.length === 0 && (
        <div className="glass-panel rounded-[2rem] px-6 py-12 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-green-500/80 mx-auto" />
          <p className="font-display font-bold text-lg text-white">All clear</p>
          <p className="text-sm text-white/50">New conflicts found during a playlist refresh will show up here.</p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {conflicts.map(c => (
          <motion.div key={c.id}
            layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ duration: 0.25 }}
            className="glass-panel rounded-[2rem] overflow-hidden"
          >
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-lg border border-white/10 bg-white/5">
                  {c.artworkUrl && <img src={c.artworkUrl} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-base text-white truncate leading-tight">{c.title}</p>
                  <p className="text-sm text-white/50 truncate">{c.artist}</p>
                  <p className="text-xs text-amber-300/80 mt-1">{c.reason}</p>
                </div>
              </div>

              <div className="space-y-2">
                {c.copies.map(cp => (
                  <div key={cp.card.id} className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                    <span className="flex-1 text-sm font-bold text-white">{cp.label}</span>
                    <Button size="sm"
                      className="rounded-full font-bold h-8 px-4 text-xs"
                      onClick={() => { resolveConflict(c.id, cp.card.id); toast.success(`Kept the ${cp.label} copy of "${c.title}".`); }}>
                      Keep this one
                    </Button>
                  </div>
                ))}
              </div>

              <Button variant="ghost" size="sm"
                className="rounded-full text-white/40 hover:text-destructive hover:bg-destructive/10 text-xs font-bold h-9"
                onClick={() => { resolveConflict(c.id, null); toast.info(`Discarded all copies of "${c.title}". Refresh playlists to re-import.`); }}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Discard all copies
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
