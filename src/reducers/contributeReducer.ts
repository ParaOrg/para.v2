import { ContributeState, ChatMessage, AppMode, CommuteState } from '../types/contribute';

type Action =
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_APP_MODE'; payload: AppMode }
  | { type: 'SET_COMMUTE_STATE'; payload: CommuteState }
  | { type: 'SET_ROUTE_NAME'; payload: string | null }
  | { type: 'SET_TRACKING'; payload: boolean }
  | { type: 'SET_POI_TYPE'; payload: string | null };

export const initialState: ContributeState = {
  appMode: 'idle',
  commuteState: 'walking',
  currentRouteName: null,
  chatHistory: [],
  isTracking: false,
  selectedPOIType: null,
};

let messageId = 0;

export function createMessage(
  sender: 'bot' | 'user',
  type: 'text' | 'quick_replies' | 'inline_form',
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

export function contributeReducer(state: ContributeState, action: Action): ContributeState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      console.log('ADD_MESSAGE payload:', action.payload);
      return { ...state, chatHistory: [...state.chatHistory, action.payload] };
    case 'SET_APP_MODE':
      return { ...state, appMode: action.payload };
    case 'SET_COMMUTE_STATE':
      return { ...state, commuteState: action.payload };
    case 'SET_ROUTE_NAME':
      return { ...state, currentRouteName: action.payload };
    case 'SET_TRACKING':
      return { ...state, isTracking: action.payload };
    case 'SET_POI_TYPE':
      return { ...state, selectedPOIType: action.payload };
    default:
      return state;
  }
}
