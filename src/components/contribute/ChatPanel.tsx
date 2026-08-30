import React, { useState } from 'react';
import { ChatFeed } from './ChatFeed';
import { ChatActionBar } from './ChatActionBar';
import { ChatMessage as ChatMessageType, QuickReply } from '../../types/contribute';

interface ChatPanelProps {
  messages: ChatMessageType[];
  commuteState: string;
  appMode: string;
  currentRouteName: string | null;
  isTracking: boolean;
  onQuickReply: (reply: QuickReply) => void;
  onSendMessage: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  commuteState,
  appMode,
  currentRouteName,
  isTracking,
  onQuickReply,
  onSendMessage,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`
        fixed z-50 bottom-[70px] left-3 right-3 md:bottom-4 md:left-4 md:right-auto md:top-auto md:w-[380px] md:rounded-2xl bg-white/95 backdrop-blur-md
        rounded-[20px] shadow-[4px_4px_7px_8px_rgba(0,0,0,0.06)] border border-gray-100
        transition-all duration-300 ease-in-out
        ${isExpanded ? 'h-[50vh]' : 'h-[40vh]'}
        flex flex-col
        overflow-hidden
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isExpanded ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              )}
            </svg>
          </button>
          <div>
            <h2 className="text-[13px] font-medium text-[#0B122C] font-poppins leading-[24px]">
              Contribute
            </h2>
            <p className="text-[9px] text-gray-500 font-poppins">
              {appMode === 'idle' ? 'Ready to help' : `Mode: ${appMode}`}
            </p>
          </div>
        </div>
      </div>

      {/* Chat Feed */}
      <div className="flex-1 overflow-hidden">
        <ChatFeed
          messages={messages}
          onQuickReply={onQuickReply}
          disabled={appMode === 'uploading'}
        />
      </div>

      {/* Action Bar */}
      <div className="flex-shrink-0 border-t border-gray-100">
        <ChatActionBar
          commuteState={commuteState}
          appMode={appMode}
          currentRouteName={currentRouteName}
          isTracking={isTracking}
          onQuickReply={onQuickReply}
          onSendMessage={onSendMessage}
          disabled={appMode === 'uploading'}
        />
      </div>
    </div>
  );
};
