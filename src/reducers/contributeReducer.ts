import {
  ContributeState,
  ChatMessage,
  AppMode,
  CommuteState,
  Segment,
  SegmentMode,
  GpsPoint,
} from '../types/contribute';
import { haversineMeters as haversine } from '../utils/commuteStats';  // __STATS_CONSOLIDATED__

// ─────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────

export type ContributeAction =
  // Chat / legacy
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'REMOVE_LAST_FORM' }
  | { type: 'SET_APP_MODE'; payload: AppMode }
  | { type: 'SET_POI_TYPE'; payload: string | null }

  // Commute lifecycle
  | { type: 'START_COMMUTE' }
  | { type: 'END_COMMUTE' }

  // Segment lifecycle
  | {
      type: 'START_RIDE_SEGMENT';
      payload: { routeUuid: string | null; routeName: string; mode: SegmentMode };
    }
  | { type: 'HOP_OFF' }

  // Real-time updates to active segment
  | { type: 'GPS_POINT'; payload: GpsPoint }
  | { type: 'SET_FARE'; payload: number | null }
  | { type: 'UPDATE_ROUTE'; payload: { routeUuid: string | null; routeName: string } }
  | { type: 'TICK' }; // for updating durationSec

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const newId = () =>
  `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
  routeUuid: string | null = null
): Segment => ({
  id: newId(),
  mode,
  routeName,
  routeUuid,
  fare: null,
  startedAt: Date.now(),
  endedAt: null,
  gpsPoints: [],
  distanceM: 0,
  durationSec: 0,
});

// ─────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────

const emptyCommute: CommuteState = {
  status: 'idle',
  startedAt: null,
  segments: [],
  activeSegment: null,
  totalDistanceM: 0,
  totalDurationSec: 0,
};

export const initialState: ContributeState = {
  appMode: 'idle',
  commute: emptyCommute,
  chatHistory: [],
  selectedPOIType: null,
};

// ─────────────────────────────────────────────────────────────
// Message ID generator (kept for ChatMessage compat)
// ─────────────────────────────────────────────────────────────

let messageId = 0;
export function createMessage(
  sender: 'bot' | 'user',
  type: ChatMessage['type'],
  content: string,
  options?: any[]
): ChatMessage {
  return {
    id: `msg-${++messageId}-${Date.now()}`,
    sender,
    type,
    content,
    options,
    timestamp: new Date(),
  };
}

// ─────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────

export function contributeReducer(
  state: ContributeState,
  action: ContributeAction
): ContributeState {
  switch (action.type) {
    // ─── Legacy chat ───────────────────────────────────────
    case 'ADD_MESSAGE':
      return { ...state, chatHistory: [...state.chatHistory, action.payload] };

    case 'REMOVE_LAST_FORM': {
      const hist = [...state.chatHistory];
      for (let i = hist.length - 1; i >= 0; i--) {
        if (hist[i].type === 'poi_form' || hist[i].type === 'fare_form') {
          hist.splice(i, 1);
          break;
        }
      }
      return { ...state, chatHistory: hist };
    }

    case 'SET_APP_MODE':
      return { ...state, appMode: action.payload };

    case 'SET_POI_TYPE':
      return { ...state, selectedPOIType: action.payload };

    // ─── Commute lifecycle ─────────────────────────────────
    case 'START_COMMUTE': {
      // Begin with a walking segment (default state)
      const walking = makeSegment('walking');
      return {
        ...state,
        appMode: 'tracking',
        commute: {
          status: 'walking',
          startedAt: Date.now(),
          segments: [],
          activeSegment: walking,
          totalDistanceM: 0,
          totalDurationSec: 0,
        },
      };
    }

    case 'END_COMMUTE': {
      // Close out the active segment and freeze state.
      // ContributePage reads state.commute.segments for the save payload.
      let segments = [...state.commute.segments];
      const active = state.commute.activeSegment;
      if (active) {
        const closed: Segment = {
          ...active,
          endedAt: Date.now(),
          durationSec: Math.round((Date.now() - active.startedAt) / 1000),
        };
        segments.push(closed);
      }
      return {
        ...state,
        appMode: 'idle',
        commute: {
          ...state.commute,
          status: 'idle',
          segments,
          activeSegment: null,
        },
      };
    }

    // ─── Segment lifecycle ─────────────────────────────────
    case 'START_RIDE_SEGMENT': {
      // 1. Close the current walking segment (if any)
      // 2. Open a new riding segment
      let segments = [...state.commute.segments];
      const active = state.commute.activeSegment;

      if (active && active.gpsPoints.length > 0) {
        const closed: Segment = {
          ...active,
          endedAt: Date.now(),
          durationSec: Math.round((Date.now() - active.startedAt) / 1000),
        };
        segments.push(closed);
      }

      const riding = makeSegment(
        action.payload.mode,
        action.payload.routeName,
        action.payload.routeUuid
      );

      return {
        ...state,
        commute: {
          ...state.commute,
          status: 'riding',
          segments,
          activeSegment: riding,
        },
      };
    }

    case 'HOP_OFF': {
      // Close the current riding segment, start a new walking segment.
      let segments = [...state.commute.segments];
      const active = state.commute.activeSegment;

      if (active) {
        const closed: Segment = {
          ...active,
          endedAt: Date.now(),
          durationSec: Math.round((Date.now() - active.startedAt) / 1000),
        };
        segments.push(closed);
      }

      const walking = makeSegment('walking');
      return {
        ...state,
        commute: {
          ...state.commute,
          status: 'walking',
          segments,
          activeSegment: walking,
        },
      };
    }

    case 'UPDATE_ROUTE': {
      // User changed route mid-segment (only meaningful while riding)
      const active = state.commute.activeSegment;
      if (!active) return state;
      const updated: Segment = {
        ...active,
        routeUuid: action.payload.routeUuid,
        routeName: action.payload.routeName,
      };
      return {
        ...state,
        commute: { ...state.commute, activeSegment: updated },
      };
    }

    // ─── Real-time updates ─────────────────────────────────
    case 'GPS_POINT': {
      const active = state.commute.activeSegment;
      if (!active) return state;

      const prevPoints = active.gpsPoints;
      const last = prevPoints[prevPoints.length - 1];
      const delta = last ? haversine(last, action.payload) : 0;
      // __ACCUMULATION_FIX__: mutate in place; new outer object triggers React
      prevPoints.push(action.payload);

      const updated: Segment = {
        ...active,
        gpsPoints: prevPoints,
        distanceM: active.distanceM + delta,
        durationSec: Math.round((Date.now() - active.startedAt) / 1000),
      };

      return {
        ...state,
        commute: {
          ...state.commute,
          activeSegment: updated,
          totalDistanceM: state.commute.totalDistanceM + delta,
        },
      };
    }

    case 'SET_FARE': {
      const active = state.commute.activeSegment;
      if (!active) return state;
      const updated: Segment = { ...active, fare: action.payload };
      return {
        ...state,
        commute: { ...state.commute, activeSegment: updated },
      };
    }

    case 'TICK': {
      const active = state.commute.activeSegment;
      if (!active) return state;
      const elapsed = Math.round((Date.now() - active.startedAt) / 1000);
      const updated: Segment = { ...active, durationSec: elapsed };
      return {
        ...state,
        commute: {
          ...state.commute,
          activeSegment: updated,
          totalDurationSec: Math.round(
            (Date.now() - (state.commute.startedAt ?? Date.now())) / 1000
          ),
        },
      };
    }

    default:
      return state;
  }
}
