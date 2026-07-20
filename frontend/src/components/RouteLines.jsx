/**
 * RouteLines - Renders polylines connecting route points on the map
 */
import { useEffect, useRef } from "react";
import { getLineOptions, getLineColor } from "./map_constants";

export default function RouteLines({ map, lines = [], google }) {
    const polylinesRef = useRef([]);

    useEffect(() => {
        if (!map || !google || !lines.length) return;

        // Clear existing polylines
        polylinesRef.current.forEach(p => p.setMap(null));
        polylinesRef.current = [];

        // Create polyline for each line segment
        lines.forEach((lineData, index) => {
            if (!lineData.points || lineData.points.length < 2) return;

            // Convert points to Google Maps LatLng format
            const path = lineData.points.map(p => ({
                lat: p.latitude,
                lng: p.longitude
            }));

            const lineOptions = getLineOptions(lineData.type);

            const polyline = new google.maps.Polyline({
                path,
                ...lineOptions,
                map,
                zIndex: index
            });

            // Add click listener to show line info
            polyline.addListener("click", (event) => {
                showLineInfo(map, google, event.latLng, lineData);
            });

            polylinesRef.current.push(polyline);
        });

        // Cleanup on unmount
        return () => {
            polylinesRef.current.forEach(p => p.setMap(null));
            polylinesRef.current = [];
        };
    }, [map, lines, google]);

    return null; // This component doesn't render DOM elements
}

// Show info window when clicking on a line
function showLineInfo(map, google, position, lineData) {
    const color = getLineColor(lineData.type);
    const typeLabel = getTransportLabel(lineData.type);
    
    const content = `
        <div style="padding: 8px; min-width: 120px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="
                    width: 20px; 
                    height: 4px; 
                    background: ${color};
                    display: inline-block;
                    border-radius: 2px;
                "></span>
                <strong style="font-size: 13px;">${typeLabel}</strong>
            </div>
        </div>
    `;

    const infoWindow = new google.maps.InfoWindow({
        content,
        position
    });

    infoWindow.open(map);

    // Auto close after 3 seconds
    setTimeout(() => infoWindow.close(), 3000);
}

// Get transport label with emoji
function getTransportLabel(type) {
    const labels = {
        Jeepney: "🚐 Jeepney Route",
        Bus: "🚌 Bus Route",
        Train: "🚇 Train Line",
        UV: "🚐 UV Express",
        Walk: "🚶 Walking",
        Transit: "🚌 Transit"
    };
    return labels[type] || `📍 ${type}`;
}
