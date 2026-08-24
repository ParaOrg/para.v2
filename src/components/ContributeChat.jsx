export default function ContributeChat({ input, setInput, onSend, placeholder }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        placeholder={placeholder}
        className="flex-1 text-base outline-none text-[#381D65] placeholder-gray-400"
      />
      <button onClick={onSend} className="bg-[#7A4BC8] text-white w-8 h-8 rounded-full flex items-center justify-center shrink-0">
        <span className="text-xs">➤</span>
      </button>
    </div>
  );
}
