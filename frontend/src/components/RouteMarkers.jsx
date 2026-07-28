import { useEffect, useRef } from "react";
import L from "leaflet";
import { getMarkerIcon } from "./map_constants";

export default function RouteMarkers({ map, markers = [] }) {
    const layerGroup = useRef(null);

    useEffect(() => {
        if (!map || !markers.length) return;
        if (layerGroup.current) map.removeLayer(layerGroup.current);
        const group = L.layerGroup().addTo(map);
        layerGroup.current = group;

        const bounds = L.latLngBounds([]);
        markers.forEach(m => {
            if (m.type === "User_Location") return;
            const icon = getMarkerIcon(m.type);
            const marker = L.marker([m.latitude, m.longitude], { icon }).addTo(group);
            marker.bindPopup(`<b>${m.name || m.type}</b><br><small>${m.latitude.toFixed(5)}, ${m.longitude.toFixed(5)}</small>`);
            bounds.extend([m.latitude, m.longitude]);
        });

        if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });

        return () => { if (layerGroup.current) map.removeLayer(layerGroup.current); };
    }, [map, markers]);

    return null;
}
