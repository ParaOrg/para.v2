import { useState, useEffect } from "react";
import { getApiBaseUrl } from "../utils/api";

const API = getApiBaseUrl();

export default function RouteNameInput({ value, onChange, onExistingSelect }) {
  const [routes, setRoutes] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`${API}/routes/public`)
      .then(r => r.json())
      .then(d => {
        const all = d.routes || [];
        setRoutes(all);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!value.trim()) {
      setFiltered(routes.slice(0, 10));
      return;
    }
    const q = value.toLowerCase();
    const matches = routes.filter(r => (r.name || "").toLowerCase().includes(q));
    setFiltered(matches.slice(0, 10));
  }, [value, routes]);

  const handleSelect = (name) => {
    onChange(name);
    setOpen(false);
    if (onExistingSelect) onExistingSelect(name);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setOpen(false);
      // Enter = confirm new name
    }
  };

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Type route name or select existing..."
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-[#7A4BC8]"
      />

      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((r, i) => (
            <button
              key={r.route_uuid || i}
              type="button"
              onMouseDown={() => handleSelect(r.name)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 flex items-center gap-2"
            >
              <span className="text-xs">🚌</span>
              <span className="truncate">{r.name}</span>
              {r.mode && <span className="ml-auto text-[10px] text-gray-400">{r.mode}</span>}
            </button>
          ))}
          {!filtered.some(r => (r.name || "").toLowerCase() === value.toLowerCase()) && value.trim() && (
            <div className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">
              Press Enter to create "{value}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
