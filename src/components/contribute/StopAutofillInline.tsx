import React, { useState, useCallback } from 'react';

interface StopAutofillInlineProps {
  vehicle: string;
  placeholder: string;
  onSelect: (stopName: string) => void;
  onAddNew: (stopName: string) => void;
}

export const StopAutofillInline: React.FC<StopAutofillInlineProps> = ({
  vehicle,
  placeholder,
  onSelect,
  onAddNew,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (val.trim().length >= 2) {
      // Import dynamically to avoid circular deps
      const { getStopsForVehicle, filterStops } = require('../../utils/stopDatabase');
      const stops = getStopsForVehicle(vehicle);
      const filtered = filterStops(stops, val).slice(0, 8);
      setResults(filtered);
      setShowResults(true);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [vehicle]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-gray-50 rounded-[10px] text-[13px] font-poppins text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7A4BC8]"
      />
      {showResults && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-[10px] shadow-lg max-h-40 overflow-y-auto">
          {results.map((stop) => (
            <button
              key={stop}
              onClick={() => {
                onSelect(stop);
                setQuery('');
                setShowResults(false);
              }}
              className="w-full text-left px-3 py-2 text-[12px] font-poppins text-gray-700 hover:bg-[#E6D7FF] transition-colors"
            >
              {stop}
            </button>
          ))}
          {results.length === 0 && (
            <button
              onClick={() => {
                onAddNew(query);
                setQuery('');
                setShowResults(false);
              }}
              className="w-full text-left px-3 py-2 text-[12px] font-poppins text-[#7A4BC8] hover:bg-[#E6D7FF] transition-colors"
            >
              + Add new: "{query}"
            </button>
          )}
        </div>
      )}
    </div>
  );
};
