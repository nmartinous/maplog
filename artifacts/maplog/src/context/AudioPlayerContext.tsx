import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react';
import type { MaplogSong } from '@/lib/types';

const DEMO_MODE_KEY = 'maplog:demoMode';
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
      const q = newQueue ? [...newQueue] : [...state.queue];
      let idx = q.findIndex(s => s.id === song.id);
      if (idx === -1) { q.push(song); idx = q.length - 1; }
      return { ...state, currentSong: song, queue: q, queueIndex: idx, isPlaying: true, currentTime: 0, activeCardIndex: 0 };
    }
    case 'SET_PLAYING':          return { ...state, isPlaying: action.payload };
    case 'SET_TIME':             return { ...state, currentTime: action.payload };
    case 'SET_DURATION':         return { ...state, duration: action.payload };
    case 'SET_QUEUE':            return { ...state, queue: action.payload };
    case 'ENQUEUE':              return { ...state, queue: [...state.queue, action.payload] };
    case 'NEXT': {
      const next = state.queueIndex + 1;
      if (next >= state.queue.length) return { ...state, isPlaying: false };
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

// ── MusicKit helpers ──────────────────────────────────────────────────────────

function getMusicKit(): MusicKit.MusicKitInstance | null {
  try { return window.MusicKit?.getInstance() ?? null; }
  catch { return null; }
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

  // Whether we're in demo mode — read once at mount, stable for the session
  const isDemoMode = useRef(localStorage.getItem(DEMO_MODE_KEY) === 'true');

  // Demo mode: interval-based simulated playback
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearDemoTimer = useCallback(() => {
    if (demoTimerRef.current !== null) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }
  }, []);

  const startDemoTimer = useCallback(() => {
    clearDemoTimer();
    demoTimerRef.current = setInterval(() => {
      const s = stateRef.current;
      if (!s.isPlaying) return;
      const next = s.currentTime + 1;
      if (s.duration > 0 && next >= s.duration) {
        // Song finished — advance queue
        clearDemoTimer();
        dispatch({ type: 'NEXT' });
      } else {
        dispatch({ type: 'SET_TIME', payload: next });
      }
    }, 1000);
  }, [clearDemoTimer]);

  // When demo mode song changes, set duration and start timer
  useEffect(() => {
    if (!isDemoMode.current) return;
    if (!state.currentSong) { clearDemoTimer(); return; }

    const dur = Math.round((state.currentSong.durationMs ?? 0) / 1000);
    dispatch({ type: 'SET_DURATION', payload: dur || 180 });
    dispatch({ type: 'SET_TIME', payload: 0 });

    if (state.isPlaying) {
      startDemoTimer();
    }

    return clearDemoTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentSong?.id]);

  // Pause/resume in demo mode
  useEffect(() => {
    if (!isDemoMode.current) return;
    if (state.isPlaying) {
      startDemoTimer();
    } else {
      clearDemoTimer();
    }
  }, [state.isPlaying, startDemoTimer, clearDemoTimer]);

  // ── Wire MusicKit events → React state (real mode only) ─────────────────
  useEffect(() => {
    if (isDemoMode.current) return;

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

    if (!setup()) {
      const id = setInterval(() => { if (setup()) clearInterval(id); }, 500);
      return () => { clearInterval(id); cleanup?.(); };
    }
    return () => cleanup?.();
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const play = useCallback((song: MaplogSong, queue?: MaplogSong[]) => {
    dispatch({ type: 'PLAY_SONG', payload: { song, queue } });
    if (!isDemoMode.current) mkPlay(song.id);
    // Demo timer starts via the useEffect watching currentSong.id
  }, []);

  const pause = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', payload: false });
    if (!isDemoMode.current) getMusicKit()?.pause();
  }, []);

  const resume = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', payload: true });
    if (!isDemoMode.current) getMusicKit()?.play().catch(console.error);
  }, []);

  const seek = useCallback((time: number) => {
    dispatch({ type: 'SET_TIME', payload: time });
    if (!isDemoMode.current) getMusicKit()?.seekToTime(time).catch(console.error);
  }, []);

  const skipNext = useCallback(() => {
    const s = stateRef.current;
    const next = s.queueIndex + 1;
    if (next >= s.queue.length) return;
    dispatch({ type: 'NEXT' });
    if (!isDemoMode.current) mkPlay(s.queue[next].id);
  }, []);

  const skipPrev = useCallback(() => {
    const s = stateRef.current;
    if (s.currentTime > 3) { seek(0); return; }
    const prev = s.queueIndex - 1;
    if (prev < 0) { seek(0); return; }
    dispatch({ type: 'PREV' });
    if (!isDemoMode.current) mkPlay(s.queue[prev].id);
  }, [seek]);

  const setQueue          = useCallback((songs: MaplogSong[]) => dispatch({ type: 'SET_QUEUE', payload: songs }), []);
  const enqueue           = useCallback((song: MaplogSong)    => dispatch({ type: 'ENQUEUE', payload: song }), []);
  const setActiveCardIndex = useCallback((i: number)          => dispatch({ type: 'SET_ACTIVE_CARD_INDEX', payload: i }), []);

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
