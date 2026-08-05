import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MaplogSong } from '@/lib/types';

export function CardBackInfo({ trackId, song }: { trackId: string; song: MaplogSong }) {
  const isApple = song.source === 'apple';
  const { data, isLoading, error } = useQuery({
    queryKey: ['track-info', isApple ? 'apple' : 'deezer', trackId],
    queryFn: async () => {
      const res = await fetch(isApple ? `/api/apple-music/song/${trackId}` : `/api/deezer/track/${trackId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  return (
    <div className="w-full h-full flex flex-col p-6 items-center justify-center text-center gap-4 relative">
       {/* Background subtle art */}
       <div className="absolute inset-0 opacity-20 bg-cover bg-center blur-2xl scale-125" style={{ backgroundImage: `url(${song.artworkUrl})` }} />
       <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black/95" />
       
       <div className="relative z-10 w-full flex flex-col items-center h-full justify-center">
         <h3 className="font-display font-black text-2xl sm:text-3xl mb-1 text-white truncate w-full px-2">{song.title}</h3>
         <p className="text-primary font-bold text-sm sm:text-base mb-8 truncate w-full">{song.artist}</p>
         
         {isLoading ? (
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin my-auto" />
         ) : error ? (
            <p className="text-xs text-white/50 my-auto">Details unavailable</p>
         ) : data ? (
            <div className="grid grid-cols-2 gap-y-6 gap-x-4 w-full px-4 text-left">
               <div className="flex flex-col">
                 <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Album</span>
                 <span className="text-xs sm:text-sm font-semibold text-white/90 truncate leading-tight">{data.album?.title || 'Single'}</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Released</span>
                 <span className="text-xs sm:text-sm font-semibold text-white/90">{data.release_date || 'Unknown'}</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Duration</span>
                 <span className="text-xs sm:text-sm font-semibold text-white/90">
                   {data.duration ? `${Math.floor(data.duration / 60)}:${String(data.duration % 60).padStart(2, '0')}` : '0:00'}
                 </span>
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">BPM</span>
                 <span className="text-xs sm:text-sm font-semibold text-white/90">{data.bpm ? Math.round(data.bpm) : '--'}</span>
               </div>
               {song.genre && (
                 <div className="flex flex-col col-span-2">
                   <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Genre</span>
                   <span className="text-xs sm:text-sm font-semibold text-white/90 truncate">{song.genre}</span>
                 </div>
               )}
            </div>
         ) : null}
       </div>
    </div>
  );
}
