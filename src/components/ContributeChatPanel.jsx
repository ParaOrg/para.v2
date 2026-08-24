import { useState, useEffect, useRef } from "react";

export default function ContributeChatPanel({
  messages = [],
  onSendMessage,
  contextualButtons = [],
  onQuickReply,
  appMode = "idle",
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSendMessage(text);
    setInput("");
  };

  return (
    <div
      className={`
        absolute left-2 right-2 z-20 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden
        transition-all duration-300 ease-in-out
        ${isExpanded ? "h-[40vh]" : "h-[35vh]"}
        flex flex-col
      `}
      style={{ bottom: "84px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isExpanded ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              )}
            </svg>
          </button>
          <div>
            <h2 className="text-[16px] font-medium text-[#0B122C]">Contribute</h2>
            <p className="text-[11px] text-gray-500">
              {appMode === "idle" ? "Ready to help" : `Mode: ${appMode}`}
            </p>
          </div>
        </div>
      </div>

      {/* Contextual Quick Reply Buttons */}
      {contextualButtons.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {contextualButtons.map((button) => (
              <button
                key={button.id}
                onClick={() => onQuickReply(button)}
                className="flex-shrink-0 px-4 py-2 bg-[#E6D7FF] text-[#381D65] rounded-[15px] text-[12px] font-semibold hover:bg-[#d4c0f5] transition-colors"
              >
                {button.icon && <span className="mr-1.5">{button.icon}</span>}
                {button.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl ${message.sender === "user" ? "bg-[#7A4BC8] text-white rounded-br-sm" : "bg-gray-100 text-[#381D65] rounded-bl-sm"}`}>
              <p className="text-[14px] leading-[21px]">{message.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 bg-gray-50 rounded-full text-[14px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7A4BC8]"
          />
          <button onClick={handleSend} disabled={!input.trim()}
            className="flex-shrink-0 w-10 h-10 bg-[#7A4BC8] text-white rounded-full shadow-sm flex items-center justify-center disabled:opacity-40">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-center mt-2">
          <a href="https://www.para-commute.org/privacy-policy" target="_blank" rel="noopener noreferrer"
            className="text-[9px] text-[#7A4BC8] underline">
            Data Privacy
          </a>
        </p>
      </div>
    </div>
  );
}
