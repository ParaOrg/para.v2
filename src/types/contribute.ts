// ─────────────────────────────────────────────────────────────
// Contribute / Commute Types
// ─────────────────────────────────────────────────────────────

export type AppMode = 'idle' | 'tracking' | 'recording' | 'uploading';

/** All possible modes a segment can have */
export type SegmentMode =
  | 'walking'
  | 'jeepney'
  | 'bus'
  | 'train'
  | 'trike'
  | 'uv_express'
  | 'grab'
  | 'angkas';

/** Commute-level status (what the UI shows at the top) */
export type CommuteStatus = 'idle' | 'walking' | 'riding';

/** A GPS point captured during a segment */
export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
}

/** A single leg of a multi-segment commute */
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

/** A completed commute record (built on End Commute) */
export interface CommuteRecord {
  startedAt: number;
  endedAt: number;
  totalDurationSec: number;
  totalDistanceM: number;
  segments: Segment[];
}

export interface CommuteState {
  status: CommuteStatus;
  startedAt: number | null;
  segments: Segment[];
  activeSegment: Segment | null;
  totalDistanceM: number;
  totalDurationSec: number;
}

// ─── Legacy types kept for ChatMessage component compatibility ───
export type MessageSender = 'bot' | 'user';
export type MessageType =
  | 'text'
  | 'quick_replies'
  | 'inline_form'
  | 'route_recording'
  | 'stop_autofill'
  | 'strava_summary'
  | 'segment_timeline'
  | 'poi_form'
  | 'fare_form';

export interface QuickReply {
  id: string;
  label: string;
  icon?: string;
}

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  type: MessageType;
  content: string;
  options?: QuickReply[];
  timestamp: Date;
}

export interface ContributeState {
  appMode: AppMode;
  commute: CommuteState;
  chatHistory: ChatMessage[];
  selectedPOIType?: string | null;
}
