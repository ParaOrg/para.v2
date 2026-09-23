// src/hooks/useHeading.ts
import { useEffect, useRef, useState } from 'react';

export interface HeadingState {
  /** Device orientation in degrees (0=N, 90=E). Drives pin rotation. */
  facing: number | null;
  /** GPS course in degrees (0=N, 90=E). Drives the direction cone. */
  course: number | null;
  /** True once we have seen at least one compass reading. */
  hasCompass: boolean;
}

/**
 * Wraparound-safe exponential moving average.
 * Handles 350 -> 10 as +20, not -340.
 */
function smoothAngle(prev: number | null, next: number, alpha: number): number {
  if (prev == null) return next;
  let delta = next - prev;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  let out = prev + alpha * delta;
  if (out < 0) out += 360;
  if (out >= 360) out -= 360;
  return out;
}

/**
 * Google-Maps-style heading blend:
 *  - `facing` comes from device orientation (compass). Works stationary.
 *  - `course` comes from GPS `coords.heading`. Only meaningful while moving.
 *
 * Pin rotates with `facing`.
 * Cone points along `course` and fades when speed is low.
 */
export function useHeading(gpsCourse: number | null): HeadingState {
  const [facing, setFacing] = useState<number | null>(null);
  const [course, setCourse] = useState<number | null>(null);
  const [hasCompass, setHasCompass] = useState(false);
  const facingRef = useRef<number | null>(null);
  const courseRef = useRef<number | null>(null);

  useEffect(() => {
    function onOrient(e: DeviceOrientationEvent) {
      const anyE = e as any;
      let h: number | null = null;

      if (
        typeof anyE.webkitCompassHeading === 'number' &&
        !Number.isNaN(anyE.webkitCompassHeading)
      ) {
        h = anyE.webkitCompassHeading;
      } else if (e.absolute && e.alpha != null) {
        h = 360 - e.alpha;
      }

      if (h == null) return;

      const smoothed = smoothAngle(facingRef.current, h, 0.3);
      facingRef.current = smoothed;
      setFacing(smoothed);
      setHasCompass(true);
    }

    window.addEventListener('deviceorientationabsolute', onOrient as any, true);
    window.addEventListener('deviceorientation', onOrient as any, true);
    return () => {
      window.removeEventListener('deviceorientationabsolute', onOrient as any, true);
      window.removeEventListener('deviceorientation', onOrient as any, true);
    };
  }, []);

  useEffect(() => {
    if (gpsCourse == null || Number.isNaN(gpsCourse)) return;
    const smoothed = smoothAngle(courseRef.current, gpsCourse, 0.4);
    courseRef.current = smoothed;
    setCourse(smoothed);
  }, [gpsCourse]);

  return { facing, course, hasCompass };
}
