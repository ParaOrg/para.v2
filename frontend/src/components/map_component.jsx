import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import RouteMarkers from "./RouteMarkers";
import RouteLines from "./RouteLines";
import RouteLegend from "./RouteLegend";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const DEFAULT_CENTER = [14.5995, 120.9842];

export default function MapComponent({ userLocation, markers = [], lines = [], routes = [], showLegend = true, fitBounds = true }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const [ready, setReady] = useState(false);

    // Debug logging - INSIDE the function body
    useEffect(() => {
        console.log('🗺️ MapComponent - markers:', markers?.length, 'lines:', lines?.length);
        if (markers?.length > 0) console.log('🗺️ First marker:', markers[0]);
        if (lines?.length > 0) console.log('🗺️ First line:', lines[0]);
    }, [markers, lines]);

    // Initialize map once
    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;
        console.log('🗺️ Creating map...');
        const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false })
            .setView(DEFAULT_CENTER, 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
        mapInstance.current = map;
        setReady(true);
        console.log('🗺️ Map ready!');
        
        return () => { 
            map.remove(); 
            mapInstance.current = null; 
        };
    }, []);

    // Update center when userLocation changes
    useEffect(() => {
        if (!mapInstance.current || !userLocation) return;
        mapInstance.current.setView([userLocation.lat, userLocation.lng], 13);
    }, [userLocation]);

    return (
        <div className="relative h-full w-full">
            <div ref={mapRef} className="h-full w-full rounded-xl shadow-lg" />
            {ready && mapInstance.current && (
                <>
                    <RouteLines map={mapInstance.current} lines={lines} />
                    <RouteMarkers map={mapInstance.current} markers={markers} />
                </>
            )}
            {showLegend && <RouteLegend markers={markers} lines={lines} />}
            {!ready && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-gray-100">
                    <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                        <span className="text-sm text-gray-600">Loading map...</span>
                    </div>
                </div>
            )}
        </div>
    );
}