import React, { useState } from 'react';
import { motion } from 'framer-motion';

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

  return (
    <div className="fixed bottom-[70px] left-3 right-3 z-50 bg-white/95 backdrop-blur-md rounded-[20px] shadow-[4px_4px_7px_8px_rgba(0,0,0,0.06)] border border-gray-100 p-4 max-h-[50vh] overflow-y-auto">
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
          <div className="bg-white rounded-t-[20px] p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
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
