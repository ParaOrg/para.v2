/**
 * MapComponent - Main Google Maps component with route visualization
 */
import { useEffect, useRef, useState } from "react";
import { useGoogleMaps } from "../hooks/useGoogleMaps";
import RouteMarkers from "./RouteMarkers";
import RouteLines from "./RouteLines";
import RouteLegend from "./RouteLegend";
import { getMarkerIcon } from "./map_constants";

const DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 };

export default function MapComponent({
    apiKey,
    userLocation,
    markers = [],
    lines = []
}) {
    const { loaded, error } = useGoogleMaps(apiKey);
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const userMarkerRef = useRef(null);
    const [google, setGoogle] = useState(null);
    const mapCenter = userLocation ?? DEFAULT_CENTER;

    useEffect(() => {
        if (!loaded || !mapRef.current) return;

        const googleApi = window.google;
        setGoogle(googleApi);

        if (!mapInstance.current) {
            mapInstance.current = new googleApi.maps.Map(mapRef.current, {
                zoom: 13,
                center: mapCenter,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: true,
                zoomControl: true,
                styles: mapStyles,
            });
        } else {
            mapInstance.current.setCenter(mapCenter);
        }

        if (userLocation) {
            if (!userMarkerRef.current) {
                userMarkerRef.current = new googleApi.maps.Marker({
                    map: mapInstance.current,
                    position: userLocation,
                    title: "Your Location",
                    icon: getMarkerIcon(googleApi, "User_Location"),
                    zIndex: 1000,
                    animation: googleApi.maps.Animation.DROP,
                });

                userMarkerRef.current.addListener("click", () => {
                    const infoWindow = new googleApi.maps.InfoWindow({
                        content: `
                            <div style="padding: 8px;">
                                <strong>📍 Your Location</strong>
                                <div style="font-size: 11px; color: #666; margin-top: 4px;">
                                    ${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}
                                </div>
                            </div>
                        `,
                    });
                    infoWindow.open(mapInstance.current, userMarkerRef.current);
                });
            } else {
                userMarkerRef.current.setPosition(userLocation);
            }
        }
    }, [loaded, userLocation, mapCenter]);

    useEffect(() => {
        if (!mapInstance.current || !google) return;

        const handleResize = () => {
            google.maps.event.trigger(mapInstance.current, "resize");
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [google]);

    return (
        <div className="relative h-full w-full">
            <div ref={mapRef} className="h-full w-full rounded-xl shadow-lg" />

            {mapInstance.current && google && (
                <>
                    <RouteLines map={mapInstance.current} lines={lines} google={google} />
                    <RouteMarkers map={mapInstance.current} markers={markers} google={google} />
                </>
            )}

            <RouteLegend markers={markers} lines={lines} />

            {!loaded && !error && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-gray-100">
                    <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                        <span className="text-sm text-gray-600">Loading map...</span>
                    </div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-gray-50 p-6 text-center">
                    <div>
                        <p className="font-semibold text-gray-800">Map could not load</p>
                        <p className="mt-1 text-sm text-gray-500">Check your Google Maps API key or browser network access.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

const mapStyles = [
    {
        featureType: "poi",
        elementType: "labels",
        stylers: [{ visibility: "off" }],
    },
    {
        featureType: "transit",
        elementType: "labels.icon",
        stylers: [{ visibility: "on" }],
    },
];
