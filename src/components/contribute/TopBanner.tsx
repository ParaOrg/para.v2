import React, { useState } from 'react';
import GpsIcon from '../GpsIcon';

interface TopBannerProps {
  uiVersion: 'chat' | 'buttons';
  onToggleVersion: (version: 'chat' | 'buttons') => void;
  isTracking: boolean;
  commuteState: string;
  currentRouteName: string | null;
  onLocate: () => void;
  onWeather: () => void;
  onAddPin: () => void;
  navbarOpen: boolean;
}

export const TopBanner: React.FC<TopBannerProps> = ({
  uiVersion,
  onToggleVersion,
  isTracking,
  commuteState,
  currentRouteName,
  onLocate,
  onWeather,
  onAddPin,
  navbarOpen,
}) => {
  if (navbarOpen) return null;

  return (
    <div className="fixed top-[60px] left-0 right-0 z-[4000] px-3">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-100 px-4 py-3">
        {/* Row 1: Title + Toggle + Actions */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: Title */}
          <div className="min-w-0">
            <h1 className="text-[14px] font-bold text-[#0B122C] font-poppins truncate">Contribute</h1>
            <p className="text-[10px] text-gray-500 font-poppins">
              {isTracking ? 'Session active' : 'Ready to help'}
            </p>
          </div>

          {/* Center: Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
            <button
              onClick={() => onToggleVersion('chat')}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold font-poppins transition-colors ${
                uiVersion === 'chat' ? 'bg-[#7A4BC8] text-white' : 'text-gray-500'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => onToggleVersion('buttons')}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold font-poppins transition-colors ${
                uiVersion === 'buttons' ? 'bg-[#7A4BC8] text-white' : 'text-gray-500'
              }`}
            >
              Buttons
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onLocate}
              className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center border border-gray-200 hover:bg-gray-100"
              title="Locate"
            >
              <GpsIcon size={16} color="#7A4BC8" />
            </button>
            <button
              onClick={onWeather}
              className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center border border-gray-200 hover:bg-gray-100"
              title="Weather"
            >
              <span className="text-sm">🌤️</span>
            </button>
            <button
              onClick={onAddPin}
              className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center border border-gray-200 hover:bg-gray-100"
              title="Add Pin"
            >
              <span className="text-sm">📍</span>
            </button>
          </div>
        </div>

        {/* Row 2: Status */}
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-[10px] font-semibold text-gray-700 font-poppins">
            {isTracking ? `Tracking: ${currentRouteName || 'Walking'}` : 'Not Tracking'}
          </span>
          <span className="text-[10px] text-gray-500 font-poppins">
            • {commuteState === 'riding' ? '🚐' : '🚶'} GPS active
          </span>
        </div>
      </div>
    </div>
  );
};
