import type {
  TrackerState,
  Segment,
  SegmentMode,
  GpsPoint,
  DocumentedRoute,
} from '../types/tracker';
import { haversineMeters as haversine } from '../utils/commuteStats';  // __STATS_CONSOLIDATED__

// ─────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────

export type TrackerAction =
  // Flow A — Start Commute
  | { type: 'START_COMMUTE' }
  | {
      type: 'HOP_ON';
      payload: {
        mode: SegmentMode;
        routeName: string;
        routeUuid: string | null;
        fare: number | null;
      };
    }
  | { type: 'HOP_OFF' }
  | { type: 'LOG_FARE'; payload: number | null }
  | { type: 'END_COMMUTE' }

  // Flow B — Add Route
  | {
      type: 'START_DOCUMENT';
      payload: { routeName: string; mode: SegmentMode; routeUuid: string };
    }
  | { type: 'START_ROUTE_TIMER' }
  | { type: 'END_ROUTE'; payload: { fare: number | null } }

  // Global
  | { type: 'GPS_POINT'; payload: GpsPoint }
  | { type: 'TICK' }
  | { type: 'HYDRATE'; payload: TrackerState } // __HYDRATE_ACTION__
  | { type: 'RESET' };

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const newId = () => `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// local haversine removed — imported from ../utils/commuteStats  __STATS_CONSOLIDATED__

const segmentDistance = (points: GpsPoint[]): number => {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversine(points[i - 1], points[i]);
  }
  return total;
};

const makeSegment = (
  mode: SegmentMode,
  routeName: string | null = null,
  routeUuid: string | null = null,
  fare: number | null = null
): Segment => ({
  id: newId(),
  mode,
  routeName,
  routeUuid,
  fare,
  startedAt: Date.now(),
  endedAt: null,
  gpsPoints: [],
  distanceM: 0,
  durationSec: 0,
});

// ─────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────

export const initialTrackerState: TrackerState = {
  flow: 'none',
  commutePhase: 'idle',
  commuteStartedAt: null,
  segments: [],
  activeSegment: null,
  documentPhase: 'idle',
  documentedRoute: null,
  totalDistanceM: 0,
  totalDurationSec: 0,
};

// ─────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────

export function trackerReducer(
  state: TrackerState,
  action: TrackerAction
): TrackerState {
  switch (action.type) {
    // ─── Flow A: Start Commute ───────────────────────
    case 'START_COMMUTE': {
      const walking = makeSegment('walking');
      return {
        ...state,
        flow: 'commute',
        commutePhase: 'walking',
        commuteStartedAt: Date.now(),
        segments: [],
        activeSegment: walking,
        documentPhase: 'idle',
        documentedRoute: null,
        totalDistanceM: 0,
        totalDurationSec: 0,
      };
    }

    case 'HOP_ON': {
      if (state.flow !== 'commute') return state;
      // Close active walking segment (only if it has GPS points)
      const closed = state.activeSegment
        ? {
            ...state.activeSegment,
            endedAt: Date.now(),
            durationSec: Math.round(
              (Date.now() - state.activeSegment.startedAt) / 1000
            ),
            distanceM: segmentDistance(state.activeSegment.gpsPoints),
          }
        : null;
      // Only push non-empty segments
      const segments =
        closed && (closed.gpsPoints.length > 0 || closed.distanceM > 5)
          ? [...state.segments, closed]
          : state.segments;
      const riding = makeSegment(
        action.payload.mode,
        action.payload.routeName,
        action.payload.routeUuid,
        action.payload.fare
      );
      return {
        ...state,
        commutePhase: 'riding',
        segments,
        activeSegment: riding,
      };
    }

    case 'HOP_OFF': {
      if (state.flow !== 'commute' || state.commutePhase !== 'riding') return state;
      const closed = state.activeSegment
        ? {
            ...state.activeSegment,
            endedAt: Date.now(),
            durationSec: Math.round(
              (Date.now() - state.activeSegment.startedAt) / 1000
            ),
            distanceM: segmentDistance(state.activeSegment.gpsPoints),
          }
        : null;
      const segments =
        closed && (closed.gpsPoints.length > 0 || closed.distanceM > 5)
          ? [...state.segments, closed]
          : state.segments;
      const walking = makeSegment('walking');
      return {
        ...state,
        commutePhase: 'walking',
        segments,
        activeSegment: walking,
      };
    }

    case 'LOG_FARE': {
      if (!state.activeSegment) return state;
      const updated = { ...state.activeSegment, fare: action.payload };
      return { ...state, activeSegment: updated };
    }

    case 'END_COMMUTE': {
      // Close the active segment and return to idle. The caller
      // (CommuteTrackerPage) reads the closed state BEFORE dispatching
      // this action, so it can build the save payload from a snapshot.
      let segments = [...state.segments];
      if (state.activeSegment) {
        const closed = {
          ...state.activeSegment,
          endedAt: Date.now(),
          durationSec: Math.round(
            (Date.now() - state.activeSegment.startedAt) / 1000
          ),
          distanceM: segmentDistance(state.activeSegment.gpsPoints),
        };
        if (closed.gpsPoints.length > 0 || closed.distanceM > 5 || closed.fare != null) {
          segments = [...segments, closed];
        }
      }
      return {
        ...state,
        flow: 'none',
        commutePhase: 'idle',
        commuteStartedAt: null,
        segments,
        activeSegment: null,
      };
    }

    // ─── Flow B: Document Route ──────────────────────
    case 'START_DOCUMENT': {
      return {
        ...state,
        flow: 'documenting',
        documentPhase: 'ready',
        documentedRoute: {
          routeUuid: action.payload.routeUuid,
          routeName: action.payload.routeName,
          mode: action.payload.mode,
          startedAt: null,
          endedAt: null,
          gpsPoints: [],
          distanceM: 0,
          durationSec: 0,
          fare: null,
        },
        segments: [],
        activeSegment: null,
        commutePhase: 'idle',
        commuteStartedAt: null,
        totalDistanceM: 0,
        totalDurationSec: 0,
      };
    }

    case 'START_ROUTE_TIMER': {
      if (state.flow !== 'documenting' || !state.documentedRoute) return state;
      return {
        ...state,
        documentPhase: 'recording',
        documentedRoute: {
          ...state.documentedRoute,
          startedAt: Date.now(),
        },
      };
    }

    case 'END_ROUTE': {
      if (state.flow !== 'documenting' || !state.documentedRoute) return state;
      const dr = state.documentedRoute;
      const closed: DocumentedRoute = {
        ...dr,
        endedAt: Date.now(),
        durationSec: dr.startedAt
          ? Math.round((Date.now() - dr.startedAt) / 1000)
          : 0,
        distanceM: segmentDistance(dr.gpsPoints),
        fare: action.payload.fare,
      };
      return {
        ...state,
        documentPhase: 'idle',
        documentedRoute: closed,
      };
    }

    // ─── Global ──────────────────────────────────────
    case 'GPS_POINT': {
      if (state.flow === 'commute' && state.activeSegment) {
        const prev = state.activeSegment.gpsPoints;
        const last = prev[prev.length - 1];
        const delta = last ? haversine(last, action.payload) : 0;
        // __ACCUMULATION_FIX__: mutate in place; new top-level object still triggers React
        prev.push(action.payload);
        return {
          ...state,
          activeSegment: {
            ...state.activeSegment,
            gpsPoints: prev,
            distanceM: state.activeSegment.distanceM + delta,
          },
          totalDistanceM: state.totalDistanceM + delta,
        };
      }
      if (
        state.flow === 'documenting' &&
        state.documentPhase === 'recording' &&
        state.documentedRoute
      ) {
        const prev = state.documentedRoute.gpsPoints;
        const last = prev[prev.length - 1];
        const delta = last ? haversine(last, action.payload) : 0;
        // __ACCUMULATION_FIX__: mutate in place
        prev.push(action.payload);
        return {
          ...state,
          documentedRoute: {
            ...state.documentedRoute,
            gpsPoints: prev,
            distanceM: state.documentedRoute.distanceM + delta,
          },
          totalDistanceM: state.totalDistanceM + delta,
        };
      }
      return state;
    }

    case 'TICK': {
      if (state.flow === 'commute' && state.commuteStartedAt) {
        return {
          ...state,
          totalDurationSec: Math.round(
            (Date.now() - state.commuteStartedAt) / 1000
          ),
        };
      }
      if (
        state.flow === 'documenting' &&
        state.documentPhase === 'recording' &&
        state.documentedRoute &&
        state.documentedRoute.startedAt
      ) {
        return {
          ...state,
          documentedRoute: {
            ...state.documentedRoute,
            durationSec: Math.round(
              (Date.now() - state.documentedRoute.startedAt) / 1000
            ),
          },
        };
      }
      return state;
    }

    case 'HYDRATE':
      return { ...action.payload }; // __HYDRATE_ACTION__

    case 'RESET':
      return { ...initialTrackerState };

    default:
      return state;
  }
}
