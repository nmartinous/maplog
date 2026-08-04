import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react';
import type { MaplogSong } from '@/lib/types';

// MusicKit PlaybackState.playing === 2
const MK_PLAYING = 2;

// ── State / Reducer ───────────────────────────────────────────────────────────

type PlayerState = {
  currentSong: MaplogSong | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: MaplogSong[];
  queueIndex: number;
  activeCardIndex: number;
};

type PlayerAction =
  | { type: 'PLAY_SONG'; payload: { song: MaplogSong; queue?: MaplogSong[] } }
  | { type: 'SET_PLAYING'; payload: boolean }
  | { type: 'SET_TIME'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_QUEUE'; payload: MaplogSong[] }
  | { type: 'ENQUEUE'; payload: MaplogSong }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'SET_ACTIVE_CARD_INDEX'; payload: number };

const initial: PlayerState = {
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  queue: [],
  queueIndex: -1,
  activeCardIndex: 0,
};

function reducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'PLAY_SONG': {
      const { song, queue: newQueue } = action.payload;
      const q = newQueue ?? state.queue;
      let idx = q.findIndex(s => s.id === song.id);
      if (idx === -1) { q.push(song); idx = q.length - 1; }
      return { ...state, currentSong: song, queue: q, queueIndex: idx, isPlaying: true, currentTime: 0, activeCardIndex: 0 };
    }
    case 'SET_PLAYING':     return { ...state, isPlaying: action.payload };
    case 'SET_TIME':        return { ...state, currentTime: action.payload };
    case 'SET_DURATION':    return { ...state, duration: action.payload };
    case 'SET_QUEUE':       return { ...state, queue: action.payload };
    case 'ENQUEUE':         return { ...state, queue: [...state.queue, action.payload] };
    case 'NEXT': {
      const next = state.queueIndex + 1;
      if (next >= state.queue.length) return state;
      return { ...state, currentSong: state.queue[next], queueIndex: next, isPlaying: true, currentTime: 0, activeCardIndex: 0 };
    }
    case 'PREV': {
      if (state.currentTime > 3) return { ...state, currentTime: 0 };
      const prev = state.queueIndex - 1;
      if (prev < 0) return { ...state, currentTime: 0 };
      return { ...state, currentSong: state.queue[prev], queueIndex: prev, isPlaying: true, currentTime: 0, activeCardIndex: 0 };
    }
    case 'SET_ACTIVE_CARD_INDEX': return { ...state, activeCardIndex: action.payload };
    default: return state;
  }
}

// ── Context type ──────────────────────────────────────────────────────────────

type PlayerContextType = PlayerState & {
  play: (song: MaplogSong, queue?: MaplogSong[]) => void;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  skipNext: () => void;
  skipPrev: () => void;
  setQueue: (songs: MaplogSong[]) => void;
  enqueue: (song: MaplogSong) => void;
  setActiveCardIndex: (index: number) => void;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMusicKit(): MusicKit.MusicKitInstance | null {
  return window.MusicKit?.getInstance() ?? null;
}

async function mkPlay(songId: string) {
  const m = getMusicKit();
  if (!m) return;
  try {
    await m.setQueue({ song: songId });
    await m.play();
  } catch (e) {
    console.error('[MusicKit] play error:', e);
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Wire MusicKit playback events → React state ──────────────────────────
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    const setup = () => {
      const m = getMusicKit();
      if (!m) return false;

      const onTime = () => {
        dispatch({ type: 'SET_TIME', payload: m.currentPlaybackTime });
        if (m.currentPlaybackDuration > 0) {
          dispatch({ type: 'SET_DURATION', payload: m.currentPlaybackDuration });
        }
      };

      const onState = () => {
        const playing = m.playbackState === MK_PLAYING;
        dispatch({ type: 'SET_PLAYING', payload: playing });
        // Auto-advance: MusicKit ended (5) → move to next in our queue
        if (m.playbackState === 5) {
          const s = stateRef.current;
          const next = s.queueIndex + 1;
          if (next < s.queue.length) {
            dispatch({ type: 'NEXT' });
            mkPlay(s.queue[next].id);
          }
        }
      };

      m.addEventListener('playbackTimeDidChange', onTime);
      m.addEventListener('playbackStateDidChange', onState);

      cleanup = () => {
        m.removeEventListener('playbackTimeDidChange', onTime);
        m.removeEventListener('playbackStateDidChange', onState);
      };
      return true;
    };

    // MusicKit loads asynchronously from CDN; retry until ready
    if (!setup()) {
      const id = setInterval(() => { if (setup()) clearInterval(id); }, 500);
      return () => { clearInterval(id); cleanup?.(); };
    }
    return () => cleanup?.();
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const play = useCallback((song: MaplogSong, queue?: MaplogSong[]) => {
    dispatch({ type: 'PLAY_SONG', payload: { song, queue } });
    mkPlay(song.id);
  }, []);

  const pause = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', payload: false });
    getMusicKit()?.pause();
  }, []);

  const resume = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', payload: true });
    getMusicKit()?.play().catch(console.error);
  }, []);

  const seek = useCallback((time: number) => {
    dispatch({ type: 'SET_TIME', payload: time });
    getMusicKit()?.seekToTime(time).catch(console.error);
  }, []);

  const skipNext = useCallback(() => {
    const s = stateRef.current;
    const next = s.queueIndex + 1;
    if (next >= s.queue.length) return;
    dispatch({ type: 'NEXT' });
    mkPlay(s.queue[next].id);
  }, []);

  const skipPrev = useCallback(() => {
    const s = stateRef.current;
    // If >3 s into the song, restart it instead of going back
    if (s.currentTime > 3) {
      seek(0);
      return;
    }
    const prev = s.queueIndex - 1;
    if (prev < 0) { seek(0); return; }
    dispatch({ type: 'PREV' });
    mkPlay(s.queue[prev].id);
  }, [seek]);

  const setQueue   = useCallback((songs: MaplogSong[]) => dispatch({ type: 'SET_QUEUE', payload: songs }), []);
  const enqueue    = useCallback((song: MaplogSong)    => dispatch({ type: 'ENQUEUE', payload: song }), []);
  const setActiveCardIndex = useCallback((i: number)   => dispatch({ type: 'SET_ACTIVE_CARD_INDEX', payload: i }), []);

  return (
    <PlayerContext.Provider value={{ ...state, play, pause, resume, seek, skipNext, skipPrev, setQueue, enqueue, setActiveCardIndex }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
