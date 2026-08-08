/**
 * Google Drive REST API — browser-side client.
 *
 * Uses Google Identity Services (GIS) for OAuth2 token management.
 * Tokens are kept in module-level variables (never localStorage) and are
 * requested fresh each session. Silent re-auth is attempted first; if that
 * fails the user must reconnect via Settings.
 *
 * All file operations use the Drive REST API directly (no SDK):
 *   https://developers.google.com/drive/api/v3/reference
 */

import { GOOGLE_CLIENT_ID } from './config';

const DRIVE_API  = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// ── Minimal GIS type stubs ────────────────────────────────────────────────────

interface GISTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GISTokenClient {
  requestAccessToken(opts: { prompt: string }): void;
  callback: (r: GISTokenResponse) => void;
  error_callback: (e: { type: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(opts: {
            client_id: string;
            scope: string;
            callback: (r: GISTokenResponse) => void;
            error_callback?: (e: { type: string }) => void;
          }): GISTokenClient;
          revoke(token: string, callback: () => void): void;
        };
      };
    };
  }
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  /** Custom key–value pairs stored on the file (e.g. { updatedAt: '...' }) */
  appProperties?: Record<string, string>;
}

// ── Token state (module-level, never serialised) ──────────────────────────────

let _accessToken: string | null = null;
let _tokenExpiry: number | null = null;   // Date.now() ms when token expires
let _tokenClient: GISTokenClient | null = null;

function isTokenValid(): boolean {
  return !!_accessToken && !!_tokenExpiry && Date.now() < _tokenExpiry - 60_000;
}

export function hasLiveToken(): boolean {
  return isTokenValid();
}

// ── GIS loading ───────────────────────────────────────────────────────────────

let _gisLoading: Promise<void> | null = null;

export function loadGIS(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (_gisLoading) return _gisLoading;
  _gisLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
    document.head.appendChild(s);
  });
  return _gisLoading;
}

function getTokenClient(): GISTokenClient {
  if (!_tokenClient) {
    if (!GOOGLE_CLIENT_ID) throw new Error('Google Client ID is not configured.');
    _tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      // drive.file: access only to files this app creates.
      // email: lets us show which account is connected.
      scope: 'https://www.googleapis.com/auth/drive.file email',
      callback: () => {},  // replaced per-request
      error_callback: () => {},
    });
  }
  return _tokenClient;
}

// ── Token request ─────────────────────────────────────────────────────────────

/**
 * Request an access token.
 * @param silent  If true, attempt without a popup (fails if no prior consent).
 *                Use false (the default) for the initial "Connect" flow.
 */
export async function requestToken(silent = false): Promise<string> {
  await loadGIS();
  return new Promise<string>((resolve, reject) => {
    const client = getTokenClient();
    client.callback = (r: GISTokenResponse) => {
      if (r.error || !r.access_token) {
        reject(new Error(r.error_description ?? r.error ?? 'Token request failed.'));
        return;
      }
      _accessToken = r.access_token;
      _tokenExpiry = Date.now() + (r.expires_in ?? 3600) * 1000;
      resolve(_accessToken);
    };
    client.error_callback = (e: { type: string }) => {
      reject(new Error(`Google auth error: ${e.type}`));
    };
    // prompt: '' → silent if the user already granted consent in this browser;
    // prompt: 'consent' → always shows the OAuth dialog (used for first connect).
    client.requestAccessToken({ prompt: silent ? '' : 'consent' });
  });
}

/** Fetch the email address of the currently authenticated Google account. */
export async function fetchUserEmail(token: string): Promise<string | null> {
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const data = await r.json();
    return (data as { email?: string }).email ?? null;
  } catch {
    return null;
  }
}

/** Revoke the current token and clear local state. */
export async function revokeToken(): Promise<void> {
  const token = _accessToken;
  _accessToken = null;
  _tokenExpiry = null;
  _tokenClient = null;
  if (!token) return;
  await loadGIS();
  return new Promise(resolve => {
    window.google!.accounts.oauth2.revoke(token, resolve);
  });
}

// ── Authenticated fetch helpers ───────────────────────────────────────────────

/** Get a valid token, attempting silent refresh if needed. */
async function ensureToken(): Promise<string> {
  if (isTokenValid()) return _accessToken!;
  try {
    return await requestToken(true);   // silent refresh
  } catch {
    throw new Error('Drive session expired — please reconnect in Settings.');
  }
}

