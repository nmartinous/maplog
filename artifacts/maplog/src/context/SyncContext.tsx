/**
 * SyncContext — React context exposing Drive sync state and controls.
 *
 * On mount (if previously connected):
 *   1. Installs the localStorage dirty-tracker patch.
 *   2. Loads saved key timestamps into the registry.
 *   3. Attempts a silent token refresh.
 *   4. If the token succeeds, runs a full sync (pull then push) in the background.
 *
 * Auto-push: debounced 30 s after any registry dirty event.
 * Online recovery: queued push fires when the browser comes back online.
 */

import React, {
  createContext, useCallback, useContext,
  useEffect, useRef, useState,
} from 'react';
import { toast } from 'sonner';
import {
  syncRegistry,
  GOOGLE_CLIENT_ID,
  SYNC_PUSH_DEBOUNCE_MS,
  requestToken,
  revokeToken,
  fetchUserEmail,
  hasLiveToken,
  pull,
  push,
  sync,
  getSyncMeta,
  setSyncConnected,
  flushRegistryTimestamps,
} from '@/lib/sync';

// ── Context shape ─────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface SyncContextValue {
  /** VITE_GOOGLE_CLIENT_ID is present in the build */
  isConfigured: boolean;
  /** User has completed the Drive OAuth flow */
  isConnected: boolean;
  /** Google account email, or null while connecting */
  email: string | null;
  /** ISO timestamp of the last successful sync, or null */
  lastSyncAt: string | null;
  status: SyncStatus;
  error: string | null;
  /** Open the Google OAuth consent popup and connect Drive */
  connect(): Promise<void>;
  /** Revoke the Drive token and disconnect */
  disconnect(): Promise<void>;
  /** Trigger an immediate full sync (pull + push) */
  syncNow(): Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSyncContext(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncContext must be used inside <SyncProvider>');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const isConfigured = Boolean(GOOGLE_CLIENT_ID);

  const [isConnected, setIsConnected] = useState(() => getSyncMeta().connected);
  const [email, setEmail] = useState<string | null>(() => getSyncMeta().googleEmail);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => getSyncMeta().lastSyncAt);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const pushDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInProgress = useRef(false);
  const pendingPush = useRef(false);

  // ── Internal sync runners ─────────────────────────────────────────────────

  const runSync = useCallback(async (mode: 'full' | 'push-only' = 'full') => {
    if (syncInProgress.current) {
      pendingPush.current = true;
      return;
    }
    if (!navigator.onLine) {
      pendingPush.current = true;
      return;
    }
    syncInProgress.current = true;
    setStatus('syncing');
    setError(null);
    try {
      if (mode === 'push-only') {
        await push();
      } else {
        await sync();
      }
      const meta = getSyncMeta();
      setLastSyncAt(meta.lastSyncAt);
      setStatus('idle');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setStatus('error');
      setError(msg);
      // Don't toast on background auto-sync failures — the error dot in UI is enough
    } finally {
      syncInProgress.current = false;
      if (pendingPush.current) {
        pendingPush.current = false;
        // Give the current call stack time to unwind before re-queuing
        setTimeout(() => runSync('push-only'), 1000);
      }
    }
  }, []);

  const schedulePush = useCallback(() => {
    if (pushDebounceRef.current) clearTimeout(pushDebounceRef.current);
    pushDebounceRef.current = setTimeout(() => {
      flushRegistryTimestamps();
      runSync('push-only');
    }, SYNC_PUSH_DEBOUNCE_MS);
  }, [runSync]);

  // ── On mount: install patch, load timestamps, attempt silent sync ─────────

  useEffect(() => {
    if (!isConfigured) return;

    syncRegistry.installStoragePatch();

    // Load saved per-key timestamps from last session
    const meta = getSyncMeta();
    syncRegistry.loadKeyTimestamps(meta.keyTimestamps);

    if (!meta.connected) return;

    // Attempt silent token refresh then run a full sync
    (async () => {
      try {
        await requestToken(/* silent */ true);
        await runSync('full');
      } catch {
        // Silent refresh failed — user needs to reconnect manually
        setStatus('idle');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dirty listener → debounced auto-push ─────────────────────────────────

  useEffect(() => {
    if (!isConfigured || !isConnected) return;
    const unsub = syncRegistry.onDirty(() => schedulePush());
    return () => {
      unsub();
      if (pushDebounceRef.current) clearTimeout(pushDebounceRef.current);
    };
  }, [isConfigured, isConnected, schedulePush]);

  // ── Online recovery ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!isConfigured || !isConnected) return;
    const handler = () => {
      if (pendingPush.current || syncRegistry.getDirtyKeys().size > 0) {
        runSync('push-only');
      }
    };
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [isConfigured, isConnected, runSync]);

  // ── Public API ────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (!isConfigured) {
      toast.error('Google Client ID is not configured — see Settings for setup instructions.');
      return;
    }
    setStatus('syncing');
    setError(null);
    try {
      // Non-silent: shows the Google consent dialog
      const token = await requestToken(false);
      const userEmail = await fetchUserEmail(token);
      setSyncConnected(true, userEmail);
      setIsConnected(true);
      setEmail(userEmail);

      // Install patch + load timestamps (may already be done, but safe to repeat)
      syncRegistry.installStoragePatch();
      const meta = getSyncMeta();
      syncRegistry.loadKeyTimestamps(meta.keyTimestamps);

      // First sync: pull then push
      await runSync('full');
      toast.success(userEmail ? `Drive connected — syncing as ${userEmail}` : 'Drive connected.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setStatus('error');
      setError(msg);
      toast.error(msg);
    }
  }, [isConfigured, runSync]);

  const disconnect = useCallback(async () => {
    if (pushDebounceRef.current) clearTimeout(pushDebounceRef.current);
    try {
      await revokeToken();
    } catch {
      // Best effort — clear local state regardless
    }
    setSyncConnected(false, null);
    setIsConnected(false);
    setEmail(null);
    setLastSyncAt(null);
    setStatus('idle');
    setError(null);
    toast.success('Google Drive disconnected.');
  }, []);

  const syncNow = useCallback(async () => {
    if (!isConnected) return;
    if (pushDebounceRef.current) {
      clearTimeout(pushDebounceRef.current);
      pushDebounceRef.current = null;
    }
    flushRegistryTimestamps();
    try {
      await runSync('full');
      toast.success('Synced with Google Drive.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed.');
    }
  }, [isConnected, runSync]);

  const value: SyncContextValue = {
    isConfigured,
    isConnected,
    email,
    lastSyncAt,
    status,
    error,
    connect,
    disconnect,
    syncNow,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
