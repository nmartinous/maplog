import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback } from 'react';
import { Song } from '@workspace/api-client-react';

type PlayerState = {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: Song[];
  queueIndex: number;
  activeCardIndex: number; // for the swipeable view on Now Playing
};

type PlayerAction =
  | { type: 'PLAY_SONG'; payload: { song: Song; queue?: Song[] } }
  | { type: 'SET_PLAYING'; payload: boolean }
  | { type: 'SET_TIME'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_QUEUE'; payload: Song[] }
  | { type: 'ENQUEUE'; payload: Song }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'SET_ACTIVE_CARD_INDEX'; payload: number };

const initialState: PlayerState = {
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  queue: [],
  queueIndex: -1,
  activeCardIndex: 0,
};

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'PLAY_SONG': {
      const { song, queue } = action.payload;
      const newQueue = queue || state.queue;
      let newIndex = state.queueIndex;
      
      if (queue) {
        newIndex = queue.findIndex(s => s.id === song.id);
        if (newIndex === -1) {
          newQueue.unshift(song);
          newIndex = 0;
        }
      } else if (!state.queue.find(s => s.id === song.id)) {
        newQueue.push(song);
        newIndex = newQueue.length - 1;
      } else {
        newIndex = state.queue.findIndex(s => s.id === song.id);
      }

      return {
        ...state,
        currentSong: song,
        queue: newQueue,
        queueIndex: newIndex,
        isPlaying: true,
        activeCardIndex: 0, // reset card index on new song
      };
    }
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };
    case 'SET_TIME':
      return { ...state, currentTime: action.payload };
    case 'SET_DURATION':
      return { ...state, duration: action.payload };
    case 'SET_QUEUE':
      return { ...state, queue: action.payload };
    case 'ENQUEUE':
      return { ...state, queue: [...state.queue, action.payload] };
    case 'NEXT': {
      if (state.queue.length === 0 || state.queueIndex >= state.queue.length - 1) return state;
      const nextIndex = state.queueIndex + 1;
      return {
        ...state,
        currentSong: state.queue[nextIndex],
        queueIndex: nextIndex,
        isPlaying: true,
        activeCardIndex: 0,
      };
    }
    case 'PREV': {
      if (state.queue.length === 0 || state.queueIndex <= 0) {
        return { ...state, currentTime: 0, activeCardIndex: 0 };
      }
      const prevIndex = state.queueIndex - 1;
      return {
        ...state,
        currentSong: state.queue[prevIndex],
        queueIndex: prevIndex,
        isPlaying: true,
        activeCardIndex: 0,
      };
    }
    case 'SET_ACTIVE_CARD_INDEX':
      return { ...state, activeCardIndex: action.payload };
    default:
      return state;
  }
}

type PlayerContextType = PlayerState & {
  play: (song: Song, queue?: Song[]) => void;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  skipNext: () => void;
  skipPrev: () => void;
  setQueue: (songs: Song[]) => void;
  enqueue: (song: Song) => void;
  setActiveCardIndex: (index: number) => void;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(playerReducer, initialState);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audioRef.current = audio;

      audio.addEventListener('timeupdate', () => {
        dispatch({ type: 'SET_TIME', payload: audio.currentTime });
      });
      audio.addEventListener('loadedmetadata', () => {
        dispatch({ type: 'SET_DURATION', payload: audio.duration });
      });
      audio.addEventListener('ended', () => {
        dispatch({ type: 'NEXT' });
      });
      audio.addEventListener('play', () => dispatch({ type: 'SET_PLAYING', payload: true }));
      audio.addEventListener('pause', () => dispatch({ type: 'SET_PLAYING', payload: false }));
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (state.currentSong) {
      if (state.currentSong.audioUrl) {
        if (audio.src !== state.currentSong.audioUrl) {
          audio.src = state.currentSong.audioUrl;
          if (state.isPlaying) {
            audio.play().catch(e => console.error("Audio playback error:", e));
          }
        } else if (state.isPlaying && audio.paused) {
          audio.play().catch(e => console.error("Audio playback error:", e));
        } else if (!state.isPlaying && !audio.paused) {
          audio.pause();
        }
      } else {
        // No audio URL, act like a mock player
        audio.src = '';
      }
    }
  }, [state.currentSong, state.isPlaying]);

  const play = useCallback((song: Song, queue?: Song[]) => {
    dispatch({ type: 'PLAY_SONG', payload: { song, queue } });
  }, []);

  const pause = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', payload: false });
  }, []);

  const resume = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', payload: true });
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current && audioRef.current.src) {
      audioRef.current.currentTime = time;
    }
    dispatch({ type: 'SET_TIME', payload: time });
  }, []);

  const skipNext = useCallback(() => {
    dispatch({ type: 'NEXT' });
  }, []);

  const skipPrev = useCallback(() => {
    dispatch({ type: 'PREV' });
  }, []);

  const setQueue = useCallback((songs: Song[]) => {
    dispatch({ type: 'SET_QUEUE', payload: songs });
  }, []);

  const enqueue = useCallback((song: Song) => {
    dispatch({ type: 'ENQUEUE', payload: song });
  }, []);

  const setActiveCardIndex = useCallback((index: number) => {
    dispatch({ type: 'SET_ACTIVE_CARD_INDEX', payload: index });
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        ...state,
        play,
        pause,
        resume,
        seek,
        skipNext,
        skipPrev,
        setQueue,
        enqueue,
        setActiveCardIndex,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
}