async function driveGetRaw(path: string, params?: Record<string, string>): Promise<Response> {
  const token = await ensureToken();
  const url = new URL(`${DRIVE_API}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
}

async function driveJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const r = await driveGetRaw(path, params);
  if (!r.ok) throw new Error(`Drive API ${r.status}: ${await r.text()}`);
  return r.json() as Promise<T>;
}

// ── Folder operations ─────────────────────────────────────────────────────────

/**
 * Find a folder by name (optionally inside parentId), or create it if absent.
 * Returns the folder ID.
 */
export async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const token = await ensureToken();
  const q = [
    `name='${name.replace(/'/g, "\\'")}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    'trashed=false',
    parentId ? `'${parentId}' in parents` : null,
  ].filter(Boolean).join(' and ');

  const res = await driveJson<{ files: DriveFile[] }>('/files', {
    q, spaces: 'drive', fields: 'files(id,name)',
  });
  if (res.files.length > 0) return res.files[0].id;

  const meta: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) meta.parents = [parentId];

  const r = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
  if (!r.ok) throw new Error(`Failed to create Drive folder: ${await r.text()}`);
  const file: DriveFile = await r.json();
  return file.id;
}

// ── File operations ───────────────────────────────────────────────────────────

/** List all non-trashed files in a folder. */
export async function listFiles(folderId: string): Promise<DriveFile[]> {
  const all: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params: Record<string, string> = {
      q: `'${folderId}' in parents and trashed=false`,
      spaces: 'drive',
      fields: 'nextPageToken,files(id,name,mimeType,appProperties)',
      pageSize: '1000',
    };
    if (pageToken) params.pageToken = pageToken;
    const res = await driveJson<{ files: DriveFile[]; nextPageToken?: string }>('/files', params);
    all.push(...res.files);
    pageToken = res.nextPageToken;
  } while (pageToken);
  return all;
}

/** Download a file's content as text. */
export async function readFileText(fileId: string): Promise<string> {
  const r = await driveGetRaw(`/files/${fileId}`, { alt: 'media' });
  if (!r.ok) throw new Error(`Failed to read Drive file: ${await r.text()}`);
  return r.text();
}

/** Download a file's content as a Blob. */
export async function readFileBlob(fileId: string, mimeType: string): Promise<Blob> {
  const r = await driveGetRaw(`/files/${fileId}`, { alt: 'media' });
  if (!r.ok) throw new Error(`Failed to read Drive file: ${await r.text()}`);
  const buf = await r.arrayBuffer();
  return new Blob([buf], { type: mimeType });
}

/**
 * Upload or update a file using resumable upload (works for any size).
 * Creates the file if existingFileId is not provided; updates it otherwise.
 * Returns the file ID.
 */
export async function uploadBlob(
  blob: Blob,
  name: string,
  mimeType: string,
  parentId: string,
  existingFileId?: string | null,
  appProperties?: Record<string, string>,
): Promise<string> {
  const token = await ensureToken();

  const meta: Record<string, unknown> = { name, mimeType };
  if (!existingFileId) meta.parents = [parentId];
  if (appProperties) meta.appProperties = appProperties;

  const initUrl = existingFileId
    ? `${UPLOAD_API}/files/${existingFileId}?uploadType=resumable`
    : `${UPLOAD_API}/files?uploadType=resumable`;

  const initRes = await fetch(initUrl, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(blob.size),
    },
    body: JSON.stringify(meta),
  });
  if (!initRes.ok) throw new Error(`Drive upload init failed: ${await initRes.text()}`);

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) throw new Error('Drive returned no upload URL.');

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: blob,
  });
  if (!uploadRes.ok) throw new Error(`Drive upload failed: ${await uploadRes.text()}`);

  const file: DriveFile = await uploadRes.json();
  return file.id;
}

/** Convenience wrapper: upload a UTF-8 JSON string. */
export async function uploadJson(
  content: string,
  name: string,
  parentId: string,
  existingFileId?: string | null,
): Promise<string> {
  return uploadBlob(
    new Blob([content], { type: 'application/json' }),
    name,
    'application/json',
    parentId,
    existingFileId,
  );
}

/** Delete a file (ignores 404). */
export async function deleteFile(fileId: string): Promise<void> {
  const token = await ensureToken();
  const r = await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok && r.status !== 404) throw new Error(`Failed to delete Drive file: ${await r.text()}`);
}
