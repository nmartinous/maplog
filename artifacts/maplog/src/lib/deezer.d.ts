// TypeScript declarations for the Deezer JS SDK loaded from CDN.
// https://developers.deezer.com/sdk/javascript

declare namespace DZ {
  interface InitOptions {
    appId: string | number;
    channelUrl: string;
    player?: {
      onload?: (state: PlayerState) => void;
      container?: string;
      width?: number;
      height?: number;
      format?: 'classic' | 'square' | 'column';
    };
  }

  interface AuthResponse {
    userID: string;
    accessToken: string;
    expire: string;
  }

  interface LoginStatusResponse {
    status: 'connected' | 'not_authorized' | 'unknown';
    authResponse?: AuthResponse;
  }

  interface PlayerState {
    player: DZPlayer;
  }

  interface DZPlayer {
    play: () => void;
    pause: () => void;
    seek: (position: number) => void;
    next: () => void;
    prev: () => void;
    playTracks: (ids: number[], startIndex?: number, startOffset?: number, callback?: (res: any) => void) => void;
    getCurrentTrack: () => DZTrack | null;
    getPosition: () => number;
    getDuration: () => number;
    isPlaying: () => boolean;
    subscribe: (event: string, callback: (...args: any[]) => void) => void;
    unsubscribe: (event: string, callback: (...args: any[]) => void) => void;
  }

  interface DZArtist {
    id: number;
    name: string;
    picture_xl?: string;
  }

  interface DZAlbum {
    id: number;
    title: string;
    cover: string;
    cover_medium: string;
    cover_big: string;
    cover_xl: string;
  }

  interface DZTrack {
    id: number;
    title: string;
    duration: number;
    preview: string;
    artist: DZArtist;
    album: DZAlbum;
  }

  interface DZPlaylist {
    id: number;
    title: string;
    nb_tracks: number;
    picture_xl?: string;
  }

  interface DZPage<T> {
    data: T[];
    total: number;
    next?: string;
    prev?: string;
    error?: { type: string; message: string; code: number };
  }

  /** Initialise the SDK — call once before anything else */
  function init(options: InitOptions): void;

  /** Open a Deezer OAuth login popup */
  function login(
    callback: (response: LoginStatusResponse) => void,
    options?: { perms?: string },
  ): void;

  /** Log the current user out */
  function logout(callback?: () => void): void;

  /** Check whether a user is already authenticated (reads cookie/session) */
  function getLoginStatus(callback: (response: LoginStatusResponse) => void): void;

  /** Make an authenticated API request via JSONP */
  function api(path: string, callback: (response: any) => void): void;
  function api(
    path: string,
    method: string,
    data: Record<string, unknown>,
    callback: (response: any) => void,
  ): void;
}
