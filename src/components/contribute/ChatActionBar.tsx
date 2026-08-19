import React, { useState, useEffect } from 'react';
import { edgePost } from '../../utils/api';
import { motion } from 'framer-motion';
import { QuickReply } from '../../types/contribute';

interface ChatActionBarProps {
  commuteState: string;
  appMode: string;
  currentRouteName: string | null;
  isTracking: boolean;
  location?: { lat: number; lng: number } | null;
  onQuickReply: (reply: QuickReply) => void;
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

const NEARBY_RADIUS_KM = 2; // Show routes within 2km of user

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export const ChatActionBar: React.FC<ChatActionBarProps> = ({
  commuteState,
  appMode,
  currentRouteName,
  isTracking,
  location,
  onQuickReply,
  onSendMessage,
  disabled,
}) => {
  const [input, setInput] = useState('');
  const [nearbyRoutes, setNearbyRoutes] = useState<QuickReply[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [awaitingRouteSelection, setAwaitingRouteSelection] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectingMode, setSelectingMode] = useState(false);
  const [awaitingFareReport, setAwaitingFareReport] = useState(false);

  // Listen for route selection state changes
  useEffect(() => {
    const handleAwaitingRoute = (e: CustomEvent) => {
      setAwaitingRouteSelection(e.detail?.awaiting || false);
    };
    window.addEventListener('set-awaiting-route', handleAwaitingRoute as EventListener);
    return () => {
      window.removeEventListener('set-awaiting-route', handleAwaitingRoute as EventListener);
    };
  }, []);

  // Listen for mode selection
  useEffect(() => {
    const handleModeSelect = (e: CustomEvent) => {
      setSelectingMode(e.detail?.selecting || false);
    };
    window.addEventListener('set-mode-select', handleModeSelect as EventListener);
    return () => {
      window.removeEventListener('set-mode-select', handleModeSelect as EventListener);
    };
  }, []);

  // Listen for fare report
  useEffect(() => {
    const handleFareReport = (e: CustomEvent) => {
      setAwaitingFareReport(e.detail?.awaiting || false);
    };
    window.addEventListener('set-fare-report', handleFareReport as EventListener);
    return () => {
      window.removeEventListener('set-fare-report', handleFareReport as EventListener);
    };
  }, []);

  // Timer — updates every second when tracking
  useEffect(() => {
    if (!isTracking) {
      setElapsedTime(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTracking]);

  // Fetch nearby routes when location changes
  useEffect(() => {
    if (!location) {
      setNearbyRoutes([]);
      return;
    }

    const fetchNearbyRoutes = async () => {
      setIsLoadingRoutes(true);
      try {
        const response = await edgePost('routes-public', {});
        const routes = response.routes || [];
        
        // Filter routes by proximity to user's location
        const nearby = routes
          .filter((route: any) => {
            if (!route.origin_lat || !route.origin_lng) return false;
            const dist = haversineDistance(
              location.lat, 
              location.lng, 
              route.origin_lat, 
              route.origin_lng
            );
            return dist <= NEARBY_RADIUS_KM;
          })
          .map((route: any) => ({
            id: route.route_uuid,
            label: route.name,
            icon: '🚐',
          }))
          .slice(0, 5); // Max 5 suggestions
        
        setNearbyRoutes(nearby);
      } catch (err) {
        console.error('Failed to fetch nearby routes:', err);
        setNearbyRoutes([]);
      } finally {
        setIsLoadingRoutes(false);
      }
    };

    fetchNearbyRoutes();
  }, [location]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSendMessage(text);
    setInput('');
  };

  // Auto-fill contextual quick replies based on state
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const contextualReplies: QuickReply[] = ((): QuickReply[] => {
    if (selectingMode) {
      return [
        { id: 'mode-jeepney', label: 'Jeepney', icon: '🚐' },
        { id: 'mode-bus', label: 'Bus', icon: '🚌' },
        { id: 'mode-train', label: 'Train', icon: '🚆' },
        { id: 'mode-uv', label: 'UV Express', icon: '🚐' },
        { id: 'mode-trike', label: 'Trike', icon: '🛺' },
        { id: 'mode-angkas', label: 'Angkas', icon: '🏍️' },
        { id: 'mode-grab', label: 'Grab', icon: '🚗' },
      ];
    }
    
    if (awaitingFareReport) {
      return [
        { id: 'fare-10', label: '₱10', icon: '💰' },
        { id: 'fare-15', label: '₱15', icon: '💰' },
        { id: 'fare-20', label: '₱20', icon: '💰' },
        { id: 'fare-other', label: 'Other', icon: '✏️' },
      ];
    }

    if (awaitingRouteSelection) {
      const routes = nearbyRoutes.length > 0 ? nearbyRoutes : [
        { id: 'up-ikot', label: 'UP Ikot', icon: '🚐' },
        { id: 'up-katipunan', label: 'UP Katipunan', icon: '🚐' },
        { id: 'up-philcoa', label: 'UP Philcoa', icon: '🚐' },
        { id: 'add-new', label: '+ Add New Route', icon: '➕' },
      ];
      return routes;
    }

    if (appMode === 'idle') {
      return [
        { id: 'track-commute', label: 'Track Commute', icon: '🚶' },
        { id: 'my-stop', label: 'My Stop', icon: '⏳' },
        { id: 'record-route', label: 'Record Route', icon: '🗺️' },
        { id: 'add-poi', label: 'Add Place', icon: '📌' },
        { id: 'upload-file', label: 'Upload', icon: '📁' },
        { id: 'log-fare', label: 'Log Fare', icon: '💰' },
      ];
    }

    if (appMode === 'tracking' && commuteState === 'walking') {
      return [
        { id: 'hop-on', label: 'Hop On', icon: '🚐' },
        { id: 'switch-mode', label: 'Change Mode', icon: '🔄' },
        { id: 'add-pin', label: 'Add Pin', icon: '📍' },
        { id: 'end-route', label: 'End Route', icon: '⏹' },
      ];
    }

    if (appMode === 'tracking' && commuteState === 'riding') {
      return [
        { id: 'hop-off', label: 'Hop Off', icon: '🚶' },
        { id: 'add-pin', label: 'Add Pin', icon: '📍' },
        { id: 'end-route', label: 'End Route', icon: '⏹' },
      ];
    }

    return [];
  })();

  const handleContextualReply = (reply: QuickReply) => {
    if (reply.id === 'hop-on') {
      onQuickReply({ id: 'hop-on', label: 'Hop On', icon: '🚐' });
    } else if (reply.id === 'hop-off') {
      onQuickReply({ id: 'hop-off', label: 'Hop Off', icon: '🚶' });
    } else if (reply.id === 'add-pin') {
      onQuickReply({ id: 'add-pin', label: 'Add Pin', icon: '📍' });
    } else if (reply.id === 'end-route') {
      onQuickReply({ id: 'end-route', label: 'End Route', icon: '⏹' });
    } else {
      onQuickReply(reply);
    }
  };

  return (
    <div className="bg-white px-3 py-2.5">
      {/* Contextual quick replies — auto-filled */}
      {contextualReplies.length > 0 && (
        <div className="mb-2 flex items-center gap-1 overflow-x-auto whitespace-nowrap pb-1">
          {contextualReplies.map((reply) => (
            <motion.button
              key={reply.id}
              whileTap={{ scale: 0.92 }}
              onClick={() => handleContextualReply(reply)}
              disabled={disabled}
              className="px-2.5 py-1 rounded-[10px] bg-[#E6D7FF] text-[#381D65] text-[11px] leading-[15px] font-poppins transition-all active:scale-95 hover:bg-[#d4c0f5] disabled:opacity-50 whitespace-nowrap"
            >
              {reply.icon && <span className="mr-1">{reply.icon}</span>}
              {reply.label}
            </motion.button>
          ))}
        </div>
      )}

      {/* Status line */}
      {currentRouteName && (
        <div className="mb-2 text-[9px] text-gray-500 flex items-center gap-2 px-1 font-poppins">
          <span className={`w-1.5 h-1.5 rounded-full ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="font-semibold text-gray-700">{currentRouteName}</span>
          {isTracking && (
            <span className="bg-[#7A4BC8] text-white rounded-full px-2 py-0.5 text-[9px] font-bold tabular-nums">
              ⏱ {formatTime(elapsedTime)}
            </span>
          )}
        </div>
      )}

      {/* Chat input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          disabled={disabled}
          className="flex-1 min-w-0 px-4 py-2.5 bg-gray-50 rounded-full text-[11px] text-gray-800 placeholder-gray-400 font-poppins focus:outline-none focus:ring-2 focus:ring-[#7A4BC8] disabled:opacity-50"
        />

        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          className="flex-shrink-0 w-10 h-10 bg-[#7A4BC8] text-white rounded-full shadow-sm flex items-center justify-center disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
};
