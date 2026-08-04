// Minimal TypeScript declarations for MusicKit JS v3 (CDN global)
// Full docs: https://developer.apple.com/documentation/musickitjs

declare namespace MusicKit {
  function configure(config: {
    developerToken: string;
    app: { name: string; build: string };
  }): Promise<MusicKitInstance>;

  function getInstance(): MusicKitInstance;

  /** Numeric playback state values from MusicKit */
  const PlaybackState: {
    none: 0;
    loading: 1;
    playing: 2;
    paused: 3;
    stopped: 4;
    ended: 5;
    seekingForward: 6;
    seekingBackward: 7;
  };

  interface MusicKitInstance {
    /** True after the user has authorized Apple Music access */
    isAuthorized: boolean;
    /** User-specific Music User Token (available after authorize()) */
    musicUserToken: string;
    /** Current numeric playback state */
    playbackState: number;
    currentPlaybackTime: number;
    currentPlaybackDuration: number;
    /** Queue the given song(s) and prepare for playback */
    setQueue(options: {
      song?: string;
      songs?: string[];
      startPosition?: number;
    }): Promise<void>;
    play(): Promise<void>;
    pause(): void;
    stop(): void;
    skipToNextItem(): Promise<void>;
    skipToPreviousItem(): Promise<void>;
    seekToTime(seconds: number): Promise<void>;
    /** Open Apple's authorization popup; resolves with Music User Token */
    authorize(): Promise<string>;
    unauthorize(): Promise<void>;
    addEventListener(event: string, handler: (...args: unknown[]) => void): void;
    removeEventListener(event: string, handler: (...args: unknown[]) => void): void;
  }
}

interface Window {
  MusicKit: typeof MusicKit;
}
