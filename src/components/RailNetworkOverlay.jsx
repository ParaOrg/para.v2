import { useEffect, useRef } from 'react';
import L from 'leaflet';

const SUPABASE_URL = 'https://tcvomrkytxnetzijwqad.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdm9tcmt5dHhuZXR6aWp3cWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzY3NDgsImV4cCI6MjA3MzAxMjc0OH0.ljYfw72N5dm4GsM1yKvV4bNNb8sWEoErTD3TrGz1s0o';

const RAIL_LINE_COLORS = {
  'LRT Line 1': '#00A650',
  'LRT Line 2': '#7A4BC8',
  'MRT Line 3': '#FF6B00',
};

export default function RailNetworkOverlay({ map }) {
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    
    if (layerRef.current) {
      layerRef.current.remove();
    }
    
    const railLayer = L.layerGroup().addTo(map);
    layerRef.current = railLayer;

    // Fetch rail lines and draw them
    fetch(`${SUPABASE_URL}/rest/v1/rail_network_lines?select=id,name,railway,geom&limit=500`, {
      headers: { apikey: SUPABASE_KEY }
    })
    .then(r => r.json())
    .then(lines => {
      const lineNames = {};
      lines.forEach(line => {
        const geom = line.geom;
        if (!geom || !geom.coordinates) return;
        
        const name = line.name || 'Rail';
        if (!lineNames[name]) lineNames[name] = [];
        
        const coords = geom.coordinates.map(([lng, lat]) => [lat, lng]);
        lineNames[name].push(coords);
      });

      // Draw each rail line as colored polyline
      Object.entries(lineNames).forEach(([lineName, segments]) => {
        const color = RAIL_LINE_COLORS[lineName] || '#7A4BC8';
        segments.forEach(coords => {
          if (coords.length < 2) return;
          L.polyline(coords, {
            color,
            weight: 4,
            opacity: 0.8,
            dashArray: lineName === 'MRT Line 3' ? '5, 5' : null,
          }).addTo(railLayer);
        });
      });
    });

    // Fetch rail stations and draw markers
    fetch(`${SUPABASE_URL}/rest/v1/rail_station_points?select=fid,name,geom&order=fid.asc&limit=500`, {
      headers: { apikey: SUPABASE_KEY }
    })
    .then(r => r.json())
    .then(stations => {
      stations.forEach(station => {
        const geom = station.geom;
        if (!geom || !geom.coordinates) return;
        
        const [lng, lat] = geom.coordinates;
        const name = station.name || 'Station';
        
        const icon = L.divIcon({
          className: 'rail-station-marker',
          html: `<div style="
            width: 10px; height: 10px; 
            background: #fff; 
            border: 3px solid #7A4BC8; 
            border-radius: 50%;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          "></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });
        
        L.marker([lat, lng], { icon })
          .addTo(railLayer)
          .bindTooltip(name, { permanent: false, direction: 'top' });
      });
    });

    return () => {
      if (layerRef.current) {
        layerRef.current.remove();
        layerRef.current = null;
      }
    };
  }, [map]);

  return null;
}
