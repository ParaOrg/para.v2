import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import { LiveMapBackground } from '../components/contribute/LiveMapBackground';
import { ButtonVersionUI } from '../components/contribute/ButtonVersionUI';
import { useTrackingConsent } from '../context/TrackingConsentContext';
import GpsIcon from '../components/GpsIcon';
import { useAuth } from '../context/AuthContext';
import { edgePost } from '../utils/api';
import { offlineBuffer, getOrCreateInstallId, generateClientLogId } from '../utils/offlineBuffer';
import { createGpsFilter } from '../utils/gpsFilter';  // __GPS_FILTER_CONTRIBUTE_PAGE__
import { segmentDistance as calculateTotalDistance } from '../utils/commuteStats';  // __STATS_CONSOLIDATED__
import SuccessModal from '../components/SuccessModal';
import WeatherPage from '../components/WeatherPage';

const VEHICLES = [
  { id: 'jeepney', label: 'Jeep', icon: '🚐' },
  { id: 'bus', label: 'Bus', icon: '🚌' },
  { id: 'train', label: 'Train', icon: '🚆' },
  { id: 'trike', label: 'Trike', icon: '🛺' },
  { id: 'uv_express', label: 'UV', icon: '🚐' },
  { id: 'grab', label: 'Grab', icon: '🚗' },
  { id: 'angkas', label: 'Angkas', icon: '🏍️' },
];

