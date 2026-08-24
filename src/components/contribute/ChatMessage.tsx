import React from 'react';
import { motion } from 'framer-motion';
import { ChatMessage as ChatMessageType, QuickReply } from '../../types/contribute';
import { POIFormInline } from './POIFormInline';
import { FareFormInline } from './FareFormInline';

interface ChatMessageProps {
  message: ChatMessageType;
  onQuickReply: (reply: QuickReply) => void;
  disabled?: boolean;
  selectedOptions?: string[];
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  onQuickReply, 
  disabled,
  selectedOptions = [],
}) => {
  const isBot = message.sender === 'bot';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}
    >
      <div className={`max-w-[85%] ${isBot ? '' : 'bg-[#7A4BC8] text-white rounded-2xl px-3 py-2'}`}>
        {/* Bot message content */}
        {isBot && (
          <p className="text-[14px] leading-[20px] text-[#381D65] font-poppins whitespace-pre-line">
            {message.content.split(/(https?:\/\/[^\s]+)/g).map((part, i) => 
  part.startsWith('http') ? (
    <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-[#7A4BC8] underline">{part}</a>
  ) : part
)}
          </p>
        )}

        {/* User message content */}
        {!isBot && (
          <p className="text-[14px] leading-[20px] text-white font-poppins">
            {message.content}
          </p>
        )}

        {/* Quick Reply Chips */}
        {message.type === 'quick_replies' && message.options && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.options.map((option) => {
              const isSelected = selectedOptions.includes(option.id);
              return (
                <button
                  key={option.id}
                  onClick={() => onQuickReply(option)}
                  disabled={disabled}
                  className={`
                    px-2.5 py-1 rounded-[10px] text-[14px] leading-[20px] font-poppins
                    transition-all active:scale-95
                    ${isSelected 
                      ? 'bg-[#9767F7] text-white' 
                      : 'bg-[#E6D7FF] text-[#381D65] hover:bg-[#d4c0f5]'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {option.icon && <span className="mr-1">{option.icon}</span>}
                  {option.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Strava Summary */}
        {message.type === 'strava_summary' && (
          <div className="mt-3">
            <RouteSummaryReportInline summary={message.options?.[0]} />
          </div>
        )}

        {/* Segment Timeline */}
        {message.type === 'segment_timeline' && (
          <div className="mt-3">
            <SegmentTimelineInline segments={message.options || []} />
          </div>
        )}

        {/* Inline Form */}
        {message.type === 'inline_form' && (
          <div className="mt-2 text-[16px] text-[#381D65] italic">
            {message.content}
          </div>
        )}

        {/* POI Form */}
        {message.type === 'poi_form' && (
          <POIFormInline
            onSubmit={(data) => {
              window.dispatchEvent(new CustomEvent('poi-form-submitted', { detail: data }));
            }}
            onCancel={() => {
              window.dispatchEvent(new CustomEvent('poi-form-cancelled'));
            }}
          />
        )}

        {/* Fare Form */}
        {message.type === 'fare_form' && (
          <FareFormInline
            onSubmit={(amount) => {
              window.dispatchEvent(new CustomEvent('fare-form-submitted', { detail: { amount } }));
            }}
            onCancel={() => {
              window.dispatchEvent(new CustomEvent('fare-form-cancelled'));
            }}
          />
        )}
      </div>
    </motion.div>
  );
};
