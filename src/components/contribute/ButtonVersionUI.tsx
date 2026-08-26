import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { edgePost } from '../../utils/api';

interface ButtonVersionUIProps {
  commuteState: string;
  transportMode: string;
  currentRouteName: string | null;
  isTracking: boolean;
  appMode: string;
  onRecordRide: () => void;
  onMyStop: () => void;
  onAddPlace: () => void;
  onAddRoute: () => void;
  onHopOn: () => void;
  onHopOff: () => void;
  onEndRoute: () => void;
  onReportFare: () => void;
  onSelectVehicle: (vehicleId: string) => void;
}

const VEHICLES = [
  { id: 'jeepney', label: 'Jeep', icon: '🚐' },
  { id: 'bus', label: 'Bus', icon: '🚌' },
  { id: 'train', label: 'Train', icon: '🚆' },
  { id: 'trike', label: 'Trike', icon: '🛺' },
  { id: 'uv_express', label: 'UV Express', icon: '🚐' },
  { id: 'grab', label: 'Grab', icon: '🚗' },
  { id: 'angkas', label: 'Angkas', icon: '🏍️' },
];

export const ButtonVersionUI: React.FC<ButtonVersionUIProps> = ({
  commuteState,
  transportMode,
  currentRouteName,
  isTracking,
  appMode,
  onRecordRide,
  onMyStop,
  onAddPlace,
  onAddRoute,
  onHopOn,
  onHopOff,
  onEndRoute,
  onReportFare,
  onSelectVehicle,
}) => {
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [savingAction, setSavingAction] = useState<string | null>(null);

  const handleAction = (action: string, callback: () => void) => {
    if (savingAction) return;
    setSavingAction(action);
    setTimeout(() => {
      callback();
      setSavingAction(null);
    }, 300);
  };
  const [allRoutes, setAllRoutes] = useState<string[]>([]);
  const [routeSuggestions, setRouteSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch routes for autofill - DIRECT Supabase REST (bypasses Edge Function)
  useEffect(() => {
    console.log('🟢 Fetching routes from Supabase REST...');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    fetch(`${supabaseUrl}/rest/v1/ph_routes?select=name&limit=200`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    })
    .then(r => r.json())
    .then(data => {
      const names = (data || []).map((r) => r.name).filter(Boolean);
      console.log('🟢 Route names loaded:', names.length);
      setAllRoutes(names);
    })
    .catch(err => console.error('❌ Supabase fetch failed:', err));
  }, []);
  const [routeNameInput, setRouteNameInput] = useState('');
  const [showRouteNameInput, setShowRouteNameInput] = useState(false);

  return (
    <div className={`fixed bottom-[70px] left-3 right-3 z-50 bg-white/95 backdrop-blur-md rounded-[20px] shadow-[4px_4px_7px_8px_rgba(0,0,0,0.06)] border border-gray-100 p-4 ${showVehiclePicker ? "overflow-visible" : "max-h-[60vh] overflow-y-auto overscroll-contain"}`}>
      {/* Status Header - always visible */}
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
        <span className={`w-2.5 h-2.5 rounded-full ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        <span className="text-[14px] font-bold text-[#381D65] font-poppins">
          {isTracking 
            ? (commuteState === 'riding' ? `🚐 Riding: ${currentRouteName || 'Unknown'}` : '🚶 Walking')
            : '✨ Ready to contribute'}
        </span>
        {isTracking && (
          <span className="ml-auto text-[10px] bg-[#7A4BC8] text-white rounded-full px-2.5 py-1 font-poppins font-semibold">
            GPS Active
          </span>
        )}
      </div>

      {/* IDLE STATE */}
      {appMode === 'idle' && !isTracking && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onRecordRide}
              className="py-4 bg-[#7A4BC8] text-white rounded-[14px] text-[14px] font-bold font-poppins shadow-sm"
            >
              🚶 Track Commute
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onMyStop}
              className="py-4 bg-[#E6D7FF] text-[#381D65] rounded-[14px] text-[14px] font-bold font-poppins"
            >
              ⏳ My Stop
            </motion.button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onAddPlace}
              className="py-3.5 bg-[#E6D7FF] text-[#381D65] rounded-[14px] text-[14px] font-bold font-poppins"
            >
              📌 Add Place
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onAddRoute}
              className="py-3.5 bg-[#E6D7FF] text-[#381D65] rounded-[14px] text-[14px] font-bold font-poppins"
            >
              ✏️ Add Route
            </motion.button>
          </div>
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onReportFare}
            className="w-full py-3.5 bg-orange-100 text-orange-700 rounded-[14px] text-[14px] font-semibold font-poppins"
          >
            💰 Log Fare
          </motion.button>
        </div>
      )}

      {/* TRACKING - Walking state */}
      {isTracking && commuteState === 'walking' && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 bg-blue-50 rounded-[12px] px-3 py-2.5">
            <span className="text-xl">🚶</span>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-[#381D65] font-poppins">Walking</p>
              <p className="text-[11px] text-gray-500 font-poppins">GPS recording active</p>
            </div>
          </div>
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowVehiclePicker(true)}
            className="w-full py-4 bg-[#7A4BC8] text-white rounded-[14px] text-[14px] font-bold font-poppins"
          >
            🚐 Hop On
          </motion.button>
          
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onAddPlace}
              className="flex-1 py-2.5 bg-[#E6D7FF] text-[#381D65] rounded-[12px] text-[12px] font-semibold font-poppins"
            >
              📌 Drop POI
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onReportFare}
              className="flex-1 py-2.5 bg-orange-100 text-orange-700 rounded-[12px] text-[12px] font-semibold font-poppins"
            >
              💰 Fare
            </motion.button>
          </div>
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onEndRoute}
            className="w-full py-3 bg-red-500 text-white rounded-[14px] text-[14px] font-bold font-poppins"
          >
            ⏹ End Route
          </motion.button>
        </div>
      )}

      {/* Route Name Input - shown when riding but no route name */}
      {commuteState === 'riding' && !currentRouteName && (
        <div className="space-y-2 mb-2 p-3 bg-[#E6D7FF] rounded-[12px]">
          <p className="text-[12px] font-bold text-[#381D65] font-poppins">Which route are you on?</p>
          <div className="relative">
            <input
              type="text"
              value={routeNameInput}
              onChange={(e) => {
                setRouteNameInput(e.target.value);
                if (e.target.value.length > 1) {
                  setRouteSuggestions(allRoutes.filter(r => r.toLowerCase().includes(e.target.value.toLowerCase())).slice(0, 6));
                  setShowSuggestions(true);
                } else {
                  setShowSuggestions(false);
                }
              }}
              placeholder="Type route name (autofill)"
              className="w-full px-3 py-2 bg-white rounded-[10px] text-[13px] font-poppins text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7A4BC8]"
            />
            {showSuggestions && routeSuggestions.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-[10px] shadow-lg max-h-32 overflow-y-auto">
                {routeSuggestions.map((route) => (
                  <button
                    key={route}
                    onClick={() => {
                      setRouteNameInput(route);
                      setShowSuggestions(false);
                      window.dispatchEvent(new CustomEvent('route-name-set', { detail: { routeName: route } }));
                    }}
                    className="w-full text-left px-3 py-2 text-[12px] font-poppins text-gray-700 hover:bg-[#E6D7FF]"
                  >
                    🚐 {route}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setShowSuggestions(false);
                    window.dispatchEvent(new CustomEvent('route-name-set', { detail: { routeName: routeNameInput.trim() } }));
                  }}
                  className="w-full text-left px-3 py-2 text-[12px] font-poppins text-[#7A4BC8] hover:bg-[#E6D7FF] border-t"
                >
                  + Add new: "{routeNameInput}"
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              if (routeNameInput.trim()) {
                window.dispatchEvent(new CustomEvent('route-name-set', { detail: { routeName: routeNameInput.trim() } }));
                setRouteNameInput('');
              }
            }}
            disabled={!routeNameInput.trim()}
            className="w-full py-2 bg-[#7A4BC8] text-white rounded-[10px] text-[12px] font-bold font-poppins disabled:opacity-40"
          >
            ✓ Confirm Route
          </button>
        </div>
      )}

      {/* TRACKING - Riding state */}
      {commuteState === 'riding' && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 bg-[#E6D7FF] rounded-[12px] px-3 py-2.5">
            <span className="text-xl">{VEHICLES.find(v => v.id === transportMode)?.icon || '🚐'}</span>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-[#381D65] font-poppins">{currentRouteName || 'Riding...'}</p>
              <p className="text-[11px] text-gray-500 font-poppins capitalize">{transportMode.replace('_', ' ')}</p>
            </div>
          </div>
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onHopOff}
            className="w-full py-4 bg-emerald-600 text-white rounded-[14px] text-[14px] font-bold font-poppins"
          >
            🚶 Hop Off
          </motion.button>
          
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onAddPlace}
              className="flex-1 py-2.5 bg-[#E6D7FF] text-[#381D65] rounded-[12px] text-[12px] font-semibold font-poppins"
            >
              📌 Drop POI
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onReportFare}
              className="flex-1 py-2.5 bg-orange-100 text-orange-700 rounded-[12px] text-[12px] font-semibold font-poppins"
            >
              💰 Fare
            </motion.button>
          </div>
        </div>
      )}

      {/* Vehicle Picker Modal */}
      {showVehiclePicker && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-end justify-center" onClick={() => setShowVehiclePicker(false)}>
          <div className="bg-white rounded-t-[20px] p-5 w-full max-w-md max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-bold text-[#381D65] font-poppins mb-4 text-center">Select Vehicle</p>
            <div className="grid grid-cols-3 gap-2.5">
              {VEHICLES.map((v) => (
                <motion.button
                  key={v.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    onSelectVehicle(v.id);
                    setShowVehiclePicker(false);
                  }}
                  className="py-4 bg-[#E6D7FF] text-[#381D65] rounded-[14px] text-[13px] font-bold font-poppins flex flex-col items-center gap-1.5"
                >
                  <span className="text-2xl">{v.icon}</span>
                  {v.label}
                </motion.button>
              ))}
            </div>
            <button
              onClick={() => setShowVehiclePicker(false)}
              className="w-full mt-4 py-3 text-gray-400 text-[13px] font-poppins font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
