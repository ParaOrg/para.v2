export type AppMode = 'idle' | 'tracking' | 'recording' | 'uploading';
export type CommuteState = 'walking' | 'riding';
export type MessageSender = 'bot' | 'user';
export type MessageType = 'text' | 'quick_replies' | 'inline_form' | 'route_recording' | 'stop_autofill' | 'strava_summary' | 'segment_timeline' | 'poi_form' | 'fare_form';

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
  commuteState: CommuteState;
  currentRouteName: string | null;
  chatHistory: ChatMessage[];
  isTracking: boolean;
  selectedPOIType?: string | null;
}
