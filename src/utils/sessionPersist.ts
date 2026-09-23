// src/utils/sessionPersist.ts
// __SESSION_PERSIST_V1__
//
// Durable session persistence for the tracker. Uses @capacitor/preferences
// (native SharedPreferences on Android) so state survives:
//   - Force stop / app kill
//   - WebView storage eviction under memory pressure
//   - App update
// Falls back to localStorage on web.

import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import type { TrackerState } from '../types/tracker';

const KEY = 'para.tracker.session';
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

interface PersistedBlob {
  state: TrackerState;
  savedAt: number;
}

const isNative = Capacitor.isNativePlatform();

async function writeRaw(value: string | null): Promise<void> {
  if (isNative) {
    if (value == null) {
      await Preferences.remove({ key: KEY });
    } else {
      await Preferences.set({ key: KEY, value });
    }
  } else {
    try {
      if (value == null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, value);
    } catch {
      /* private mode */
    }
  }
}

async function readRaw(): Promise<string | null> {
  if (isNative) {
    const { value } = await Preferences.get({ key: KEY });
    return value;
  }
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function saveSession(state: TrackerState): Promise<void> {
  // Only persist when a session is actually in progress.
  if (state.flow === 'none') {
    await clearSession();
    return;
  }
  const blob: PersistedBlob = { state, savedAt: Date.now() };
  try {
    await writeRaw(JSON.stringify(blob));
  } catch (e) {
    console.warn('[sessionPersist] save failed:', e);
  }
}

export async function loadSession(): Promise<TrackerState | null> {
  try {
    const raw = await readRaw();
    if (!raw) return null;
    const blob = JSON.parse(raw) as PersistedBlob;
    if (!blob?.state || typeof blob.savedAt !== 'number') {
      await clearSession();
      return null;
    }
    if (Date.now() - blob.savedAt > MAX_AGE_MS) {
      await clearSession();
      return null;
    }
    return blob.state;
  } catch (e) {
    console.warn('[sessionPersist] load failed:', e);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await writeRaw(null);
  } catch {
    /* ignore */
  }
}