const ContributePage: React.FC = () => {
  const { location, requestConsentAndLocation, consent } = useTrackingConsent();
  const { user } = useAuth();
  const [showWeather, setShowWeather] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [pinMode, setPinMode] = useState(false);
  const [commuteTimer, setCommuteTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'walking' | 'riding'>('idle');
  const [currentRouteName, setCurrentRouteName] = useState<string | null>(null);
  const [transportMode, setTransportMode] = useState('jeepney');
  const [isTracking, setIsTracking] = useState(false);
  const [showPlaceForm, setShowPlaceForm] = useState(false);
  const [placeLocation, setPlaceLocation] = useState<{lat: number, lng: number} | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [placeType, setPlaceType] = useState('landmark');
  const [gpsPoints, setGpsPoints] = useState([]);
  const gpsWatchRef = useRef(null);
  const gpsPointsLiveRef = useRef([]);  // __ACCUMULATION_FIX__ live array (mutate freely)
  const gpsFilterRef = useRef(createGpsFilter());  // __GPS_FILTER_CONTRIBUTE_PAGE__
  const startTimeRef = useRef(null);

  // Timer
  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => setCommuteTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  // Listen for POI location selected
  useEffect(() => {
    const handlePoiLocation = (e: CustomEvent) => {
      const { lat, lng } = e.detail;
      setPlaceLocation({ lat, lng });
      setShowPlaceForm(true);
      setPinMode(false);
    };
    window.addEventListener('poi-location-selected', handlePoiLocation as EventListener);
    return () => window.removeEventListener('poi-location-selected', handlePoiLocation as EventListener);
  }, []);

  const startGpsTracking = () => {
    if (!navigator.geolocation) return;
    setGpsPoints([]);
    gpsPointsLiveRef.current = [];  // __ACCUMULATION_FIX__ reset live array
    startTimeRef.current = Date.now();
    gpsFilterRef.current = createGpsFilter();  // __GPS_FILTER_CONTRIBUTE_PAGE__ reset
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const raw = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: pos.timestamp || Date.now(),
          accuracy: pos.coords.accuracy,
        };
        const filtered = gpsFilterRef.current(raw);
        if (!filtered) return;
        const point = {
          lat: filtered.lat,
          lng: filtered.lng,
          timestamp: filtered.timestamp,
        };
        // __ACCUMULATION_FIX__: mutate ref array; commit to state every 5th point
        gpsPointsLiveRef.current.push(point);
        if (gpsPointsLiveRef.current.length % 5 === 0) {
          setGpsPoints(gpsPointsLiveRef.current.slice());
        }
      },
      (err) => console.error('GPS error:', err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };

  const stopGpsTracking = () => {
    if (gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }
  };

  // local calculateTotalDistance removed — imported from ../utils/commuteStats  __STATS_CONSOLIDATED__

  // Start commute
  const handleStartCommute = () => {
    setTimerActive(true);
    setCommuteTimer(0);
    setCurrentPhase('walking');
    setIsTracking(true);
    startGpsTracking();
  };

  // Hop On
  const handleHopOn = () => {
    setCurrentPhase('riding');
    setCommuteTimer(0);
  };

  // Hop Off
  const handleHopOff = () => {
    setCurrentPhase('walking');
    setCommuteTimer(0);
    setCurrentRouteName(null);
  };

  // End commute - SAVE to Supabase
  const handleEndCommute = async () => {
    setTimerActive(false);
    setCurrentPhase('idle');
    setIsTracking(false);

    stopGpsTracking();

    const totalDurationSec = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000) || commuteTimer;
    const totalDistance = calculateTotalDistance(gpsPoints);

    // Hybrid guard (C):
    //   Reject < 30s duration   → not a real commute
    //   Reject < 3 GPS points   → can't plot a line
    //   Accept everything else  → DB trigger flags quality
    if (totalDurationSec < 30) {
      setSuccessMessage('Track at least 30 seconds.');
      setShowSuccess(true);
      return;
    }
    if (gpsPoints.length < 3) {
      setSuccessMessage('Waiting for GPS signal. Move to an open area and retry.');
      setShowSuccess(true);
      return;
    }
    if (totalDistance < 50) {
      setSuccessMessage('Distance too short (min 50m).');
      setShowSuccess(true);
      return;
    }

    const gpsTrack = gpsPoints.map((p) => [p.lat, p.lng]);

    const payload = {
      track_uuid: crypto.randomUUID(),
      client_log_id: generateClientLogId(),
      install_id: getOrCreateInstallId(),
      route_name: currentRouteName || 'Personal Commute',
      total_time_sec: totalDurationSec,
      distance_m: parseFloat(totalDistance.toFixed(2)),
      user_id: user?.id || null,
      user_email: user?.email || null,
      source: 'contribute_button_panel',
      mode: transportMode,
      city: 'Metro Manila',
      region: 'NCR',
      gps_track: gpsTrack,
      gps_points: gpsPoints.length,
      raw_payload: {
        source: 'contribute_button_panel',
        user_id: user?.id || null,
        route_name: currentRouteName || 'Personal Commute',
        total_time_sec: totalDurationSec,
        distance_m: parseFloat(totalDistance.toFixed(2)),
        gps_points: gpsPoints,
        segments: [{
          mode: 'transit',
          startTime: gpsPoints[0]?.timestamp || Date.now(),
          endTime: gpsPoints[gpsPoints.length - 1]?.timestamp || Date.now(),
          gpsPoints: gpsPoints,
          routeName: currentRouteName,
          durationSec: totalDurationSec,
        }],
      },
    };

    setGpsPoints([]);

    if (navigator.onLine) {
      try {
        await edgePost('commute-save', payload);
        setSuccessMessage('Commute saved!');
      } catch {
        await offlineBuffer.addCommute(payload);
        setSuccessMessage('Saved offline - will sync later!');
      }
    } else {
      await offlineBuffer.addCommute(payload);
      setSuccessMessage('Saved offline - will sync later!');
    }
    
    setShowSuccess(true);
  };

  // Select vehicle
  const handleSelectVehicle = (vehicleId: string) => {
    setTransportMode(vehicleId);
    const vehicle = VEHICLES.find(v => v.id === vehicleId);
    setCurrentRouteName(vehicle?.label || vehicleId);
  };

  // Select route
  const handleRouteSelect = (route: { id: string; name: string }) => {
    setCurrentRouteName(route.name);
  };

  // Report fare - SAVE to Supabase
  const handleReportFare = async (data: any) => {
    const payload = {
      fare_amount: data?.amount || data?.fare_amount || 0,
      route_name: currentRouteName || data?.routeName || 'Unknown',
      user_email: user?.email || null,
      mode: transportMode,
      city: 'Metro Manila',
      region: 'NCR',
      reported_at: new Date().toISOString(),
    };

    if (navigator.onLine) {
      try {
        await edgePost('fare-report', payload);
        setSuccessMessage(`Fare ₱${payload.fare_amount} reported!`);
      } catch {
        await offlineBuffer.addFareReport(payload);
        setSuccessMessage('Fare saved offline!');
      }
    } else {
      await offlineBuffer.addFareReport(payload);
      setSuccessMessage('Fare saved offline!');
    }
    setShowSuccess(true);
  };

  // Add route - SAVE to Supabase
  const handleAddRoute = async (data: any) => {
    const routeName = data?.routeName || currentRouteName || 'New Route';
    const mode = data?.mode || transportMode || 'jeepney';
    const payload = {
      route_name: routeName,
      mode: mode,
      submitted_by: user?.email || 'guest',
      is_approved: false,
    };

    if (navigator.onLine) {
      try {
        await edgePost('route-save', payload);
        setSuccessMessage(`Route "${routeName}" submitted!`);
      } catch {
        await offlineBuffer.add('route_saves', { ...payload, timestamp: Date.now() });  // __SYNC_DRAIN_FIX__
        setSuccessMessage('Route saved offline!');
      }
    } else {
      await offlineBuffer.add('route_saves', { ...payload, timestamp: Date.now() });  // __SYNC_DRAIN_FIX__
      setSuccessMessage('Route saved offline!');
    }
    setShowSuccess(true);
  };

  // Save place - SAVE to Supabase
  const handleSavePlace = async () => {
    if (!placeName || !placeLocation) {
      setShowPlaceForm(false);
      return;
    }

    const payload = {
      canonical_name: placeName,
      category: placeType,
      location: `POINT(${placeLocation.lng} ${placeLocation.lat})`,
      lat: placeLocation.lat,
      lng: placeLocation.lng,
      reported_at: new Date().toISOString(),
    };

    if (navigator.onLine) {
      try {
        await edgePost('poi-add', payload);
        setSuccessMessage(`Place "${placeName}" saved!`);
      } catch {
        await offlineBuffer.addPoi(payload);
        setSuccessMessage('Place saved offline!');
      }
    } else {
      await offlineBuffer.addPoi(payload);
      setSuccessMessage('Place saved offline!');
    }
    setShowPlaceForm(false);
    setShowSuccess(true);
    setPlaceName('');
  };

  return (
    <div className="relative w-full h-screen bg-gray-50 overflow-hidden">
      <Navbar />
      {showWeather && <div className="fixed inset-0 z-[9999999]"><WeatherPage onClose={() => setShowWeather(false)} /></div>}

      {/* Timer Pill */}
      <div className="fixed left-4 z-[5000] bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2" style={{ top: "calc(env(safe-area-inset-top) + 5.5rem)" }}>
        <span className="text-sm font-bold text-[#381D65] capitalize">{currentPhase}</span>
        <span className="text-sm font-black text-[#381D65] tabular-nums">
          {Math.floor(commuteTimer / 60)}:{String(commuteTimer % 60).padStart(2, '0')}
        </span>
        {currentRouteName && (
          <span className="text-xs text-gray-500 truncate max-w-[120px]">
            🚐 {currentRouteName}
          </span>
        )}
      </div>

      {/* Map */}
      <div className="absolute inset-0" style={{ zIndex: 1 }}>
        <LiveMapBackground
          isManualDrawingMode={false}
          isTracking={isTracking}
          commuteState={currentPhase}
          currentRouteName={currentRouteName}
          panelHeight="35vh"
          externalPinMode={pinMode}
          onExternalPinModeChange={setPinMode}
        />
      </div>

      {/* Button Panel - Portal */}
      {createPortal(
        <ButtonVersionUI
          commuteState={currentPhase}
          transportMode={transportMode}
          currentRouteName={currentRouteName}
          isTracking={isTracking}
          appMode={currentPhase}
          onRecordRide={handleStartCommute}
          onHopOn={handleHopOn}
          onHopOff={handleHopOff}
          onEndRoute={handleEndCommute}
          onReportFare={handleReportFare}
          onSelectVehicle={handleSelectVehicle}
          onSetPhase={setCurrentPhase}
          onRouteSelect={handleRouteSelect}
          onSetTimerActive={setTimerActive}
          onAddRoute={handleAddRoute}
          onAddPlace={() => setPinMode(true)}
          onMyStop={() => {}}
        />,
        document.body
      )}

      {/* Place Form Modal */}
      {showPlaceForm && (
        <div className="fixed inset-0 z-[999999] bg-black/50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-[#381D65]">📍 Add Place</h3>
              <button onClick={() => setShowPlaceForm(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <input
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              placeholder="Place name"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-2"
            />
            <select value={placeType} onChange={(e) => setPlaceType(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-2">
              <option value="landmark">Landmark</option>
              <option value="business">Business</option>
              <option value="amenity">Amenity</option>
            </select>
            {placeLocation && (
              <p className="text-xs text-gray-400">📍 {placeLocation.lat.toFixed(5)}, {placeLocation.lng.toFixed(5)}</p>
            )}
            <button onClick={handleSavePlace} className="w-full mt-4 py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm">
              Save Place
            </button>
          </div>
        </div>
      )}

      {/* Success Modal */}
      <div className="relative z-[999999]">
        <SuccessModal
          show={showSuccess}
          message={successMessage}
          subtitle="Your contribution helps the community!"
          onClose={() => setShowSuccess(false)}
        />
      </div>
      <BottomNav />
    </div>
  );
};

export default ContributePage;
