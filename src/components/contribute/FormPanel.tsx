import { useState, useEffect } from 'react';
import { edgePost } from '../../utils/api';

export function FormPanel({ type, onClose, onSubmit }) {
  const [value, setValue] = useState('');
  const [name, setName] = useState('');
  const [savedRoutes, setSavedRoutes] = useState<string[]>([]);
  const [filtered, setFiltered] = useState<string[]>([]);

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const data = await edgePost('routes-public', {});
        let routes = [];
        if (Array.isArray(data)) routes = data;
        else if (data?.routes) routes = data.routes;
        const names = routes.map(r => r.name || r.route_name).filter(Boolean);
        setSavedRoutes(names);
      } catch {}
    };
    fetchRoutes();
  }, []);

  const handleSubmit = () => {
    if (type === 'fare') {
      onSubmit({ amount: parseFloat(value) });
    } else if (type === 'route') {
      onSubmit({ routeName: name });
    } else if (type === 'place') {
      onSubmit({ name, type: value });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999999] bg-black/50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-[#381D65]">
            {type === 'fare' ? '💰 Report Fare' : type === 'route' ? '🚐 Add Route' : '📍 Add Place'}
          </h3>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>

        {type === 'fare' && (
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Fare amount (₱)"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg"
          />
        )}

        {type === 'route' && (
          <>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                const q = e.target.value.toLowerCase();
                setFiltered(savedRoutes.filter(r => r.toLowerCase().includes(q)).slice(0, 5));
              }}
              placeholder="Route name (e.g. Cubao - Proj 4)"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-2"
            />
            {filtered.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-2">
                {filtered.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { setName(r); setFiltered([]); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    🚐 {r}
                  </button>
                ))}
              </div>
            )}
            {name && !savedRoutes.includes(name) && (
              <p className="text-xs text-green-600 mb-2">+ Will add new route: {name}</p>
            )}
          </>
        )}

        {type === 'place' && (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Place name"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-2"
            />
            <select value={value} onChange={(e) => setValue(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-2">
              <option value="landmark">Landmark</option>
              <option value="business">Business</option>
              <option value="amenity">Amenity</option>
            </select>
          </>
        )}

        <button onClick={handleSubmit} className="w-full mt-4 py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm">
          Submit
        </button>
      </div>
    </div>
  );
}
