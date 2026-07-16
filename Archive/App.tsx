import React, { useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Search, MapPin, Navigation, AlertCircle, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons in React
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- TYPES ---
interface Coordinates {
  lat: number;
  lng: number;
}

// Note: Extended to include coordinates for Polyline drawing. 
// Update your FastAPI RouteStep model to include these, or fetch stops separately.
interface RouteStep {
  from_stop: string;
  to_stop: string;
  from_lat?: number;
  from_lng?: number;
  to_lat?: number;
  to_lng?: number;
  route_name: string;
  fare: float;
  time_mins: float;
}

interface RouteResponse {
  total_fare: number;
  total_time: number;
  steps: RouteStep[];
}

// --- GEOCODING SERVICE ---
const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  if (!address.trim()) return null;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { 'User-Agent': 'ParaPH-Mobility-App/1.0' } }
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

// --- COMPONENTS ---

// 1. Map Updater Component (to fly to route when found)
const MapUpdater: React.FC<{ center: Coordinates | null; zoom?: number }> = ({ center, zoom = 13 }) => {
  const map = useMap();
  React.useEffect(() => {
    if (center) {
      map.flyTo([center.lat, center.lng], zoom, { duration: 1.5 });
    }
  }, [center, map, zoom]);
  return null;
};

// 2. Search Form Component
interface SearchFormProps {
  onCalculate: (origin: Coordinates, destination: Coordinates) => void;
  isLoading: boolean;
}
const SearchForm: React.FC<SearchFormProps> = ({ onCalculate, isLoading }) => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const originCoords = await geocodeAddress(origin);
    const destCoords = await geocodeAddress(destination);

    if (!originCoords || !destCoords) {
      setError('Could not find one or both locations. Please be more specific.');
      return;
    }

    onCalculate(originCoords, destCoords);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 w-full max-w-md">
      <div className="flex items-center gap-2 mb-4">
        <Navigation className="text-blue-600" size={24} />
        <h2 className="text-xl font-bold text-gray-800">Para PH Routing</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g., SM City Manila"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g., Ayala Center, Makati"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              required
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Calculating Route...
            </>
          ) : (
            <>
              <Search size={20} />
              Calculate Route
            </>
          )}
        </button>
      </form>
    </div>
  );
};

// 3. Route Details Component
const RouteDetails: React.FC<{ route: RouteResponse }> = ({ route }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 w-full max-w-md mt-4">
      <h3 className="text-lg font-bold text-gray-800 mb-4">Route Summary</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-600">Total Fare</p>
          <p className="text-2xl font-bold text-blue-700">₱{route.total_fare.toFixed(2)}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-600">Est. Time</p>
          <p className="text-2xl font-bold text-green-700">{route.total_time.toFixed(0)} min</p>
        </div>
      </div>

      <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Steps</h4>
        {route.steps.map((step, idx) => (
          <div key={idx} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500 mt-1.5" />
              {idx < route.steps.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 my-1" />}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">{step.route_name}</p>
              <p className="text-sm text-gray-500">
                {step.from_stop} → {step.to_stop}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {step.time_mins} mins • ₱{step.fare.toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [originCoords, setOriginCoords] = useState<Coordinates | null>(null);
  const [destCoords, setDestCoords] = useState<Coordinates | null>(null);
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleCalculate = useCallback(async (origin: Coordinates, destination: Coordinates) => {
    setIsLoading(true);
    setApiError('');
    setRouteData(null);
    setOriginCoords(origin);
    setDestCoords(destination);

    try {
      // NOTE: Using start_lat/end_lat to match your provided Python RouteRequest model
      const payload = {
        start_lat: origin.lat,
        start_lng: origin.lng,
        end_lat: destination.lat,
        end_lng: destination.lng,
      };

      const response = await fetch('http://127.0.0.1:8000/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to fetch route');
      }

      const data: RouteResponse = await response.json();
      setRouteData(data);
    } catch (err: any) {
      setApiError(err.message || 'An error occurred while calculating the route.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Helper to extract polyline coordinates from route steps
  const getPolylinePositions = (): [number, number][] => {
    if (!routeData) return [];
    const positions: [number, number][] = [];
    
    routeData.steps.forEach((step) => {
      // Fallback: If your backend is updated to return coords, use them.
      if (step.from_lat && step.from_lng) {
        positions.push([step.from_lat, step.from_lng]);
      }
      if (step.to_lat && step.to_lng) {
        positions.push([step.to_lat, step.to_lng]);
      }
    });
    
    // Deduplicate consecutive points
    return positions.filter((pos, i, arr) => i === 0 || pos[0] !== arr[i-1][0] || pos[1] !== arr[i-1][1]);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Sidebar / Controls */}
      <div className="w-full lg:w-96 p-4 lg:p-8 flex flex-col gap-4 z-10">
        <SearchForm onCalculate={handleCalculate} isLoading={isLoading} />
        
        {apiError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <p className="text-sm">{apiError}</p>
          </div>
        )}

        {routeData && <RouteDetails route={routeData} />}
      </div>

      {/* Map Interface */}
      <div className="flex-1 relative h-[50vh] lg:h-screen min-h-[400px]">
        <MapContainer
          center={[14.5995, 120.9842]} // Default: Manila
          zoom={12}
          className="w-full h-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapUpdater center={originCoords} />
          
          {originCoords && (
            <Marker position={[originCoords.lat, originCoords.lng]}>
              <Popup>Origin</Popup>
            </Marker>
          )}
          
          {destCoords && (
            <Marker position={[destCoords.lat, destCoords.lng]}>
              <Popup>Destination</Popup>
            </Marker>
          )}

          {routeData && getPolylinePositions().length > 1 && (
            <Polyline 
              pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.8 }} 
              positions={getPolylinePositions()} 
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}