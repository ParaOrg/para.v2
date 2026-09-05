import { useState, useEffect, useRef } from 'react';
import { useTrackingConsent } from '../../context/TrackingConsentContext';
import { analyzeGpsTrack } from '../../utils/gpsDriftDetector';
import { FormPanel } from './FormPanel';

const VEHICLE_LABELS = {
  jeepney: 'Jeepney',
  bus: 'Bus',
  train: 'Train',
  trike: 'Tricycle',
  uv_express: 'UV Express',
  grab: 'Grab',
  angkas: 'Angkas',
};
import { edgePost } from '../../utils/api';

export function ButtonVersionUI(props: any) {
  const {
    commuteState,
    transportMode,
    currentRouteName,
    isTracking,
    onRecordRide,
    onMyStop,
    onAddPlace,
    onAddRoute,
    onHopOn,
    onHopOff,
    onEndRoute,
    onReportFare,
    onSelectVehicle,
    onSetPhase,
    onSetTimerActive,
    onRouteSelect,
  } = props;
  const { location, consent, requestConsentAndLocation } = useTrackingConsent();
  const [gpsPoints, setGpsPoints] = useState([]);
  const [timer, setTimer] = useState(0);
  const [status, setStatus] = useState('idle');
  const [timerActive, setTimerActive] = useState(false);
  const [activeForm, setActiveForm] = useState<'fare' | 'route' | 'place' | null>(null);
  const [showRouteSelector, setShowRouteSelector] = useState(false);
  const [routeInput, setRouteInput] = useState('');
  const manualStatusRef = useRef(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<string[]>([]);
  const [filteredRoutes, setFilteredRoutes] = useState<string[]>([]);

  // Track GPS points for status detection
  useEffect(() => {
    if (!isTracking || !location) return;
    setGpsPoints(prev => [...prev, { lat: location.lat, lng: location.lng, timestamp: Date.now() }]);
  }, [location, isTracking]);

  // Detect status from GPS - ONLY when user hasn't manually set state
  useEffect(() => {
    if (gpsPoints.length < 3) return;
    if (manualStatusRef.current) return; // Don't override manual Hop On/Off
    const analysis = analyzeGpsTrack(gpsPoints.slice(-20));
    setStatus(analysis.mode);
  }, [gpsPoints]);

  // Fetch saved routes
  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const data = await edgePost('routes-public', {});
        console.log('Routes data:', data);
        let routes = [];
        if (Array.isArray(data)) {
          routes = data;
        } else if (data?.routes && Array.isArray(data.routes)) {
          routes = data.routes;
        } else if (data?.data && Array.isArray(data.data)) {
          routes = data.data;
        }
        const names = routes.map(r => r.name || r.route_name).filter(Boolean);
        setSavedRoutes(names);
        console.log('✅ Saved routes loaded:', names.length);
      } catch (e) {
        console.log('Failed to fetch routes:', e);
      }
    };
    fetchRoutes();
  }, []);

  // Timer
  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  const startCommute = () => {
    setTimer(0);
    setTimerActive(true);
    setGpsPoints([]);
    setStatus('walking');
    manualStatusRef.current = true;
    if (onSetPhase) onSetPhase('walking');
    if (onSetTimerActive) onSetTimerActive(true);
    onRecordRide();
  };

  const endCommute = () => {
    setTimer(0);
    setTimerActive(false);
    setStatus('idle');
    setShowRouteSelector(false);
    setRouteInput('');
    if (onSetTimerActive) onSetTimerActive(false);
    if (onSetPhase) onSetPhase('idle');
    onEndRoute();
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const statusEmoji = {
    idle: '⏸️',
    walking: '🚶',
    traffic: '🚗',
    transit: '🚌',
    drift: '📡',
  };

  return (
    <>
    <div className="fixed bottom-16 left-2 right-2 z-[99999] pointer-events-auto">
      {/* GPS Status Pill + Timer - ALWAYS VISIBLE */}
      <div className="bg-white rounded-full shadow-lg px-4 py-2 mb-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{statusEmoji[status] || '📍'}</span>
          <div className="min-w-0">
            <span className="text-xs font-bold text-[#381D65] capitalize">{status}</span>
            {currentRouteName && (
              <span className="block text-[10px] text-gray-500 truncate max-w-[150px]">
                🚐 {currentRouteName}
              </span>
            )}
          </div>
          {consent && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />}
        </div>
        <span className="text-lg font-black text-[#381D65] tabular-nums shrink-0">{formatTime(timer)}</span>
      </div>

      {/* Action Buttons - Scrollable */}
      <div className="bg-white rounded-2xl shadow-xl p-3 space-y-2 max-h-[50vh] overflow-y-auto">
        {!timerActive && (
          <button onClick={startCommute} className="w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm">
            🚀 Start Commute
          </button>
        )}

        {timerActive && (
          <>
            {/* Log Fare - only shows when in transit */}
            {(status === 'transit' || status === 'traffic') && (
              <button onClick={() => setActiveForm('fare')} className="w-full py-3 bg-green-500 text-white rounded-xl font-bold text-sm">
                💰 Log Fare
              </button>
            )}

            {/* Hop On/Off */}
            {status === 'walking' && (
              <button onClick={() => {
    setTimer(0);
    setStatus('transit');
    manualStatusRef.current = true;
    if (onSetPhase) onSetPhase('riding');
    setShowRouteSelector(true);
    onHopOn();
  }} className="w-full py-3 bg-purple-800 text-white rounded-xl font-bold text-sm">
                🚌 Hop On
              </button>
            )}

            {/* Route Selector - shows after Hop On or vehicle select */}
            {showRouteSelector && (
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                {!selectedVehicle ? (
                  <>
                    <p className="text-xs font-bold text-[#381D65]">Select vehicle:</p>
                    <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: 'jeepney', label: 'Jeep', icon: '🚐' },
                    { id: 'bus', label: 'Bus', icon: '🚌' },
                    { id: 'train', label: 'Train', icon: '🚆' },
                    { id: 'trike', label: 'Trike', icon: '🛺' },
                    { id: 'uv_express', label: 'UV', icon: '🚐' },
                    { id: 'grab', label: 'Grab', icon: '🚗' },
                    { id: 'angkas', label: 'Angkas', icon: '🏍️' },
                  ].map(v => (
                    <button type="button" key={v.id} onClick={(e) => { 
    e.preventDefault();
    e.stopPropagation(); 
    onSelectVehicle(v.id); 
    setSelectedVehicle(v.id);
    setStatus('transit');
  }} className="py-2 bg-white rounded-lg text-center hover:bg-gray-100 border border-gray-200 cursor-pointer">
                      <span className="text-lg">{v.icon}</span>
                      <span className="block text-[10px] text-gray-600">{v.label}</span>
                    </button>
                  ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold text-[#381D65]">
                      {VEHICLE_LABELS[selectedVehicle] || 'Selected'}: enter route name
                    </p>
                {/* Route name input */}
                <input
                  value={routeInput}
                  onChange={(e) => {
                    setRouteInput(e.target.value);
                    const q = e.target.value.toLowerCase();
                    setFilteredRoutes(savedRoutes.filter(r => r.toLowerCase().includes(q)).slice(0, 5));
                  }}
                  placeholder="Type route name (e.g. Cubao - Proj 4)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                
                {/* Autofill suggestions */}
                {filteredRoutes.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    {filteredRoutes.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => { setRouteInput(r); setFilteredRoutes([]); onRouteSelect({ id: r, name: r }); setShowRouteSelector(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        🚐 {r}
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Add new route button */}
                {routeInput && !savedRoutes.includes(routeInput) && (
                  <button
                    type="button"
                    onClick={() => { onRouteSelect({ id: 'add-new', name: routeInput }); setShowRouteSelector(false); }}
                    className="w-full py-2 bg-green-500 text-white rounded-lg text-xs font-bold"
                  >
                    + Add new route: {routeInput}
                  </button>
                )}
                
                {/* Quick route buttons */}
                <div className="flex flex-wrap gap-1">
                  {['UP Ikot', 'UP Katipunan', 'UP Philcoa'].map(r => (
                    <button key={r} onClick={() => { setRouteInput(r); onRouteSelect({ id: r, name: r }); setShowRouteSelector(false); }}
                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                      {r}
                    </button>
                  ))}
                  <button onClick={() => { onRouteSelect({ id: 'add-new', name: routeInput || 'New Route' }); setShowRouteSelector(false); }}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                    + Add: {routeInput || 'New Route'}
                  </button>
                </div>
                  </>
                )}
              </div>
            )}


            {(status === 'transit' || status === 'traffic') && (
              <button onClick={() => {
    setTimer(0);
    setStatus('walking');
    manualStatusRef.current = true;
    if (onSetPhase) onSetPhase('walking');
    onHopOff();
    setShowRouteSelector(false);
  }} className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold text-sm">
                🚏 Hop Off
              </button>
            )}

            {/* End Commute */}
            <button onClick={endCommute} className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold text-sm">
              🏁 End Commute
            </button>
          </>
        )}

        {/* Always available */}
        <button type="button" onClick={() => { setActiveForm('route'); setShowRouteSelector(true); }} className="w-full py-3 bg-purple-700 text-white rounded-xl font-bold text-sm">
          🚐 Add Route
        </button>
      </div>
    </div>

      {/* Form Panel */}
      {activeForm && (
        <FormPanel
          type={activeForm}
          onClose={() => setActiveForm(null)}
          onSubmit={(data) => {
            if (activeForm === 'fare') onReportFare(data);
            if (activeForm === 'route') onAddRoute();
            if (activeForm === 'place') onAddPlace();
            setActiveForm(null);
          }}
        />
      )}
    </>
  );
}
