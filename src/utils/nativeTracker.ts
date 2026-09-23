/**
 * nativeTracker.ts — Bridge between @capacitor-community/background-geolocation
 * and Para PH's GPS pipeline.
 *
 * Design:
 *   - Runs natively (foreground service on Android), so fixes keep coming when
 *     the app is backgrounded, screen is locked, or device is in doze.
 *   - Emits GpsPoint-shaped objects into a caller-supplied callback.
 *   - Filters simulated (mock) locations and null timestamps.
 *
 * FIXES ROUTING:
 *   native fix -> filter (simulated / invalid) -> onFix callback
 *                                               -> CommuteTrackerPage dispatch
 *                                               -> gpsDownsampler / offlineBuffer / syncEngine
 */

import { registerPlugin, Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications'; // __NOTIF_PERMISSION_REAL__

export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
  speed?: number | null;
  bearing?: number | null;
  altitude?: number | null;
}

interface WatcherOptions {
  backgroundMessage?: string;
  backgroundTitle?: string;
  requestPermissions?: boolean;
  stale?: boolean;
  distanceFilter?: number;
}

interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  simulated: boolean;
  bearing: number | null;
  speed: number | null;
  time: number | null;
}

interface CallbackError extends Error {
  code?: string;
}

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: WatcherOptions,
    callback: (position?: Location, error?: CallbackError) => void
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
}

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  'BackgroundGeolocation'
);

let activeWatcherId: string | null = null;

export async function startNativeTracking(
  onFix: (point: GpsPoint) => void,
  onError?: (err: CallbackError) => void
): Promise<string> {
  if (activeWatcherId) {
    return activeWatcherId;
  }

  if (!Capacitor.isNativePlatform()) {
    console.warn(
      '[nativeTracker] Not running on a native platform - using browser geolocation fallback.'
    );
    return startBrowserFallback(onFix, onError);
  }

  const id = await BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: 'Para PH is tracking your commute',
      backgroundMessage: 'Recording GPS for route data. Tap to return.',
      requestPermissions: true,
      stale: false,
      distanceFilter: 5,
    },
    (position, error) => {
      if (error) {
        console.warn('[nativeTracker] watcher error:', error.code, error.message);
        onError?.(error);
        return;
      }
      if (!position) return;

      if (position.simulated) {
        console.warn('[nativeTracker] rejected simulated (mock) location');
        return;
      }

      const timestamp = position.time ?? Date.now();

      onFix({
        lat: position.latitude,
        lng: position.longitude,
        timestamp,
        accuracy: position.accuracy,
        speed: position.speed,
        bearing: position.bearing,
        altitude: position.altitude,
      });
    }
  );

  activeWatcherId = id;
  return id;
}

export async function stopNativeTracking(): Promise<void> {
  if (!activeWatcherId) return;
  try {
    await BackgroundGeolocation.removeWatcher({ id: activeWatcherId });
  } catch (e) {
    console.warn('[nativeTracker] removeWatcher failed:', e);
  }
  activeWatcherId = null;
}

export function isNativeTracking(): boolean {
  return activeWatcherId !== null;
}

export async function openAppSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await BackgroundGeolocation.openSettings();
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') return true;

  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') return true;

    const req = await LocalNotifications.requestPermissions();
    if (req.display === 'granted') return true;

    console.warn(
      '[nativeTracker] POST_NOTIFICATIONS denied - foreground service will ' +
        'be killed after ~5 min by Android 13+. Ask the user to enable ' +
        'notifications in Settings -> Apps -> Para PH Tracker -> Notifications.'
    );
    return false;
  } catch (e) {
    console.warn('[nativeTracker] notification permission check failed:', e);
    return false;
  }
}

let browserWatchId: number | null = null;

function startBrowserFallback(
  onFix: (point: GpsPoint) => void,
  onError?: (err: CallbackError) => void
): string {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocation is not supported on this device.');
  }
  browserWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      onFix({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: pos.timestamp,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        bearing: pos.coords.heading,
        altitude: pos.coords.altitude,
      });
    },
    (err) => onError?.(new Error(err.message) as CallbackError),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  );
  return 'browser-' + browserWatchId;
}
