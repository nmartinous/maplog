import React, {
  createContext, useContext, useEffect, useReducer, useCallback, useRef, useState,
} from 'react';
import type { MaplogSong } from '@/lib/types';
import { initMusicKit } from '@/lib/musicKit';
import { useMusicKit } from '@/context/MusicKitContext';

const PREFS_KEY = 'maplog:playerPrefs';
const HISTORY_KEY = 'maplog:recentlyPlayed';
const HISTORY_MAX = 10;

function loadHistory(): MaplogSong[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, HISTORY_MAX) : [];
  } catch { return []; }
}

/** Prepend a finished song to history (dedup, cap at HISTORY_MAX). */
function pushHistory(history: MaplogSong[], song: MaplogSong | null, nextId?: string): MaplogSong[] {
  if (!song || song.id === nextId) return history;
  return [song, ...history.filter(x => x.id !== song.id)].slice(0, HISTORY_MAX);
}

// ── Player preferences (persisted) ───────────────────────────────────────────

export type RepeatMode = 'off' | 'all' | 'one';

type PlayerPrefs = { shuffle: boolean; repeat: RepeatMode; autoplay: boolean };

function loadPrefs(): PlayerPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        shuffle: p.shuffle === true,
        repeat: p.repeat === 'all' || p.repeat === 'one' ? p.repeat : 'off',
        autoplay: p.autoplay !== false, // default on
      };
    }
  } catch { /* corrupted prefs — use defaults */ }
  return { shuffle: false, repeat: 'off', autoplay: true };
}

function savePrefs(p: PlayerPrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* noop */ }
}

/** Fisher–Yates shuffle (copy) */
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── State / Reducer ───────────────────────────────────────────────────────────

type PlayerState = {
  currentSong: MaplogSong | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: MaplogSong[];
  queueIndex: number;
  activeCardIndex: number;
  shuffle: boolean;
  repeat: RepeatMode;
  autoplay: boolean;
  /** Unshuffled queue order, kept while shuffle is on */
  originalQueue: MaplogSong[] | null;
  /** Last 10 songs that finished (or were skipped past), most recent first */
  history: MaplogSong[];
  /** Pre-picked random song autoplay will play when the queue runs out */
  autoplayNext: MaplogSong | null;
};

type PlayerAction =
  | { type: 'PLAY_SONG'; payload: { song: MaplogSong; queue?: MaplogSong[]; originalQueue?: MaplogSong[] | null } }
  | { type: 'SET_PLAYING'; payload: boolean }
  | { type: 'SET_TIME'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_QUEUE'; payload: MaplogSong[] }
  | { type: 'ENQUEUE'; payload: MaplogSong }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'SET_ACTIVE_CARD_INDEX'; payload: number }
  | { type: 'APPLY_QUEUE_ORDER'; payload: { queue: MaplogSong[]; queueIndex: number; shuffle: boolean; originalQueue: MaplogSong[] | null } }
  | { type: 'SET_REPEAT'; payload: RepeatMode }
  | { type: 'SET_AUTOPLAY'; payload: boolean }
  | { type: 'SET_AUTOPLAY_NEXT'; payload: MaplogSong | null }
  | { type: 'LOG_CURRENT_TO_HISTORY' };

const prefs = loadPrefs();

const initial: PlayerState = {
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  queue: [],
  queueIndex: -1,
  activeCardIndex: 0,
  shuffle: prefs.shuffle,
  repeat: prefs.repeat,
  autoplay: prefs.autoplay,
  originalQueue: null,
  history: loadHistory(),
  autoplayNext: null,
};

function reducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'PLAY_SONG': {
      const { song, queue: newQueue, originalQueue } = action.payload;
      const q = newQueue ? [...newQueue] : [...state.queue];
      let idx = q.findIndex(s => s.id === song.id);
      if (idx === -1) { q.push(song); idx = q.length - 1; }
      return {
        ...state, currentSong: song, queue: q, queueIndex: idx, isPlaying: true,
        currentTime: 0, duration: 0, activeCardIndex: 0,
        originalQueue: newQueue ? (originalQueue ?? null) : state.originalQueue,
        history: pushHistory(state.history, state.currentSong, song.id),
        autoplayNext: state.autoplayNext?.id === song.id ? null : state.autoplayNext,
      };
    }
    case 'SET_PLAYING':          return { ...state, isPlaying: action.payload };
    case 'SET_TIME':             return { ...state, currentTime: action.payload };
    case 'SET_DURATION':         return { ...state, duration: action.payload };
    case 'SET_QUEUE':            return { ...state, queue: action.payload, originalQueue: null };
    case 'ENQUEUE':              return {
      ...state,
      queue: [...state.queue, action.payload],
      originalQueue: state.originalQueue ? [...state.originalQueue, action.payload] : null,
    };
    case 'NEXT': {
      let next = state.queueIndex + 1;
      if (next >= state.queue.length) {
        if (state.repeat === 'all' && state.queue.length > 0) next = 0;
        else return { ...state, isPlaying: false };
      }
      const nextSong = state.queue[next];
      return {
        ...state, currentSong: nextSong, queueIndex: next, isPlaying: true, currentTime: 0, duration: 0, activeCardIndex: 0,
        history: pushHistory(state.history, state.currentSong, nextSong.id),
        autoplayNext: state.autoplayNext?.id === nextSong.id ? null : state.autoplayNext,
      };
    }
    case 'PREV': {
      if (state.currentTime > 3) return { ...state, currentTime: 0 };
      const prev = state.queueIndex - 1;
      if (prev < 0) return { ...state, currentTime: 0 };
      return { ...state, currentSong: state.queue[prev], queueIndex: prev, isPlaying: true, currentTime: 0, duration: 0, activeCardIndex: 0 };
    }
    case 'SET_ACTIVE_CARD_INDEX': return { ...state, activeCardIndex: action.payload };
    case 'APPLY_QUEUE_ORDER': {
      const { queue, queueIndex, shuffle, originalQueue } = action.payload;
      return { ...state, queue, queueIndex, shuffle, originalQueue };
    }
    case 'SET_REPEAT':   return { ...state, repeat: action.payload };
    case 'SET_AUTOPLAY': return { ...state, autoplay: action.payload };
    case 'SET_AUTOPLAY_NEXT': return { ...state, autoplayNext: action.payload };
    case 'LOG_CURRENT_TO_HISTORY': return { ...state, history: pushHistory(state.history, state.currentSong) };
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
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleAutoplay: () => void;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Collection access for autoplay's "random song when the queue runs out"
  const { songs: collectionSongs } = useMusicKit();
  const collectionRef = useRef(collectionSongs);
  collectionRef.current = collectionSongs;

  // ── MusicKit (full-song playback for Apple-sourced songs) ────────────────
  const mkRef = useRef<any | null>(null);
  // Whether the *current* song is being played through MusicKit
  const mkActiveRef = useRef(false);
  // Monotonic id so only the latest song-change async flow may touch MusicKit
  const playReqRef = useRef(0);
  // True while a track change is switching MusicKit queues. During that window
  // 'stopped'/'paused' events belong to the *old* track (mk.stop() fires them
  // asynchronously) and must not clobber the play intent of the new track —
  // that race made skips/rewinds silently fail to start playback.
  const mkTransitionRef = useRef(false);
  // Bumped when MusicKit becomes ready or auth changes, to re-route playback
  const [mkTick, setMkTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const listeners: Array<[string, () => void]> = [];

    initMusicKit()
      .then((mk) => {
        if (cancelled) return;
        mkRef.current = mk;
        setMkTick(t => t + 1);
        const onAuth = () => setMkTick(t => t + 1);
        mk.addEventListener('authorizationStatusDidChange', onAuth);
        listeners.push(['authorizationStatusDidChange', onAuth]);
        const MK = (window as any).MusicKit;

        const onTime = () => {
          if (!mkActiveRef.current) return;
          dispatch({ type: 'SET_TIME', payload: mk.currentPlaybackTime ?? 0 });
          const dur = mk.currentPlaybackDuration;
          if (dur && dur > 0 && Math.abs(dur - stateRef.current.duration) > 0.5) {
            dispatch({ type: 'SET_DURATION', payload: dur });
          }
        };
        const onState = () => {
          if (!mkActiveRef.current) return;
          const ps = mk.playbackState;
          const S = MK?.PlaybackStates ?? MK?.PlaybackState ?? {};
          if (ps === S.playing) dispatch({ type: 'SET_PLAYING', payload: true });
          else if (ps === S.paused || ps === S.stopped) {
            // Ignore stale stop/pause events emitted while switching tracks
            if (mkTransitionRef.current) return;
            dispatch({ type: 'SET_PLAYING', payload: false });
          }
          else if (ps === S.ended || ps === S.completed) {
            if (mkTransitionRef.current) return;
            handleTrackEnd('musickit');
          }
        };
        mk.addEventListener('playbackTimeDidChange', onTime);
        mk.addEventListener('playbackStateDidChange', onState);
        listeners.push(['playbackTimeDidChange', onTime], ['playbackStateDidChange', onState]);
      })
      .catch(() => { /* preview fallback handles playback */ });

    return () => {
      cancelled = true;
      const mk = mkRef.current;
      if (mk) for (const [ev, fn] of listeners) mk.removeEventListener(ev, fn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── HTML5 Audio (30-second preview fallback) ─────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Shared end-of-track behavior for all engines: respects autoplay,
  // repeat-one, repeat-all (queue wrap handled by the NEXT reducer).
  const handleTrackEnd = useCallback((engine: 'musickit' | 'html5') => {
    const s = stateRef.current;
    if (s.repeat === 'one') {
      // Restart the same track on the active engine
      if (engine === 'musickit') {
        const mk = mkRef.current;
        try {
          mk?.seekToTime?.(0);
          mk?.play()?.catch?.(() => { /* noop */ });
        } catch { /* noop */ }
        dispatch({ type: 'SET_TIME', payload: 0 });
      } else {
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch(() => { /* noop */ });
        }
        dispatch({ type: 'SET_TIME', payload: 0 });
      }
      return;
    }
    // Always advance through the remaining queue; repeat-all wraps around.
    const hasNext = s.queueIndex + 1 < s.queue.length;
    if (hasNext || (s.repeat === 'all' && s.queue.length > 0)) {
      dispatch({ type: 'NEXT' });
      return;
    }
    // Queue expended: autoplay plays the pre-picked random song (shown in the
    // queue sheet), otherwise playback stops.
    if (s.autoplay) {
      const pool = collectionRef.current.filter(x => x.id !== s.currentSong?.id);
      const pick = s.autoplayNext
        ?? (pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null);
      if (pick) {
        dispatch({ type: 'PLAY_SONG', payload: { song: pick } });
        return;
      }
    }
    dispatch({ type: 'LOG_CURRENT_TO_HISTORY' });
    dispatch({ type: 'SET_PLAYING', payload: false });
    dispatch({ type: 'SET_TIME', payload: 0 });
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    // iOS requires the <audio> element to be attached to the DOM for the
    // background media session to remain active when the app is backgrounded
    // or the screen is locked. Appending it hidden keeps it alive.
    audio.style.position = 'absolute';
    audio.style.width = '0';
    audio.style.height = '0';
    audio.style.opacity = '0';
    audio.setAttribute('playsinline', '');
    document.body.appendChild(audio);

    const onTimeUpdate = () => {
      dispatch({ type: 'SET_TIME', payload: audio.currentTime });
    };
    const onDuration = () => {
      if (!isNaN(audio.duration) && audio.duration > 0) {
        dispatch({ type: 'SET_DURATION', payload: audio.duration });
      }
    };
    const onPlay  = () => dispatch({ type: 'SET_PLAYING', payload: true });
    const onPause = () => {
      // 'pause' also fires on 'ended' and when swapping src — let those flows decide
      if (audio.ended) return;
      dispatch({ type: 'SET_PLAYING', payload: false });
    };
    const onEnded = () => handleTrackEnd('html5');
    const onError = (e: Event) => {
      // Ignore errors from clearing src (empty-string load aborts)
      if (!audio.src || audio.src === window.location.href) return;
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
      // Remove the element we appended for iOS background session
      try { document.body.removeChild(audio); } catch { /* already removed */ }
    };
  }, [handleTrackEnd]);

  // When currentSong changes (or MusicKit becomes ready/authed),
  // route to MusicKit (full songs) or the HTML5 preview player
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const song = state.currentSong;
    const mk = mkRef.current;
    const reqId = ++playReqRef.current;

    // Capture play intent NOW — async engine events (e.g. the stopped event
    // from mk.stop() below) must not be able to cancel this track change.
    const shouldPlay = stateRef.current.isPlaying;

    // Stop whichever engine was previously active
    if (mkActiveRef.current && mk) {
      mkTransitionRef.current = true;
      try { mk.stop(); } catch { /* noop */ }
    }
    mkActiveRef.current = false;

    if (!song) { mkTransitionRef.current = false; audio.pause(); audio.src = ''; return; }

    // Full-song playback via MusicKit for Apple-sourced songs when authorized
    if (song.source === 'apple' && mk?.isAuthorized) {
      audio.pause();
      audio.src = '';
      mkActiveRef.current = true;
      mkTransitionRef.current = true;
      dispatch({ type: 'SET_DURATION', payload: (song.durationMs ?? 0) / 1000 });
      (async () => {
        try {
          await mk.setQueue({ songs: [song.id.replace(/^apple:/, '')] });
          if (playReqRef.current !== reqId) return; // superseded by a newer song change
          if (shouldPlay) await mk.play();
          if (playReqRef.current === reqId) mkTransitionRef.current = false;
        } catch (err) {
          if (playReqRef.current !== reqId) return;
          mkTransitionRef.current = false;
          console.warn('[AudioPlayer] MusicKit playback failed, falling back to preview:', err);
          mkActiveRef.current = false;
          if (song.previewUrl) {
            audio.src = song.previewUrl;
            if (shouldPlay || stateRef.current.isPlaying) {
              audio.play().catch(e => console.warn('[AudioPlayer] play() blocked:', e));
            }
          } else {
            dispatch({ type: 'SET_PLAYING', payload: false });
          }
        }
      })();
      return;
    }

    mkTransitionRef.current = false;

    if (song.previewUrl) {
      // Avoid restarting the preview if it's already the active source
      // (mkTick can retrigger this effect mid-playback)
      const alreadyPlayingThis = audio.src === song.previewUrl && !audio.paused;
      if (!alreadyPlayingThis) {
        audio.src = song.previewUrl;
        if (shouldPlay) {
          audio.play().catch(err => console.warn('[AudioPlayer] play() blocked:', err));
        }
      }
    } else {
      // No preview available — advance queue or stop
      audio.src = '';
      dispatch({ type: 'SET_PLAYING', payload: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentSong?.id, mkTick]);

  // ── Recently played persistence ───────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history)); } catch { /* noop */ }
  }, [state.history]);

  // ── Autoplay preview: pre-pick the random song shown as "up next" when the
  //    queue is about to run out (only when nothing else would play) ─────────
  useEffect(() => {
    const s = stateRef.current;
    const upcomingEmpty = s.queueIndex >= s.queue.length - 1;
    const eligible = s.autoplay && !!s.currentSong && upcomingEmpty && s.repeat !== 'all';
    if (eligible) {
      const pool = collectionSongs.filter(x => x.id !== s.currentSong!.id);
      const stale = !s.autoplayNext
        || s.autoplayNext.id === s.currentSong!.id
        || !pool.some(x => x.id === s.autoplayNext!.id);
      if (stale) {
        dispatch({
          type: 'SET_AUTOPLAY_NEXT',
          payload: pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null,
        });
      }
    } else if (s.autoplayNext) {
      dispatch({ type: 'SET_AUTOPLAY_NEXT', payload: null });
    }
  }, [state.autoplay, state.currentSong?.id, state.queueIndex, state.queue.length, state.repeat, collectionSongs]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const play = useCallback((song: MaplogSong, queue?: MaplogSong[]) => {
    const s = stateRef.current;
    if (queue && s.shuffle) {
      // Shuffle is on: play the chosen song first, shuffle the rest
      const rest = queue.filter(x => x.id !== song.id);
      dispatch({
        type: 'PLAY_SONG',
        payload: { song, queue: [song, ...shuffled(rest)], originalQueue: [...queue] },
      });
      return;
    }
    dispatch({ type: 'PLAY_SONG', payload: { song, queue } });
  }, []);

  const pause = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', payload: false });
    if (mkActiveRef.current) mkRef.current?.pause();
    else audioRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', payload: true });
    if (mkActiveRef.current) {
      mkRef.current?.play()?.catch?.((err: unknown) => console.warn('[AudioPlayer] resume blocked:', err));
    } else {
      audioRef.current?.play().catch(err => console.warn('[AudioPlayer] resume blocked:', err));
    }
  }, []);

  const seek = useCallback((time: number) => {
    dispatch({ type: 'SET_TIME', payload: time });
    if (mkActiveRef.current) {
      mkRef.current?.seekToTime?.(time);
    } else if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const skipNext = useCallback(() => {
    const s = stateRef.current;
    if (s.queueIndex + 1 >= s.queue.length && s.repeat !== 'all') {
      // Queue expended: with autoplay on, skipping plays the pre-picked
      // autoplay song (the same one shown in the queue sheet).
      if (s.autoplay) {
        const pool = collectionRef.current.filter(x => x.id !== s.currentSong?.id);
        const pick = s.autoplayNext
          ?? (pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null);
        if (pick) dispatch({ type: 'PLAY_SONG', payload: { song: pick } });
      }
      return;
    }
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

  const persistPrefs = useCallback((partial: Partial<PlayerPrefs>) => {
    const s = stateRef.current;
    savePrefs({ shuffle: s.shuffle, repeat: s.repeat, autoplay: s.autoplay, ...partial });
  }, []);

  const toggleShuffle = useCallback(() => {
    const s = stateRef.current;
    if (!s.shuffle) {
      // Turn shuffle ON: current song stays put; everything after plays randomly
      const current = s.currentSong;
      const rest = current ? s.queue.filter(x => x.id !== current.id) : [...s.queue];
      const newQueue = current ? [current, ...shuffled(rest)] : shuffled(rest);
      dispatch({
        type: 'APPLY_QUEUE_ORDER',
        payload: { queue: newQueue, queueIndex: current ? 0 : -1, shuffle: true, originalQueue: [...s.queue] },
      });
      persistPrefs({ shuffle: true });
    } else {
      // Turn shuffle OFF: restore the original order
      const original = s.originalQueue ?? s.queue;
      const idx = s.currentSong ? original.findIndex(x => x.id === s.currentSong!.id) : -1;
      dispatch({
        type: 'APPLY_QUEUE_ORDER',
        payload: { queue: [...original], queueIndex: idx, shuffle: false, originalQueue: null },
      });
      persistPrefs({ shuffle: false });
    }
  }, [persistPrefs]);

  const cycleRepeat = useCallback(() => {
    const order: RepeatMode[] = ['off', 'all', 'one'];
    const next = order[(order.indexOf(stateRef.current.repeat) + 1) % order.length];
    dispatch({ type: 'SET_REPEAT', payload: next });
    persistPrefs({ repeat: next });
  }, [persistPrefs]);

  const toggleAutoplay = useCallback(() => {
    const next = !stateRef.current.autoplay;
    dispatch({ type: 'SET_AUTOPLAY', payload: next });
    persistPrefs({ autoplay: next });
  }, [persistPrefs]);

  // ── Media Session: lock-screen / media-key controls + background metadata ──

  /**
   * Derive multiple artwork sizes from an Apple Music artwork URL.
   * Apple Music image URLs support dynamic sizing via the trailing
   * "{w}x{h}bb" segment.  We request three standard sizes so iOS picks
   * the best one for the lock-screen card.
   */
  function buildArtworkList(url: string | undefined): MediaImage[] {
    if (!url) return [];
    // Replace a trailing dimensions segment like "512x512bb" or "100x100bb"
    const base = url.replace(/\d+x\d+bb(\.\w+)$/, '{w}x{h}bb$1');
    if (!base.includes('{w}') || base === url) {
      // URL is not in Apple Music's parameterised form — use it as-is
      return [{ src: url, sizes: '512x512', type: 'image/jpeg' }];
    }
    return ([512, 256, 96] as const).map(size => ({
      src: base.replace('{w}', String(size)).replace('{h}', String(size)),
      sizes: `${size}x${size}`,
      type: 'image/jpeg',
    }));
  }

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const song = state.currentSong;
    if (!song) { navigator.mediaSession.metadata = null; return; }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      artwork: buildArtworkList(song.artworkUrl),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentSong?.id]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = state.currentSong
      ? (state.isPlaying ? 'playing' : 'paused')
      : 'none';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isPlaying, state.currentSong?.id]);

  // Keep the lock-screen scrubber in sync by reporting position state.
  // MusicKit tracks report their own duration from the song metadata; HTML5
  // preview tracks report it from the audio element.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (!state.currentSong) return;
    const duration = state.duration;
    if (!duration || duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(state.currentTime, duration),
      });
    } catch { /* not all browsers support setPositionState */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentTime, state.duration, state.currentSong?.id]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (action: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
      try { ms.setActionHandler(action, fn); } catch { /* unsupported action */ }
    };
    set('play', () => resume());
    set('pause', () => pause());
    set('nexttrack', () => skipNext());
    set('previoustrack', () => skipPrev());
    // 'seekto' — absolute position; supported on Chrome/Android and newer iOS
    set('seekto', (d) => { if (d.seekTime != null) seek(d.seekTime); });
    // 'seekforward' / 'seekbackward' — relative; used by some iOS lock-screen
    // controls and Bluetooth remotes that don't emit seekto
    set('seekforward',  (d) => seek(Math.min(stateRef.current.duration, stateRef.current.currentTime + (d.seekOffset ?? 10))));
    set('seekbackward', (d) => seek(Math.max(0, stateRef.current.currentTime - (d.seekOffset ?? 10))));
    return () => {
      for (const a of ['play', 'pause', 'nexttrack', 'previoustrack', 'seekto', 'seekforward', 'seekbackward'] as MediaSessionAction[]) {
        set(a, null);
      }
    };
  }, [resume, pause, skipNext, skipPrev, seek]);

  return (
    <PlayerContext.Provider
      value={{
        ...state, play, pause, resume, seek, skipNext, skipPrev, setQueue, enqueue,
        setActiveCardIndex, toggleShuffle, cycleRepeat, toggleAutoplay,
      }}
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
