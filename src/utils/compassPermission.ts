// src/utils/compassPermission.ts

const STORAGE_KEY = 'para.compassPermission';

type PermissionState = 'unknown' | 'granted' | 'denied';

export function getStoredCompassPermission(): PermissionState {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'granted' || v === 'denied') return v;
  } catch {
    /* localStorage may be blocked */
  }
  return 'unknown';
}

function storeCompassPermission(state: PermissionState) {
  try {
    localStorage.setItem(STORAGE_KEY, state);
  } catch {
    /* ignore */
  }
}

/** True if this platform requires an explicit user-gesture prompt (iOS 13+). */
export function requiresCompassPermission(): boolean {
  const Any = (window as any).DeviceOrientationEvent;
  return !!Any && typeof Any.requestPermission === 'function';
}

/**
 * Request compass permission. MUST be called from a user gesture (button tap)
 * on iOS 13+. Returns true if granted.
 */
export async function requestCompassPermission(): Promise<boolean> {
  const Any = (window as any).DeviceOrientationEvent;

  if (!Any || typeof Any.requestPermission !== 'function') {
    storeCompassPermission('granted');
    return true;
  }

  try {
    const res: PermissionState = await Any.requestPermission();
    storeCompassPermission(res);
    return res === 'granted';
  } catch {
    storeCompassPermission('denied');
    return false;
  }
}
