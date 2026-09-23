import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { SegmentMode, TrackerState } from '../../types/tracker';
import type { TrackerAction } from '../../reducers/trackerReducer';
import { segmentAvgSpeedKmh, segmentDurationSec } from '../../utils/commuteStats';  // __SPEED_UI__

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const VEHICLE_PICKER: { id: SegmentMode; label: string; icon: string }[] = [
  { id: 'jeepney', label: 'Jeep', icon: '🚐' },
  { id: 'bus', label: 'Bus', icon: '🚌' },
  { id: 'train', label: 'Train', icon: '🚆' },
  { id: 'trike', label: 'Trike', icon: '🛺' },
  { id: 'uv_express', label: 'UV', icon: '🚐' },
  { id: 'grab', label: 'Grab', icon: '🚗' },
  { id: 'angkas', label: 'Angkas', icon: '🏍️' },
];

const VEHICLE_EMOJI: Record<string, string> = {
  walking: '🚶',
  jeepney: '🚐',
  bus: '🚌',
  train: '🚆',
  trike: '🛺',
  uv_express: '🚐',
  grab: '🚗',
  angkas: '🏍️',
};

const VEHICLE_LABEL: Record<string, string> = {
  walking: 'Walking',
  jeepney: 'Jeepney',
  bus: 'Bus',
  train: 'Train',
  trike: 'Tricycle',
  uv_express: 'UV Express',
  grab: 'Grab',
  angkas: 'Angkas',
};

const formatTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const formatKm = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface Props {
  state: TrackerState;
  dispatch: React.Dispatch<TrackerAction>;
  onSave: () => void;
  onAddRoute: (payload: {
    routeName: string;
    mode: SegmentMode;
    routeUuid: string;
  }) => void;
  savedRoutes: Array<{ id: string; name: string; mode: SegmentMode }>;
  savedRoutesLoading: boolean;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function CommuteTrackerV2({
  state,
  dispatch,
  onSave,
  onAddRoute,
  savedRoutes,
  savedRoutesLoading,
}: Props) {
  // Modal state is LOCAL — never in the reducer
  const [hopOnModal, setHopOnModal] = useState(false);
  const [fareModal, setFareModal] = useState(false);
  const [addRouteModal, setAddRouteModal] = useState(false);

  // Hop On modal internals
  const [selectedVehicle, setSelectedVehicle] = useState<SegmentMode | null>(null);
  const [routeInput, setRouteInput] = useState('');
  const [filteredRoutes, setFilteredRoutes] = useState<
    Array<{ id: string; name: string; mode: SegmentMode }>
  >([]);
  const [fareInput, setFareInput] = useState('');
  const [pendingFareFor, setPendingFareFor] = useState<'riding' | 'route_end' | 'log_only'>('log_only');

  // Add Route modal internals
  const [docRouteName, setDocRouteName] = useState('');
  const [docMode, setDocMode] = useState<SegmentMode>('jeepney');
  const [docFilteredRoutes, setDocFilteredRoutes] = useState<
    Array<{ id: string; name: string; mode: SegmentMode }>
  >([]);

  // ─── Handlers ───────────────────────────────────────────

  const handleStartCommute = () => {
    dispatch({ type: 'START_COMMUTE' });
  };

  const handleHopOnPress = () => {
    setSelectedVehicle(null);
    setRouteInput('');
    setFilteredRoutes([]);
    setHopOnModal(true);
  };

  const handleHopOnConfirm = () => {
    if (!selectedVehicle) return;
    const routeName = routeInput.trim() || VEHICLE_LABEL[selectedVehicle] || 'Personal Route';
    const matched = savedRoutes.find((r) => r.name === routeInput.trim());
    dispatch({
      type: 'HOP_ON',
      payload: {
        mode: selectedVehicle,
        routeName,
        routeUuid: matched?.id || null,
        fare: null,
      },
    });
    setHopOnModal(false);
  };

  const handleHopOffPress = () => {
    dispatch({ type: 'HOP_OFF' });
    // Open fare modal — user can enter the fare for the ride that just ended
    setFareInput('');
    setPendingFareFor('riding');
    setFareModal(true);
  };

  const handleFareSubmit = () => {
    const amount = fareInput === '' ? null : parseFloat(fareInput);
    const safeAmount = amount !== null && !isNaN(amount) ? amount : null;
    if (pendingFareFor === 'route_end') {
      dispatch({ type: 'END_ROUTE', payload: { fare: safeAmount } });
      onAddRouteSaveRoute(); // deferred call below
      setFareModal(false);
      return;
    }
    // Attach fare to active segment (works for both walking-fallback and riding)
    dispatch({ type: 'LOG_FARE', payload: safeAmount });
    setFareModal(false);
  };

  const handleFareSkip = () => {
    if (pendingFareFor === 'route_end') {
      dispatch({ type: 'END_ROUTE', payload: { fare: null } });
      onAddRouteSaveRoute();
      setFareModal(false);
      return;
    }
    setFareModal(false);
  };

  const handleEndCommutePress = () => {
    onSave(); // Page wrapper handles payload build + POST
  };

  const handleAddRouteOpen = () => {
    setDocRouteName('');
    setDocMode('jeepney');
    setDocFilteredRoutes([]);
    setAddRouteModal(true);
  };

  const handleAddRouteConfirm = () => {
    if (!docRouteName.trim()) return;
    // Pre-generate the route UUID client-side. On admin approval,
    // this exact UUID becomes ph_routes.route_uuid — no duplicates.
    const routeUuid = crypto.randomUUID();
    dispatch({
      type: 'START_DOCUMENT',
      payload: {
        routeName: docRouteName.trim(),
        mode: docMode,
        routeUuid,
      },
    });
    onAddRoute({
      routeName: docRouteName.trim(),
      mode: docMode,
      routeUuid,
    });
    setDocFilteredRoutes([]);
    setAddRouteModal(false);
  };

  const handleStartRouteTimer = () => {
    dispatch({ type: 'START_ROUTE_TIMER' });
  };

  const handleEndRoutePress = () => {
    setFareInput('');
    setPendingFareFor('route_end');
    setFareModal(true);
  };

  // Forwarded to page for saving a documented route after fare is captured
  const onAddRouteSaveRoute = () => {
    // The page wrapper listens for END_ROUTE via state.documentsRoute
    // and saves on the next render. But to be safe, we also expose a
    // dedicated dispatch-triggered save. Actually, the page watches
    // state.documentPhase transitions, so no explicit call needed here.
  };

  // ─── Derived ────────────────────────────────────────────
  const isCommute = state.flow === 'commute';
  const isDocumenting = state.flow === 'documenting';
  const riding = isCommute && state.commutePhase === 'riding';
  const walking = isCommute && state.commutePhase === 'walking';

  const statusEmoji = riding
    ? VEHICLE_EMOJI[state.activeSegment?.mode || 'jeepney']
    : walking
    ? '🚶'
    : isDocumenting && state.documentPhase === 'recording'
    ? '⏺️'
    : isDocumenting
    ? '📝'
    : '⏸️';

  const statusLabel = riding
    ? `On ${VEHICLE_LABEL[state.activeSegment?.mode || ''] || 'vehicle'}`
    : walking
    ? state.segments.length > 0
      ? 'Walking to next stop'
      : 'Walking to stop'
    : isDocumenting && state.documentPhase === 'recording'
    ? `Recording ${state.documentedRoute?.routeName || ''}`
    : isDocumenting
    ? `Ready: ${state.documentedRoute?.routeName || ''}`
    : 'Idle';

  // ─── Render ─────────────────────────────────────────────
  return (
    <>
      <div className="fixed bottom-24 left-2 right-2 z-30 pointer-events-auto">
        {/* Status pill — only visible during a flow */}
        {state.flow !== 'none' && (
          <div className="bg-white rounded-full shadow-lg px-4 py-2 mb-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg">{statusEmoji}</span>
              <div className="min-w-0">
                <span className="text-xs font-bold text-[#381D65]">
                  {statusLabel}
                </span>
                {(riding || (isDocumenting && state.documentPhase === 'recording')) && (
                  <span className="block text-[10px] text-gray-500 truncate max-w-[150px]">
                    {state.activeSegment?.routeName ||
                      state.documentedRoute?.routeName ||
                      ''}
                  </span>
                )}
              </div>
            </div>
            <span className="text-lg font-black text-[#381D65] tabular-nums shrink-0">
              {formatTime(
                state.flow === 'commute'
                  ? state.totalDurationSec
                  : state.documentedRoute?.durationSec || 0
              )}
            </span>
          </div>
        )}

        {/* Action card */}
        <div className="bg-white rounded-2xl shadow-xl p-3 space-y-2 max-h-[50vh] overflow-y-auto">
          {/* Idle: two buttons */}
          {state.flow === 'none' && (
            <>
              <button
                onClick={handleStartCommute}
                className="w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm"
              >
                🚀 Start Commute
              </button>
              <button
                onClick={handleAddRouteOpen}
                className="w-full py-3 bg-purple-700 text-white rounded-xl font-bold text-sm"
              >
                🚐 Add Route
              </button>
            </>
          )}

          {/* Flow A: Commute */}
          {isCommute && (
            <>
              {walking && (
                <button
                  onClick={handleHopOnPress}
                  className="w-full py-3 bg-purple-800 text-white rounded-xl font-bold text-sm"
                >
                  🚌 Hop On
                </button>
              )}
              {riding && (
                <button
                  onClick={handleHopOffPress}
                  className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold text-sm"
                >
                  🏁 Hop Off
                </button>
              )}
              <button
                onClick={() => {
                  setFareInput('');
                  setPendingFareFor('log_only');
                  setFareModal(true);
                }}
                className="w-full py-2 bg-purple-50 text-[#7A4BC8] rounded-xl font-bold text-xs border border-purple-100"
              >
                💰 Log Fare
              </button>
              <button
                onClick={handleEndCommutePress}
                className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold text-sm"
              >
                🏁 End Commute
              </button>

              {/* Completed segments list */}
              {state.segments.length > 0 && (
                <div className="pt-2 space-y-1 border-t border-gray-100">
                  {state.segments.map((seg, i) => (
                    <div
                      key={seg.id}
                      className="flex items-center justify-between text-[11px] text-gray-500"
                    >
                      <span>
                        {i + 1}. {VEHICLE_EMOJI[seg.mode]}{' '}
                        {seg.routeName || VEHICLE_LABEL[seg.mode] || seg.mode}
                      </span>
                      <span className="flex items-center gap-2">
                        {seg.distanceM > 0 && <span>{formatKm(seg.distanceM)}</span>}
                        {/* __SPEED_UI__ duration + avg speed per segment */}
                        {seg.gpsPoints && seg.gpsPoints.length >= 2 && (
                          <>
                            {segmentDurationSec(seg.gpsPoints) > 0 && (
                              <span>· {formatTime(segmentDurationSec(seg.gpsPoints))}</span>
                            )}
                            {segmentAvgSpeedKmh(seg.gpsPoints) > 0 && (
                              <span>· {segmentAvgSpeedKmh(seg.gpsPoints).toFixed(1)} km/h</span>
                            )}
                          </>
                        )}
                        {seg.fare != null && (
                          <span className="font-bold text-[#7A4BC8]">₱{seg.fare}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Flow B: Documenting route */}
          {isDocumenting && state.documentedRoute && (
            <>
              {state.documentPhase === 'ready' && (
                <button
                  onClick={handleStartRouteTimer}
                  className="w-full py-3 bg-green-500 text-white rounded-xl font-bold text-sm"
                >
                  ▶️ Start Route
                </button>
              )}
              {state.documentPhase === 'recording' && (
                <button
                  onClick={handleEndRoutePress}
                  className="w-full py-3 bg-red-500 text-white rounded-xl font-bold text-sm"
                >
                  ⏹️ End Route
                </button>
              )}
              <button
                onClick={() => dispatch({ type: 'RESET' })}
                className="w-full py-2 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hop On Modal */}
      {hopOnModal &&
        createPortal(
          <div className="fixed inset-0 z-[999999] bg-black/50 flex items-end justify-center">
            <div className="bg-white rounded-t-3xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-[#381D65]">🚌 Hop On</h3>
                <button
                  onClick={() => setHopOnModal(false)}
                  className="text-gray-400 text-xl"
                >
                  ✕
                </button>
              </div>

              {!selectedVehicle ? (
                <>
                  <p className="text-xs font-bold text-[#381D65] mb-2">Select vehicle:</p>
                  <div className="grid grid-cols-4 gap-2">
                    {VEHICLE_PICKER.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVehicle(v.id)}
                        className="py-3 bg-white rounded-lg text-center hover:bg-purple-50 border border-gray-200"
                      >
                        <span className="text-2xl">{v.icon}</span>
                        <span className="block text-[10px] text-gray-600 mt-1">
                          {v.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-2xl">{VEHICLE_EMOJI[selectedVehicle]}</span>
                    <span className="text-sm font-bold text-[#381D65]">
                      {VEHICLE_LABEL[selectedVehicle]}
                    </span>
                    <button
                      onClick={() => setSelectedVehicle(null)}
                      className="ml-auto text-xs text-gray-400 underline"
                    >
                      Change
                    </button>
                  </div>

                  <input
                    value={routeInput}
                    onChange={(e) => {
                      setRouteInput(e.target.value);
                      const q = e.target.value.toLowerCase();
                      setFilteredRoutes(
                        q
                          ? savedRoutes
                              .filter((r) => r.name.toLowerCase().includes(q))
                              .slice(0, 5)
                          : []
                      );
                    }}
                    placeholder={
                      savedRoutesLoading
                        ? 'Loading routes…'
                        : 'Type route name (e.g. Cubao - Proj 4)'
                    }
                    autoFocus
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2"
                  />

                  {filteredRoutes.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-2">
                      {filteredRoutes.map((r) => (
                        <button
                          key={r.id || r.name}
                          type="button"
                          onClick={() => {
                            setRouteInput(r.name);
                            if (r.mode) setSelectedVehicle(r.mode);
                            setFilteredRoutes([]);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 border-b border-gray-100 last:border-0"
                        >
                          🚐 {r.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleHopOnConfirm}
                    className="w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm mt-2"
                  >
                    Start Riding
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* Fare Modal */}
      {fareModal &&
        createPortal(
          <div className="fixed inset-0 z-[999999] bg-black/50 flex items-end justify-center">
            <div className="bg-white rounded-t-3xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-[#381D65]">💰 Log Fare</h3>
                <button
                  onClick={handleFareSkip}
                  className="text-gray-400 text-xl"
                >
                  ✕
                </button>
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={fareInput}
                onChange={(e) => setFareInput(e.target.value)}
                placeholder="e.g. 13 or 0 (free)"
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-bold text-center mb-3"
              />
              <button
                onClick={handleFareSubmit}
                className="w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm"
              >
                Save Fare
              </button>
              <button
                onClick={handleFareSkip}
                className="w-full mt-2 py-2 text-xs text-gray-400"
              >
                Skip
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* Add Route Modal */}
      {addRouteModal &&
        createPortal(
          <div className="fixed inset-0 z-[999999] bg-black/50 flex items-end justify-center">
            <div className="bg-white rounded-t-3xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-[#381D65]">🚐 Add Route</h3>
                <button
                  onClick={() => setAddRouteModal(false)}
                  className="text-gray-400 text-xl"
                >
                  ✕
                </button>
              </div>

              <input
                value={docRouteName}
                onChange={(e) => {
                  const v = e.target.value;
                  setDocRouteName(v);
                  const q = v.trim().toLowerCase();
                  setDocFilteredRoutes(
                    q
                      ? savedRoutes
                          .filter((r) => r.name.toLowerCase().includes(q))
                          .slice(0, 5)
                      : []
                  );
                }}
                placeholder={
                  savedRoutesLoading
                    ? 'Loading routes\u2026'
                    : 'Route name (e.g. Cubao - Proj 4)'
                }
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-3"
              />

              {docFilteredRoutes.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-3 -mt-2">
                  <p className="px-3 py-1 text-[10px] font-bold text-gray-400 bg-gray-50 border-b">
                    Existing routes — tap to reuse name
                  </p>
                  {docFilteredRoutes.map((r) => (
                    <button
                      key={r.id || r.name}
                      type="button"
                      onClick={() => {
                        setDocRouteName(r.name);
                        if (r.mode) setDocMode(r.mode);
                        setDocFilteredRoutes([]);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 border-b border-gray-100 last:border-0"
                    >
                      {VEHICLE_EMOJI[r.mode] || '\u{1F68C}'} {r.name}
                    </button>
                  ))}
                </div>
              )}

              <p className="text-xs font-bold text-[#381D65] mb-2">Select vehicle:</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {VEHICLE_PICKER.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setDocMode(v.id)}
                    className={`py-2 bg-white rounded-lg text-center border ${
                      docMode === v.id
                        ? 'border-[#7A4BC8] bg-purple-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <span className="text-lg">{v.icon}</span>
                    <span className="block text-[10px] text-gray-600">{v.label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={handleAddRouteConfirm}
                disabled={!docRouteName.trim()}
                className="w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
