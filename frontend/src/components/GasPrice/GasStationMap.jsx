import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import GasStationMarker from './GasStationMarker';
import { useGasStations } from './useGasStations';

const METRO_MANILA = [14.5995, 120.9842];

const BRANDS = {
  shell:     { name: 'Shell',         color: '#E8C200' },
  seaoil:    { name: 'SeaOil',        color: '#1A56DB' },
  caltex:    { name: 'Caltex',        color: '#C8102E' },
  ptt:       { name: 'PTT',           color: '#009A44' },
  cleanfuel: { name: 'Cleanfuel',     color: '#00B2A9' },
  total:     { name: 'TotalEnergies', color: '#EF3340' },
  petron:    { name: 'Petron',        color: '#003087' },
};

export default function GasStationMap() {
  const { stations, loading, error } = useGasStations();
  const [selectedStation, setSelectedStation] = useState(null);
  const [activeBrands, setActiveBrands] = useState(new Set(Object.keys(BRANDS)));
  const [map, setMap] = useState(null);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const m = L.map(mapRef.current, { zoomControl: true }).setView(METRO_MANILA, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m);
    mapInstance.current = m;
    setMap(m);
    return () => { m.remove(); mapInstance.current = null; };
  }, []);

  const toggleBrand = (brand) => {
    setActiveBrands(prev => {
      const next = new Set(prev);
      next.has(brand) ? next.delete(brand) : next.add(brand);
      return next;
    });
  };

  const visibleStations = stations.filter(s => activeBrands.has(s.brand));

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">

      {/* Brand filter bar — horizontally scrollable on mobile */}
      <div className="px-4 py-3.5 flex gap-2 overflow-x-auto border-b border-gray-100 bg-gray-50/80"
           style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <span className="text-xs text-gray-500 font-semibold self-center mr-1 shrink-0">Filter:</span>
        {Object.entries(BRANDS).map(([brand, { name, color }]) => (
          <button
            key={brand}
            onClick={() => toggleBrand(brand)}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 border cursor-pointer"
            style={{
              backgroundColor: activeBrands.has(brand) ? color : '#f3f4f6',
              color: activeBrands.has(brand) ? '#fff' : '#6b7280',
              borderColor: activeBrands.has(brand) ? color : '#e5e7eb',
              boxShadow: activeBrands.has(brand) ? '0 6px 14px rgba(15,23,42,0.12)' : 'none',
            }}
            aria-pressed={activeBrands.has(brand)}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Map area */}
      <div style={{ height: 'clamp(420px, 58vw, 620px)', position: 'relative' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <div className="w-7 h-7 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        {map && visibleStations.map(station => (
          <GasStationMarker
            key={station.id}
            map={map}
            station={station}
            isSelected={selectedStation?.id === station.id}
            onSelect={setSelectedStation}
          />
        ))}
      </div>

      {error && (
        <p className="text-center text-red-400 text-xs py-2 border-t border-gray-100">
          Could not load stations: {error}
        </p>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/70">
        <p className="text-xs text-gray-400">
          {loading ? 'Loading stations…' : `${visibleStations.length} station${visibleStations.length !== 1 ? 's' : ''} shown`}
        </p>
        <p className="text-xs text-gray-400 hidden sm:block">Tap a marker to view prices &amp; report</p>
      </div>
    </div>
  );
}
