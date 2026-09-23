import { useState, useEffect, useReducer, useRef, useCallback } from 'react';
import { createGpsFilter } from '../utils/gpsFilter';  // __GPS_FILTER_COMMUTE_TRACKER__
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import WeatherPage from '../components/WeatherPage';
import SuccessModal from '../components/SuccessModal';
import { LiveMapBackground } from '../components/contribute/LiveMapBackground';
import CommuteTrackerV2 from '../components/contribute/CommuteTrackerV2';
import { useAuth } from '../context/AuthContext';
import { useTrackingConsent } from '../context/TrackingConsentContext';
import { edgePost } from '../utils/api';
import {
  offlineBuffer,
  getOrCreateInstallId,
  generateClientLogId,
} from '../utils/offlineBuffer';
import { startNativeTracking, stopNativeTracking, ensureNotificationPermission } from '../utils/nativeTracker'; // __NOTIF_PERMISSION_WIRED__
import OemBatteryOnboarding from '../components/OemBatteryOnboarding'; // __OEM_ONBOARDING_WIRED__
import {
  trackerReducer,
  initialTrackerState,
} from '../reducers/trackerReducer';
import type { SegmentMode, GpsPoint } from '../types/tracker';

/**
 * CommuteTrackerPage — owns the reducer, the map wiring, and the save flow.
 *
 * Flow:
 *   START_COMMUTE → reducer opens walking segment
 *   GPS points → dispatch GPS_POINT → reducer appends to active segment
 *   HOP_ON → reducer closes walking, opens riding
 *   HOP_OFF → reducer closes riding, opens walking
 *   END_COMMUTE → page reads state.commute.segments, builds payload, POSTs
 *
 * LiveMapBackground receives the accumulated path so it can draw:
 *   - completed segments in their mode colors
 *   - the active segment as a growing polyline
 *
 * Map controls (GPS / pin / weather) are now rendered by LiveMapBackground
 * itself. The page no longer draws its own duplicate toolbar.
 */
