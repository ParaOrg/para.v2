/**
 * RouteMarkers - Renders transport-specific markers on the map
 */
import { useEffect, useRef } from "react";
import { getMarkerIcon, MARKER_COLORS } from "./map_constants";

export default function RouteMarkers({ map, markers = [], google }) {
    const markersRef = useRef([]);
    const infoWindowRef = useRef(null);

    useEffect(() => {
        if (!map || !google || !markers.length) return;

        // Clear existing markers
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];

        // Close any open info window
        if (infoWindowRef.current) {
            infoWindowRef.current.close();
        }

        // Create info window instance
        infoWindowRef.current = new google.maps.InfoWindow();

        // Create markers for each point
        markers.forEach((markerData, index) => {
            // Skip User_Location as it's handled separately
            if (markerData.type === "User_Location") return;

            const position = { 
                lat: markerData.latitude, 
                lng: markerData.longitude 
            };

            const marker = new google.maps.Marker({
                map,
                position,
                title: markerData.name || markerData.type,
                icon: getMarkerIcon(google, markerData.type),
                animation: google.maps.Animation.DROP,
                zIndex: markerData.type === "End_Destination" ? 100 : 50 - index
            });

            // Add click listener for info window
            marker.addListener("click", () => {
                const content = createInfoWindowContent(markerData);
                infoWindowRef.current.setContent(content);
                infoWindowRef.current.open(map, marker);
            });

            markersRef.current.push(marker);
        });

        // Fit bounds to show all markers
        if (markers.length > 1) {
            const bounds = new google.maps.LatLngBounds();
            markers.forEach(m => {
                bounds.extend({ lat: m.latitude, lng: m.longitude });
            });
            map.fitBounds(bounds, { padding: 50 });
        }

        // Cleanup on unmount
        return () => {
            markersRef.current.forEach(m => m.setMap(null));
            markersRef.current = [];
        };
    }, [map, markers, google]);

    return null; // This component doesn't render DOM elements
}

// Create info window HTML content
function createInfoWindowContent(marker) {
    const color = MARKER_COLORS[marker.type] || MARKER_COLORS.Default;
    const typeLabel = getTypeLabel(marker.type);
    
    return `
        <div style="padding: 8px; min-width: 150px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="
                    width: 12px; 
                    height: 12px; 
                    border-radius: 50%; 
                    background: ${color};
                    display: inline-block;
                "></span>
                <strong style="font-size: 14px;">${marker.name || 'Stop'}</strong>
            </div>
            <div style="color: #666; font-size: 12px;">
                <div>${typeLabel}</div>
                <div style="margin-top: 4px; font-size: 11px; color: #999;">
                    ${marker.latitude.toFixed(6)}, ${marker.longitude.toFixed(6)}
                </div>
            </div>
        </div>
    `;
}

// Get human-readable label for transport type
function getTypeLabel(type) {
    const labels = {
        User_Location: "Your Location",
        End_Destination: "Destination",
        Jeepney: "Jeepney Stop",
        Bus: "Bus Stop",
        Train: "Train Station",
        UV: "UV Express",
        Walk: "Walking Point"
    };
    return labels[type] || `📍 ${type}`;
}
