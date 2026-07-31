import { useEffect, useRef } from "react";
import L from "leaflet";

export default function RouteLines({ map, lines = [] }) {
    const layerGroup = useRef(null);

    useEffect(() => {
        if (!map || !lines.length) {
            console.log('⚠️ RouteLines: No map or no lines');
            return;
        }
        
        console.log('🔄 RouteLines rendering with:', lines.length, 'lines');
        
        // Remove previous layer group
        if (layerGroup.current) {
            map.removeLayer(layerGroup.current);
        }
        
        const group = L.layerGroup().addTo(map);
        layerGroup.current = group;

        lines.forEach((lineData, index) => {
            // Support BOTH formats:
            // 1. ChatPanel format: { coordinates: [[lat,lng],...], color, weight, opacity, dashed }
            // 2. Old format: { points: [{latitude, longitude},...], type }
            
            let coords;
            
            if (lineData.coordinates && Array.isArray(lineData.coordinates)) {
                // ChatPanel format - already [lat, lng] arrays
                coords = lineData.coordinates;
            } else if (lineData.points && Array.isArray(lineData.points)) {
                // Old format - array of {latitude, longitude}
                coords = lineData.points.map(p => [p.latitude, p.longitude]);
            } else {
                console.warn('⚠️ Line missing coordinates:', lineData);
                return;
            }
            
            if (coords.length < 2) {
                console.warn('⚠️ Line has fewer than 2 points:', coords.length);
                return;
            }
            
            console.log(`📏 Line ${index}: ${coords.length} points, first:`, coords[0]);
            
            const polyline = L.polyline(coords, {
                color: lineData.color || '#310775',
                weight: lineData.weight || 4,
                opacity: lineData.opacity || 0.8,
                dashArray: lineData.dashed ? '8, 5' : null,
            }).addTo(group);
            
            // Add popup if route name available
            if (lineData.routeName) {
                polyline.bindPopup(`<b>${lineData.routeName}</b>`);
            }
        });

        console.log('✅ RouteLines: Added lines to map');

        return () => {
            if (layerGroup.current) {
                map.removeLayer(layerGroup.current);
            }
        };
    }, [map, lines]);

    return null;
}