import React from 'react';
import { Link } from 'wouter';
import { useMusicKit } from '@/context/MusicKitContext';
import { ConflictQueue } from '@/components/ConflictQueue';
import { ArrowLeft } from 'lucide-react';

/** Standalone conflicts page — the queue also lives inside Edit Mode. */
export default function Conflicts() {
  const { conflicts } = useMusicKit();

  return (
    <div className="h-full overflow-y-auto bg-background pb-24">
      <div className="page-top px-4 sm:px-6 pb-8 space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0" aria-label="Back to Settings">
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-display font-black tracking-tight text-white">Conflicts</h1>
            <p className="text-sm text-white/50">
              {conflicts.length === 0
                ? 'Nothing to resolve'
                : `${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''} waiting for you`}
            </p>
          </div>
        </div>
        <ConflictQueue />
      </div>
    </div>
  );
}
