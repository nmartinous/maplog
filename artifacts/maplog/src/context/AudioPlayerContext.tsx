import React, {
  createContext, useContext, useEffect, useReducer, useCallback, useRef,
} from 'react';
import type { MaplogSong } from '@/lib/types';

const DEMO_MODE_KEY = 'maplog:demoMode';

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
      return { ...state, currentSong: song, queue: q, queueIndex: idx, isPlaying: true, currentTime: 0, duration: 0, activeCardIndex: 0 };
    }
    case 'SET_PLAYING':          return { ...state, isPlaying: action.payload };
    case 'SET_TIME':             return { ...state, currentTime: action.payload };
    case 'SET_DURATION':         return { ...state, duration: action.payload };
    case 'SET_QUEUE':            return { ...state, queue: action.payload };
    case 'ENQUEUE':              return { ...state, queue: [...state.queue, action.payload] };
    case 'NEXT': {
      const next = state.queueIndex + 1;
      if (next >= state.queue.length) return { ...state, isPlaying: false };
      return { ...state, currentSong: state.queue[next], queueIndex: next, isPlaying: true, currentTime: 0, duration: 0, activeCardIndex: 0 };
    }
    case 'PREV': {
      if (state.currentTime > 3) return { ...state, currentTime: 0 };
      const prev = state.queueIndex - 1;
      if (prev < 0) return { ...state, currentTime: 0 };
      return { ...state, currentSong: state.queue[prev], queueIndex: prev, isPlaying: true, currentTime: 0, duration: 0, activeCardIndex: 0 };
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

// ── Provider ──────────────────────────────────────────────────────────────────

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Stable ref: whether we're in demo mode (no real audio source)
  const isDemoMode = useRef(localStorage.getItem(DEMO_MODE_KEY) === 'true');

  // ── HTML5 Audio (real Deezer preview mode) ───────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isDemoMode.current) return;

    const audio = new Audio();
    audio.preload = 'metadata';

    const onTimeUpdate = () => {
      dispatch({ type: 'SET_TIME', payload: audio.currentTime });
    };
    const onDuration = () => {
      if (!isNaN(audio.duration) && audio.duration > 0) {
        dispatch({ type: 'SET_DURATION', payload: audio.duration });
      }
    };
    const onPlay  = () => dispatch({ type: 'SET_PLAYING', payload: true });
    const onPause = () => dispatch({ type: 'SET_PLAYING', payload: false });
    const onEnded = () => {
      dispatch({ type: 'SET_PLAYING', payload: false });
      // auto-advance to next song in queue
      const s = stateRef.current;
      const next = s.queueIndex + 1;
      if (next < s.queue.length) {
        dispatch({ type: 'NEXT' });
        // The song-change effect will pick up the new currentSong and start playback
      }
    };
    const onError = (e: Event) => {
      console.warn('[AudioPlayer] preview load error', e);
      dispatch({ type: 'SET_PLAYING', payload: false });
    };

    audio.addEventListener('timeupdate',     onTimeUpdate);
    audio.addEventListener('loadedmetadata', onDuration);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('play',           onPlay);
    audio.addEventListener('pause',          onPause);
    audio.addEventListener('ended',          onEnded);
    audio.addEventListener('error',          onError);

    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      audio.removeEventListener('timeupdate',     onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onDuration);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('play',           onPlay);
      audio.removeEventListener('pause',          onPause);
      audio.removeEventListener('ended',          onEnded);
      audio.removeEventListener('error',          onError);
    };
  }, []);

  // When currentSong changes in real mode, load its preview URL and play
  useEffect(() => {
    if (isDemoMode.current) return;
    const audio = audioRef.current;
    if (!audio) return;

    const song = state.currentSong;
    if (!song) { audio.pause(); audio.src = ''; return; }

    if (song.previewUrl) {
      audio.src = song.previewUrl;
      if (state.isPlaying) {
        audio.play().catch(err => console.warn('[AudioPlayer] play() blocked:', err));
      }
    } else {
      // No preview available — advance queue or stop
      audio.src = '';
      dispatch({ type: 'SET_PLAYING', payload: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentSong?.id]);

  // ── Demo mode: interval-based simulated playback ─────────────────────────
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
        clearDemoTimer();
        dispatch({ type: 'NEXT' });
      } else {
        dispatch({ type: 'SET_TIME', payload: next });
      }
    }, 1000);
  }, [clearDemoTimer]);

  // Demo song change → reset duration and timer
  useEffect(() => {
    if (!isDemoMode.current) return;
    if (!state.currentSong) { clearDemoTimer(); return; }

    const dur = Math.round((state.currentSong.durationMs ?? 0) / 1000);
    dispatch({ type: 'SET_DURATION', payload: dur || 180 });
    dispatch({ type: 'SET_TIME', payload: 0 });
    if (state.isPlaying) startDemoTimer();
    return clearDemoTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentSong?.id]);

  // Demo play/pause toggle
  useEffect(() => {
    if (!isDemoMode.current) return;
    if (state.isPlaying) startDemoTimer();
    else clearDemoTimer();
  }, [state.isPlaying, startDemoTimer, clearDemoTimer]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const play = useCallback((song: MaplogSong, queue?: MaplogSong[]) => {
    dispatch({ type: 'PLAY_SONG', payload: { song, queue } });
    // Real mode: the currentSong useEffect handles loading + playing the audio
    // Demo mode: the demo timer useEffect handles it
  }, []);

  const pause = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', payload: false });
    if (!isDemoMode.current) audioRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', payload: true });
    if (!isDemoMode.current) {
      audioRef.current?.play().catch(err => console.warn('[AudioPlayer] resume blocked:', err));
    }
  }, []);

  const seek = useCallback((time: number) => {
    dispatch({ type: 'SET_TIME', payload: time });
    if (!isDemoMode.current && audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const skipNext = useCallback(() => {
    const s = stateRef.current;
    if (s.queueIndex + 1 >= s.queue.length) return;
    dispatch({ type: 'NEXT' });
  }, []);

  const skipPrev = useCallback(() => {
    const s = stateRef.current;
    if (s.currentTime > 3) { seek(0); return; }
    if (s.queueIndex - 1 < 0) { seek(0); return; }
    dispatch({ type: 'PREV' });
  }, [seek]);

  const setQueue           = useCallback((songs: MaplogSong[]) => dispatch({ type: 'SET_QUEUE',   payload: songs }), []);
  const enqueue            = useCallback((song: MaplogSong)    => dispatch({ type: 'ENQUEUE',      payload: song  }), []);
  const setActiveCardIndex = useCallback((i: number)           => dispatch({ type: 'SET_ACTIVE_CARD_INDEX', payload: i }), []);

  return (
    <PlayerContext.Provider
      value={{ ...state, play, pause, resume, seek, skipNext, skipPrev, setQueue, enqueue, setActiveCardIndex }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