export default function CommuteTrackerPage() {
  const { user } = useAuth();
  const { requestConsentAndLocation } = useTrackingConsent();
  const navigate = useNavigate();

  // ─── Reducer is the single source of truth ───────────────
  const [state, dispatch] = useReducer(trackerReducer, initialTrackerState);

  // ─── Local UI state ──────────────────────────────────────
  const [showWeather, setShowWeather] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [pinMode, setPinMode] = useState(false);
  const [showPlaceForm, setShowPlaceForm] = useState(false);
  const [placeLocation, setPlaceLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [placeType, setPlaceType] = useState('landmark');

  // Saved routes for the picker
  const [savedRoutes, setSavedRoutes] = useState<Array<{ id: string; name: string; mode: SegmentMode }>>([]);
  const [savedRoutesLoading, setSavedRoutesLoading] = useState(true);

  // Access gate
  const hasAccess = true; // open to all; auth handled upstream

  // ─── GPS watcher — one at a time, driven by state ────────
  const gpsFilterRef = useRef(createGpsFilter());  // __GPS_FILTER_COMMUTE_TRACKER__  // __REBASE_RESOLVED_TRACKER__
  const flowActive =
    state.flow === 'commute' ||
    (state.flow === 'documenting' && state.documentPhase === 'recording');

  useEffect(() => {
    if (!flowActive) {
      stopNativeTracking();
      return;
    }

    // Reset the filter each time a new session starts
    gpsFilterRef.current = createGpsFilter();  // __GPS_FILTER_COMMUTE_TRACKER__ reset

    let cancelled = false;
    ensureNotificationPermission().then(() => {
      if (cancelled) return;
      // __NOTIF_PERMISSION_WIRED__ proceed regardless of grant — user may
      // have denied; we still start tracking, but Android may kill the
      // service after ~5 min if notifications are denied.
    });
    startNativeTracking(
      (point) => {
        if (cancelled) return;
        const filtered = gpsFilterRef.current(point);
        if (!filtered) return;
        const cleaned: GpsPoint = {
          lat: filtered.lat,
          lng: filtered.lng,
          timestamp: filtered.timestamp,
          accuracy: filtered.accuracy,
        };
        dispatch({ type: 'GPS_POINT', payload: cleaned });
      },
      (err) => {
        console.error('[trackerPage] native GPS error:', err.code, err.message);
      }
    ).catch((e) => {
      console.error('[trackerPage] startNativeTracking failed:', e);
    });
    return () => {
      cancelled = true;
      stopNativeTracking();
    };
  }, [flowActive]);

  // ─── 1-second ticker ─────────────────────────────────────
  useEffect(() => {
    if (state.flow === 'none') return;
    const iv = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(iv);
  }, [state.flow]);

  // ─── Fetch saved routes on mount ─────────────────────────
  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const data = await edgePost('routes-public', {});
        let routes: any[] = [];
        if (Array.isArray(data)) routes = data;
        else if (data?.routes) routes = data.routes;
        else if (data?.data) routes = data.data;
        const objs = routes
          .map((r) => ({
            id: r.route_uuid || r.id || r.uuid || '',
            name: r.name || r.route_name || '',
            mode: (r.mode || 'jeepney') as SegmentMode,
          }))
          .filter((r) => r.name);
        setSavedRoutes(objs);
      } catch (e) {
        console.warn('[trackerPage] routes fetch failed:', e);
      } finally {
        setSavedRoutesLoading(false);
      }
    };
    fetchRoutes();
  }, []);

  // ─── Listen for POI location selected via map pin ────────
  useEffect(() => {
    const handlePoiLocation = (e: CustomEvent) => {
      const { lat, lng } = e.detail;
      setPlaceLocation({ lat, lng });
      setShowPlaceForm(true);
      setPinMode(false);
    };
    window.addEventListener('poi-location-selected', handlePoiLocation as EventListener);
    return () =>
      window.removeEventListener('poi-location-selected', handlePoiLocation as EventListener);
  }, []);

  // ─── Save handlers ───────────────────────────────────────

  const handleEndCommute = useCallback(async () => {
    const snapshot = {
      segments: state.segments,
      activeSegment: state.activeSegment,
      commuteStartedAt: state.commuteStartedAt,
    };

    const allSegments = [...snapshot.segments];
    if (snapshot.activeSegment) {
      allSegments.push({
        ...snapshot.activeSegment,
        endedAt: Date.now(),
        durationSec: Math.round((Date.now() - snapshot.activeSegment.startedAt) / 1000),
      });
    }

    const meaningful = allSegments.filter(
      (s) => s.gpsPoints.length > 0 || s.distanceM > 10 || s.fare != null
    );

    dispatch({ type: 'END_COMMUTE' });

    if (meaningful.length === 0) {
      setSuccessMessage('No movement recorded.');
      setShowSuccess(true);
      return;
    }

    const totalDurationSec = meaningful.reduce((s, seg) => s + seg.durationSec, 0);
    const totalDistanceM = meaningful.reduce((s, seg) => s + seg.distanceM, 0);
    const totalGpsPoints = meaningful.reduce((s, seg) => s + seg.gpsPoints.length, 0);
    const totalFare = meaningful.reduce((s, seg) => s + (seg.fare || 0), 0);
    const primary = meaningful.find((s) => s.mode !== 'walking') || meaningful[0];

    const payload = {
      track_uuid: crypto.randomUUID(),
      client_log_id: generateClientLogId(),
      install_id: getOrCreateInstallId(),
      route_name: primary.routeName || 'Personal Commute',
      route_uuid: primary.routeUuid,
      mode: primary.mode,
      total_time_sec: totalDurationSec,
      distance_m: parseFloat(totalDistanceM.toFixed(2)),
      total_fare: totalFare,
      user_id: user?.id || null,
      user_email: user?.email || null,
      source: 'commute_tracker_v2',
      city: 'Metro Manila',
      region: 'NCR',
      gps_points: totalGpsPoints,
      gps_track: primary.gpsPoints.map((p) => [p.lat, p.lng]),
      raw_payload: {
        source: 'commute_tracker_v2',
        flow: 'multi_modal',
        user_id: user?.id || null,
        total_time_sec: totalDurationSec,
        distance_m: parseFloat(totalDistanceM.toFixed(2)),
        total_fare: totalFare,
        segments: meaningful.map((s) => ({
          mode: s.mode,
          route_name: s.routeName,
          route_uuid: s.routeUuid,
          fare: s.fare,
          distance_m: parseFloat(s.distanceM.toFixed(2)),
          duration_sec: s.durationSec,
          gps_points: s.gpsPoints.map((p) => [p.lat, p.lng]),
          started_at: s.startedAt,
          ended_at: s.endedAt,
        })),
      },
      review_status: 'pending',
    };

    if (navigator.onLine) {
      try {
        const response = await edgePost('commute-save', payload);
        if (response?.status === 'error') {
          setSuccessMessage(`Could not save: ${response.message}`);
        } else if (response?.code === 'DUPLICATE') {
          setSuccessMessage('Already saved — thanks!');
        } else if (response?.status === 'success') {
          const rides = meaningful.filter((s) => s.mode !== 'walking').length;
          setSuccessMessage(
            `Commute saved! ${rides} ride${rides === 1 ? '' : 's'} · ${(totalDistanceM / 1000).toFixed(2)} km · ₱${totalFare}`
          );
        } else {
          setSuccessMessage('Unexpected response. Try again.');
        }
      } catch (err) {
        await offlineBuffer.addCommute(payload);
        setSuccessMessage('Saved offline — will sync when online.');
      }
    } else {
      await offlineBuffer.addCommute(payload);
      setSuccessMessage('Saved offline — will sync when online.');
    }
    setShowSuccess(true);
  }, [state.segments, state.activeSegment, state.commuteStartedAt, user]);

  // Watch for documented route ending (END_ROUTE closes it) → save
  const lastDocSaveRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.flow !== 'documenting') return;
    if (state.documentPhase !== 'idle') return;
    const dr = state.documentedRoute;
    if (!dr || !dr.endedAt) return;
    if (lastDocSaveRef.current === `${dr.startedAt}-${dr.endedAt}`) return;
    lastDocSaveRef.current = `${dr.startedAt}-${dr.endedAt}`;

    (async () => {
      if (dr.gpsPoints.length < 2) {
        setSuccessMessage('Route too short — no GPS recorded.');
        setShowSuccess(true);
        dispatch({ type: 'RESET' });
        return;
      }
      const payload = {
        track_uuid: crypto.randomUUID(),
        client_log_id: generateClientLogId(),
        install_id: getOrCreateInstallId(),
        route_name: dr.routeName,
        route_uuid: dr.routeUuid,
        mode: dr.mode,
        total_time_sec: dr.durationSec,
        distance_m: parseFloat(dr.distanceM.toFixed(2)),
        total_fare: dr.fare || 0,
        user_id: user?.id || null,
        user_email: user?.email || null,
        source: 'add_route_flow',
        city: 'Metro Manila',
        region: 'NCR',
        gps_points: dr.gpsPoints.length,
        gps_track: dr.gpsPoints.map((p) => [p.lat, p.lng]),
        raw_payload: {
          source: 'add_route_flow',
          flow: 'route_documentation',
          user_id: user?.id || null,
          route_name: dr.routeName,
          mode: dr.mode,
          total_time_sec: dr.durationSec,
          distance_m: parseFloat(dr.distanceM.toFixed(2)),
          total_fare: dr.fare || 0,
          segments: [
            {
              mode: dr.mode,
              route_name: dr.routeName,
              route_uuid: dr.routeUuid,
              fare: dr.fare,
              distance_m: parseFloat(dr.distanceM.toFixed(2)),
              duration_sec: dr.durationSec,
              gps_points: dr.gpsPoints.map((p) => [p.lat, p.lng]),
              started_at: dr.startedAt,
              ended_at: dr.endedAt,
            },
          ],
        },
        review_status: 'pending',
      };
      if (navigator.onLine) {
        try {
          const response = await edgePost('commute-save', payload);
          if (response?.status === 'error') {
            setSuccessMessage(`Could not save: ${response.message}`);
          } else {
            setSuccessMessage(`Route "${dr.routeName}" submitted! Awaiting admin approval.`);
          }
        } catch {
          await offlineBuffer.addCommute(payload);
          setSuccessMessage('Saved offline — will sync when online.');
        }
      } else {
        await offlineBuffer.addCommute(payload);
        setSuccessMessage('Saved offline — will sync when online.');
      }
      setShowSuccess(true);
      dispatch({ type: 'RESET' });
    })();
  }, [state.flow, state.documentPhase, state.documentedRoute, user]);

  // ─── Other handlers ──────────────────────────────────────

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

  const handleAddRouteConfirm = (payload: {
    routeName: string;
    mode: SegmentMode;
    routeUuid: string;
  }) => {
    console.log('[trackerPage] Add Route started:', payload.routeUuid, payload.routeName);
  };

  // ─── Access denied ───────────────────────────────────────
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <span className="text-5xl">🔒</span>
          <h1 className="text-2xl font-black text-gray-900 mt-4">Beta access only</h1>
          <p className="text-sm text-gray-500 mt-2">
            This new tracker is currently available to beta testers, admins, and founders.
          </p>
          <button
            onClick={() => navigate('/contribute')}
            className="mt-6 px-6 py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm"
          >
            Go to Contribute
          </button>
        </div>
      </div>
    );
  }

  // ─── Derive the path data for the map ────────────────────
  const completedPaths = state.segments.map((s) => ({
    id: s.id,
    mode: s.mode,
    points: s.gpsPoints.map((p) => [p.lat, p.lng] as [number, number]),
    isActive: false,
  }));
  const activePath = state.activeSegment
    ? {
        id: state.activeSegment.id,
        mode: state.activeSegment.mode,
        points: state.activeSegment.gpsPoints.map((p) => [p.lat, p.lng] as [number, number]),
        isActive: true,
      }
    : null;

  const documentedPath = state.documentedRoute && state.documentedRoute.gpsPoints.length > 0
    ? {
        id: 'documented-route',
        mode: state.documentedRoute.mode,
        points: state.documentedRoute.gpsPoints.map((p) => [p.lat, p.lng] as [number, number]),
        isActive: state.documentPhase === 'recording',
      }
    : null;
  const commutePaths = [
    ...completedPaths,
    ...(activePath ? [activePath] : []),
    ...(documentedPath ? [documentedPath] : []),
  ];

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="relative w-full h-screen bg-gray-50 overflow-hidden">
      <OemBatteryOnboarding />
      <Navbar />

      {showWeather && (
        <div className="fixed inset-0 z-[9999999]">
          <WeatherPage onClose={() => setShowWeather(false)} />
        </div>
      )}

      {/* Map — receives live path data. Renders its own controls. */}
      <div className="absolute inset-0" style={{ zIndex: 1 }}>
        <LiveMapBackground
          isManualDrawingMode={false}
          isTracking={state.flow !== 'none'}
          commuteState={state.commutePhase}
          currentRouteName={state.activeSegment?.routeName || null}
          panelHeight="35vh"
          externalPinMode={pinMode}
          onExternalPinModeChange={setPinMode}
          commutePaths={commutePaths}
        />
      </div>

      {/* V2 Tracker — presentational */}
      <CommuteTrackerV2
        state={state}
        dispatch={dispatch}
        onSave={handleEndCommute}
        onAddRoute={handleAddRouteConfirm}
        savedRoutes={savedRoutes}
        savedRoutesLoading={savedRoutesLoading}
      />

      {/* Place form */}
      {showPlaceForm && (
        <div className="fixed inset-0 z-[999999] bg-black/50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-[#381D65]">📍 Add Place</h3>
              <button
                onClick={() => setShowPlaceForm(false)}
                className="text-gray-400 text-xl"
              >
                ✕
              </button>
            </div>
            <input
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              placeholder="Place name"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-2"
            />
            <select
              value={placeType}
              onChange={(e) => setPlaceType(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-2"
            >
              <option value="landmark">Landmark</option>
              <option value="business">Business</option>
              <option value="amenity">Amenity</option>
            </select>
            {placeLocation && (
              <p className="text-xs text-gray-400">
                📍 {placeLocation.lat.toFixed(5)}, {placeLocation.lng.toFixed(5)}
              </p>
            )}
            <button
              onClick={handleSavePlace}
              className="w-full mt-4 py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm"
            >
              Save Place
            </button>
          </div>
        </div>
      )}

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
}
