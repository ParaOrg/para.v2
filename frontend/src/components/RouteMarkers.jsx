import { useEffect, useRef } from "react";
import L from "leaflet";

export default function RouteMarkers({ map, markers = [] }) {
    const layerGroup = useRef(null);

    useEffect(() => {
        if (!map || !markers.length) {
            console.log('⚠️ RouteMarkers: No map or no markers');
            return;
        }
        
        console.log('🔄 RouteMarkers rendering with:', markers.length, 'markers');
        
        // Remove previous layer group
        if (layerGroup.current) {
            map.removeLayer(layerGroup.current);
        }
        
        const group = L.layerGroup().addTo(map);
        layerGroup.current = group;
        const bounds = L.latLngBounds([]);

        markers.forEach((m, index) => {
            // Support BOTH formats:
            // 1. ChatPanel format: { position: [lat,lng], type, label, routeName, isTransfer }
            // 2. Old format: { latitude, longitude, type, name }
            
            let lat, lng;
            
            if (m.position && Array.isArray(m.position) && m.position.length === 2) {
                // ChatPanel format
                [lat, lng] = m.position;
            } else if (m.latitude !== undefined && m.longitude !== undefined) {
                // Old format
                lat = m.latitude;
                lng = m.longitude;
            } else if (m.lat !== undefined && m.lng !== undefined) {
                // Alternative format
                lat = m.lat;
                lng = m.lng;
            } else {
                console.warn('⚠️ Marker missing position:', m);
                return;
            }
            
            console.log(`📍 Marker ${index}: [${lat}, ${lng}] ${m.label || m.name || ''}`);
            
            // Choose icon based on marker type
            let icon;
            const markerType = m.type || 'stop';
            
            if (markerType === 'stop' && !m.isTransfer) {
                // Boarding point - purple circle with jeep emoji
                icon = L.divIcon({
                    className: '',
                    html: `<div style="background:#310775;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">🚐</div>`,
                    iconSize: [22, 22],
                    iconAnchor: [11, 11]
                });
            } else if (m.isTransfer) {
                // Transfer point - amber circle
                icon = L.divIcon({
                    className: '',
                    html: `<div style="background:#f59e0b;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">⬇</div>`,
                    iconSize: [22, 22],
                    iconAnchor: [11, 11]
                });
            } else if (markerType === 'walk-start' || markerType === 'walk-end') {
                // Walk points - gray circle
                icon = L.divIcon({
                    className: '',
                    html: `<div style="background:#9CA3AF;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                });
            } else {
                // Default - small colored dot
                icon = L.divIcon({
                    className: '',
                    html: `<div style="background:${m.color || '#310775'};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                });
            }
            
            const marker = L.marker([lat, lng], { icon }).addTo(group);
            
            // Add tooltip
            const label = m.label || m.routeName || m.name || '';
            if (label) {
                marker.bindTooltip(label, {
                    permanent: false,
                    direction: 'top',
                    offset: [0, -8]
                });
            }
            
            // Add popup with details
            const popupContent = `<b>${label || 'Stop'}</b><br><small>${lat.toFixed(5)}, ${lng.toFixed(5)}</small>`;
            marker.bindPopup(popupContent);
            
            bounds.extend([lat, lng]);
        });

        // Fit map to show all markers
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }

        console.log(`✅ RouteMarkers: Added ${markers.length} markers to map`);

        return () => {
            if (layerGroup.current) {
                map.removeLayer(layerGroup.current);
            }
        };
    }, [map, markers]);

    return null;
}