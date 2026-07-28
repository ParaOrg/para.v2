import { useEffect, useRef } from "react";
import L from "leaflet";
import { getLineOptions } from "./map_constants";

export default function RouteLines({ map, lines = [] }) {
    const layerGroup = useRef(null);

    useEffect(() => {
        if (!map || !lines.length) return;
        if (layerGroup.current) map.removeLayer(layerGroup.current);
        const group = L.layerGroup().addTo(map);
        layerGroup.current = group;

        lines.forEach((lineData) => {
            if (!lineData.points || lineData.points.length < 2) return;
            const coords = lineData.points.map(p => [p.latitude, p.longitude]);
            const opts = getLineOptions(lineData.type);
            const polyline = L.polyline(coords, opts).addTo(group);
            polyline.bindPopup(`<b>${lineData.type || "Route"}</b>`);
        });

        return () => { if (layerGroup.current) map.removeLayer(layerGroup.current); };
    }, [map, lines]);

    return null;
}
