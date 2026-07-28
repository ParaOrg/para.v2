import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import StationInfoPanel from './StationInfoPanel';

const BRAND_COLORS = {
  shell:     '#E8C200',
  seaoil:    '#1A56DB',
  caltex:    '#C8102E',
  ptt:       '#009A44',
  cleanfuel: '#00B2A9',
  total:     '#EF3340',
  petron:    '#003087',
};

function buildIcon(station, isSelected) {
  const color = BRAND_COLORS[station.brand] ?? '#555';
  const html = renderToStaticMarkup(
    <div style={{
      width: 38,
      height: 38,
      borderRadius: '50%',
      backgroundColor: color,
      border: isSelected ? '3px solid #fff' : '2.5px solid rgba(255,255,255,0.85)',
      boxShadow: isSelected
        ? `0 0 0 2px ${color}, 0 4px 10px rgba(0,0,0,0.4)`
        : '0 2px 6px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: isSelected ? 'scale(1.2)' : 'scale(1)',
    }}>
      <img
        src={`/logos/${station.brand}.svg`}
        alt={station.brand}
        style={{ width: 24, height: 24, objectFit: 'contain' }}
      />
    </div>
  );

  return L.divIcon({
    html,
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

// Renders one gas station as a Leaflet marker + popup on an existing map instance.
// Managed imperatively via useEffect (no react-leaflet) to match this codebase's
// existing raw-Leaflet pattern in map_component.jsx.
export default function GasStationMarker({ map, station, isSelected, onSelect }) {
  const markerRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    const marker = L.marker([station.lat, station.lng], { icon: buildIcon(station, isSelected) });
    marker.on('click', () => onSelect(isSelected ? null : station));
    marker.addTo(map);
    markerRef.current = marker;
    return () => marker.remove();
  }, [map, station, isSelected, onSelect]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || !isSelected) return;
    const popupHtml = renderToStaticMarkup(<StationInfoPanel station={station} />);
    marker.bindPopup(popupHtml, { maxWidth: 320 }).openPopup();
    const onClose = () => onSelect(null);
    marker.on('popupclose', onClose);
    return () => marker.off('popupclose', onClose);
  }, [isSelected, station, onSelect]);

  return null;
}
