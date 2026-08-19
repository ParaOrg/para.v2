import React, { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatMessage as ChatMessageType, QuickReply } from '../../types/contribute';

interface ChatFeedProps {
  messages: ChatMessageType[];
  onQuickReply: (reply: QuickReply) => void;
  disabled?: boolean;
  selectedOptions?: string[];
}

export const ChatFeed: React.FC<ChatFeedProps> = ({ 
  messages, 
  onQuickReply, 
  disabled,
  selectedOptions = [],
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-3">
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          onQuickReply={onQuickReply}
          disabled={disabled}
          selectedOptions={selectedOptions}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};
