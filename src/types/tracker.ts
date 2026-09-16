// ─────────────────────────────────────────────────────────────
// Commute Tracker V2 — Types
// Two independent flows:
//   FLOW_A: multi-modal personal trip (Start Commute → Hop On/Off × N → End)
//   FLOW_B: document a specific route (Add Route → Start → End)
//
// NOTE: Modal + success-message state are UI concerns — they live in
// component-level useState, not in this data model.
// ─────────────────────────────────────────────────────────────

export type FlowKind = 'none' | 'commute' | 'documenting';

export type SegmentMode =
  | 'walking'
  | 'jeepney'
  | 'bus'
  | 'train'
  | 'trike'
  | 'uv_express'
  | 'grab'
  | 'angkas';

export type CommutePhase = 'idle' | 'walking' | 'riding';
export type DocumentPhase = 'idle' | 'ready' | 'recording';

export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
}

export interface Segment {
  id: string;
  mode: SegmentMode;
  routeName: string | null;
  routeUuid: string | null;
  fare: number | null;
  startedAt: number;
  endedAt: number | null;
  gpsPoints: GpsPoint[];
  distanceM: number;
  durationSec: number;
}

export interface DocumentedRoute {
  /** Client-generated UUID that becomes ph_routes.route_uuid on admin approval. */
  routeUuid: string;
  routeName: string;
  mode: SegmentMode;
  startedAt: number | null;
  endedAt: number | null;
  gpsPoints: GpsPoint[];
  distanceM: number;
  durationSec: number;
  fare: number | null;
}

export interface TrackerState {
  flow: FlowKind;

  // ─── Flow A ──────────────────────────────────
  commutePhase: CommutePhase;
  commuteStartedAt: number | null;
  segments: Segment[];
  activeSegment: Segment | null;

  // ─── Flow B ──────────────────────────────────
  documentPhase: DocumentPhase;
  documentedRoute: DocumentedRoute | null;

  // ─── Aggregates ──────────────────────────────
  totalDistanceM: number;
  totalDurationSec: number;
}
