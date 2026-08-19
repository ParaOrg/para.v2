import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface ButtonVersionUIProps {
  commuteState: string;
  transportMode: string;
  currentRouteName: string | null;
  isTracking: boolean;
  onRecordRide: () => void;
  onMyStop: () => void;
  onAddPlace: () => void;
  onAddRoute: () => void;
  onHopOn: () => void;
  onHopOff: () => void;
  onEndRoute: () => void;
  onReportFare: () => void;
}

export const ButtonVersionUI: React.FC<ButtonVersionUIProps> = ({
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
}) => {
  const [showPrimary, setShowPrimary] = useState(true);
  const [vehicleType, setVehicleType] = useState<string | null>(null);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [fare, setFare] = useState<string>('');

  const VEHICLES = [
    { id: 'jeepney', label: 'Jeep', icon: '🚐' },
    { id: 'bus', label: 'Bus', icon: '🚌' },
    { id: 'train', label: 'Train', icon: '🚆' },
    { id: 'trike', label: 'Trike', icon: '🛺' },
    { id: 'uv_express', label: 'UV Express', icon: '🚐' },
    { id: 'grab', label: 'Grab', icon: '🚗' },
    { id: 'angkas', label: 'Angkas', icon: '🏍️' },
  ];

  return (
    <div className="fixed bottom-[70px] left-3 right-3 z-50 bg-white rounded-[20px] shadow-[4px_4px_7px_8px_rgba(0,0,0,0.06)] border border-gray-100 p-3">
      {/* Primary buttons */}
      {showPrimary && commuteState === 'walking' && !isTracking && (
        <div className="grid grid-cols-2 gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onRecordRide}
            className="py-3 bg-[#7A4BC8] text-white rounded-[12px] text-[13px] font-bold font-poppins"
          >
            📍 Record Ride
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onMyStop}
            className="py-3 bg-[#E6D7FF] text-[#381D65] rounded-[12px] text-[13px] font-bold font-poppins"
          >
            ⏳ My Stop
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onAddPlace}
            className="py-3 bg-[#E6D7FF] text-[#381D65] rounded-[12px] text-[13px] font-bold font-poppins"
          >
            📌 Add Place
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onAddRoute}
            className="py-3 bg-[#E6D7FF] text-[#381D65] rounded-[12px] text-[13px] font-bold font-poppins"
          >
            ✏️ Add Route
          </motion.button>
        </div>
      )}

      {/* Tracking state */}
      {isTracking && commuteState === 'walking' && (
        <div className="space-y-2">
          <button
            onClick={onHopOn}
            className="w-full py-3 bg-[#7A4BC8] text-white rounded-[12px] text-[13px] font-bold font-poppins"
          >
            🚐 Hop On
          </button>
          <div className="flex gap-2">
            <button
              onClick={onReportFare}
              className="flex-1 py-2 bg-orange-100 text-orange-700 rounded-[10px] text-[11px] font-semibold"
            >
              ₱ Report Fare
            </button>
            <button
              onClick={onEndRoute}
              className="flex-1 py-2 bg-red-600 text-white rounded-[10px] text-[11px] font-semibold"
            >
              ⏹ End Route
            </button>
          </div>
        </div>
      )}

      {/* Riding state */}
      {commuteState === 'riding' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-[#E6D7FF] rounded-[10px] px-3 py-2">
            <span className="text-lg">{VEHICLES.find(v => v.id === transportMode)?.icon || '🚐'}</span>
            <div className="flex-1">
              <p className="text-[12px] font-bold text-[#381D65] font-poppins">{currentRouteName || 'Riding...'}</p>
              <p className="text-[10px] text-gray-500">{transportMode}</p>
            </div>
          </div>
          <button
            onClick={onHopOff}
            className="w-full py-3 bg-emerald-600 text-white rounded-[12px] text-[13px] font-bold font-poppins"
          >
            🚶 Hop Off
          </button>
        </div>
      )}

      {/* Vehicle picker */}
      {showVehiclePicker && (
        <div className="mt-2">
          <p className="text-[11px] font-semibold text-gray-500 mb-2">Select vehicle type:</p>
          <div className="flex flex-wrap gap-1.5">
            {VEHICLES.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setVehicleType(v.id);
                  setShowVehiclePicker(false);
                }}
                className="px-3 py-1.5 bg-[#E6D7FF] text-[#381D65] rounded-[10px] text-[11px] font-poppins"
              >
                {v.icon} {v.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
