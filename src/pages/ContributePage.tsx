import React, { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import { LiveMapBackground } from '../components/contribute/LiveMapBackground';
import { ChatPanel } from '../components/contribute/ChatPanel';
import { ButtonVersionUI } from '../components/contribute/ButtonVersionUI';
import { contributeReducer, initialState, createMessage } from '../reducers/contributeReducer';
import { useTrackingConsent } from '../context/TrackingConsentContext';
import { useAuth } from '../context/AuthContext';
import { QuickReply } from '../types/contribute';
import { edgePost } from '../utils/api';
import { offlineBuffer } from '../utils/offlineBuffer';
import SuccessModal from '../components/SuccessModal';
import { fetchWeather, getWeatherPenalty, isFloodZone } from '../utils/weather';
import { detectIntent, extractPreferences, normalize } from '../utils/nlpEngine';
import { getGuestUuid, addPendingContribution } from '../utils/guestLink';

const MOCK_ROUTES = [
  { id: 'up-ikot', name: 'UP Ikot' },
  { id: 'up-katipunan', name: 'UP Katipunan' },
  { id: 'up-philcoa', name: 'UP Philcoa' },
  { id: 'add-new', name: '+ Add New Route' },
];

const VEHICLES = [
  { id: 'jeepney', label: 'Jeep', icon: '🚐' },
  { id: 'bus', label: 'Bus', icon: '🚌' },
  { id: 'train', label: 'Train', icon: '🚆' },
  { id: 'trike', label: 'Trike', icon: '🛺' },
  { id: 'uv_express', label: 'UV Express', icon: '🚐' },
  { id: 'grab', label: 'Grab', icon: '🚗' },
  { id: 'angkas', label: 'Angkas', icon: '🏍️' },
];

const ContributePage: React.FC = () => {
  const [state, dispatch] = useReducer(contributeReducer, initialState);
  const navigate = useNavigate();
  const hasGreeted = useRef(false);
  const [transportMode, setTransportMode] = useState<string>('jeepney');
  const [pendingFareReport, setPendingFareReport] = useState(false);
  const [awaitingFareReport, setAwaitingFareReport] = useState(false);
  const [awaitingRouteSelection, setAwaitingRouteSelection] = useState(false);
  const [routeDrawingMode, setRouteDrawingMode] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [uiVersion, setUiVersion] = useState<'chat' | 'buttons'>('chat');
  const [navbarOpen, setNavbarOpen] = useState(false);
  const { location, requestConsentAndLocation } = useTrackingConsent();
  const { user, isLoggedIn } = useAuth();
  const segmentStartTime = useRef<number | null>(null);
  const segmentsRef = useRef<Array<{ mode: string; routeName: string | null; startTime: number; endTime: number | null; durationSec: number | null; weather?: any }>>([]);

  useEffect(() => {
    const handlePoiLocation = (e: CustomEvent) => {
      const { lat, lng } = e.detail;
      window.__lastPinLocation = { lat, lng };
      dispatch({ type: 'ADD_MESSAGE', payload: createMessage('user', 'text', `📍 Pin location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`) });
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'poi_form', 'Fill in the pin details:'),
      });
    };
    window.addEventListener('poi-location-selected', handlePoiLocation as EventListener);
    
    const handleAwaitingRoute = (e: CustomEvent) => {
      setAwaitingRouteSelection(e.detail?.awaiting || false);
    };
    window.addEventListener('set-awaiting-route', handleAwaitingRoute as EventListener);
    
    const handleAwaitingFare = (e: CustomEvent) => {
      setAwaitingFareReport(e.detail?.awaiting || false);
    };
    window.addEventListener('set-fare-report', handleAwaitingFare as EventListener);
    
    const handleLocationPrompt = () => {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '📍 To center the map on your location and start recording routes, please tap the GPS button (top-right) and allow location access.'),
      });
    };
    window.addEventListener('location-prompt', handleLocationPrompt as EventListener);
    
    const handlePoiFormSubmitted = async (e: CustomEvent) => {
      const data = e.detail;
      const pinLocation = window.__lastPinLocation || { lat: null, lng: null };
      const payload = {
        ...data,
        lat: pinLocation.lat,
        lng: pinLocation.lng,
        reported_at: new Date().toISOString(),
      };
      
      console.log('🟢 POI form submitted:', payload);
      
      // Track for guest claiming
      if (!isLoggedIn) {
        addPendingContribution({ type: 'poi', payload });
      }
      
      if (!navigator.onLine) {
        await offlineBuffer.addPoi(payload);
        dispatch({ type: 'REMOVE_LAST_FORM' });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'text', `✅ Pin saved offline! Will sync when online.`),
        });
      } else {
        try {
          await edgePost('poi-add', payload);
          dispatch({ type: 'REMOVE_LAST_FORM' });
          setShowSuccess(true);
          setSuccessMessage(`Pin saved: ${data.name}`);
          dispatch({
            type: 'ADD_MESSAGE',
            payload: createMessage('bot', 'text', `✅ Pin saved: ${data.name} (${data.type})`),
          });
        } catch (err) {
          console.error('Failed to save POI:', err);
          await offlineBuffer.addPoi(payload);
          dispatch({ type: 'REMOVE_LAST_FORM' });
          dispatch({
            type: 'ADD_MESSAGE',
            payload: createMessage('bot', 'text', '⚠️ Could not save pin online. Queued for sync.'),
          });
        }
      }
    };
    window.addEventListener('poi-form-submitted', handlePoiFormSubmitted as EventListener);

    const handleFareFormSubmitted = async (e: CustomEvent) => {
      const { amount } = e.detail;
      const payload = {
        fare_amount: amount,
        mode: 'transit',
        route_name: state.currentRouteName || 'Personal Route',
        city: null,  // Will be derived from GPS reverse geocoding
        reported_at: new Date().toISOString(),
      };
      
      console.log('🟢 Fare form submitted:', payload);
      
      // Track for guest claiming
      if (!isLoggedIn) {
        addPendingContribution({ type: 'fare', payload });
      }
      
      if (!navigator.onLine) {
        await offlineBuffer.addFareReport(payload);
        dispatch({ type: 'REMOVE_LAST_FORM' });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'text', `✅ Fare ₱${amount} saved offline! Will sync when online.`),
        });
      } else {
        try {
          await edgePost('fare-report', payload);
          dispatch({ type: 'REMOVE_LAST_FORM' });
          setShowSuccess(true);
          setSuccessMessage(`Fare ₱${amount} recorded`);
          dispatch({
            type: 'ADD_MESSAGE',
            payload: createMessage('bot', 'text', `✅ Fare ₱${amount} recorded. Thank you!`),
          });
        } catch (err) {
          console.error('Failed to save fare:', err);
          await offlineBuffer.addFareReport(payload);
          dispatch({ type: 'REMOVE_LAST_FORM' });
          dispatch({
            type: 'ADD_MESSAGE',
            payload: createMessage('bot', 'text', '⚠️ Could not save fare online. Queued for sync.'),
          });
        }
      }
    };
    window.addEventListener('fare-form-submitted', handleFareFormSubmitted as EventListener);

    const handleRouteNameSet = (e: CustomEvent) => {
      const routeName = e.detail?.routeName;
      if (routeName) {
        dispatch({ type: 'SET_ROUTE_NAME', payload: routeName });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'text', `🚐 Riding on ${routeName}. Timer started.`),
        });
      }
    };
    window.addEventListener('route-name-set', handleRouteNameSet as EventListener);

    const handlePoiFormCancelled = () => {
      dispatch({ type: 'REMOVE_LAST_FORM' });
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', 'Pin cancelled.'),
      });
    };
    window.addEventListener('poi-form-cancelled', handlePoiFormCancelled as EventListener);

    const handleFareFormCancelled = () => {
      dispatch({ type: 'REMOVE_LAST_FORM' });
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', 'Fare report cancelled.'),
      });
    };
    window.addEventListener('fare-form-cancelled', handleFareFormCancelled as EventListener);

    const handleOffCourse = (e: CustomEvent) => {
      const { deviation, routeName } = e.detail;
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', `⚠️ You appear to be ${deviation}m off your planned route (${routeName}). Do you want to re-route or continue?`),
      });
      window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: true } }));
    };
    window.addEventListener('off-course-alert', handleOffCourse as EventListener);
    return () => {
      window.removeEventListener('poi-location-selected', handlePoiLocation as EventListener);
      window.removeEventListener('set-awaiting-route', handleAwaitingRoute as EventListener);
      window.removeEventListener('set-fare-report', handleAwaitingFare as EventListener);
      window.removeEventListener('location-prompt', handleLocationPrompt as EventListener);
      window.removeEventListener('off-course-alert', handleOffCourse as EventListener);
      window.removeEventListener('poi-form-cancelled', handlePoiFormCancelled as EventListener);
      window.removeEventListener('route-name-set', handleRouteNameSet as EventListener);
      window.removeEventListener('fare-form-cancelled', handleFareFormCancelled as EventListener);
      window.removeEventListener('poi-form-submitted', handlePoiFormSubmitted as EventListener);
      window.removeEventListener('fare-form-submitted', handleFareFormSubmitted as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleNavToggle = (e: CustomEvent) => {
      setNavbarOpen(e.detail?.open || false);
    };
    window.addEventListener('navbar-toggle', handleNavToggle as EventListener);
    return () => {
      window.removeEventListener('navbar-toggle', handleNavToggle as EventListener);
    };
  }, []);

  useEffect(() => {
    if (hasGreeted.current) return;
    hasGreeted.current = true;

    const greeting = createMessage(
      'bot',
      'text',
      'Welcome to Contribute! Here you can help improve Para PH by sharing your commute data.\n\nYou can either:\n📱 TAP the buttons above\n⌨️ TYPE the equivalent text\n\nTransport modes (type or tap):\n🚐 "jeep" | 🚌 "bus" | 🚆 "train" | 🚐 "uv" | 🛺 "trike" | 🏍️ "angkas" | 🚗 "grab"\n\nActions (type or tap):\n"hop on" | "hop off" | "end route" | "add pin" | "log fare" | "my stop" | "record route" | "upload"\n\nOr just type naturally — "help" for emergency.\n\n🔒 Your location data is only collected with consent and anonymized for community insights. Type "privacy" for more info.'
    );
    dispatch({ type: 'ADD_MESSAGE', payload: greeting });
  }, []);

  const handleQuickReply = useCallback((reply: QuickReply) => {
    dispatch({ type: 'ADD_MESSAGE', payload: createMessage('user', 'text', reply.label) });

    switch (reply.id) {
      case 'track-commute':
        dispatch({ type: 'SET_APP_MODE', payload: 'tracking' });
        dispatch({ type: 'SET_TRACKING', payload: true });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'text', 'Starting commute tracking. Use the buttons below to Hop On.'),
        });
        break;

      case 'record-route':
        handleRecordRoute();
        break;

      case 'finish-route':
        handleFinishRoute();
        break;

      case 'record-route-old':
        dispatch({ type: 'SET_APP_MODE', payload: 'recording' });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'text', 'Which route would you like to record? Select from the buttons above.'),
        });
        break;

      case 'upload-file':
        dispatch({ type: 'SET_APP_MODE', payload: 'uploading' });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'inline_form', 'Drop your GPX/GeoJSON/KML file here. (Upload UI coming soon)'),
        });
        break;

      case 'poi-business':
      case 'poi-landmark':
      case 'poi-amenity':
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'poi_form', 'Fill in the pin details:'),
        });
        break;

      case 'mode-jeepney':
        setTransportMode('jeepney');
        window.dispatchEvent(new CustomEvent('set-mode-select', { detail: { selecting: false } }));
        window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: true } }));
        dispatch({ type: 'ADD_MESSAGE', payload: createMessage('bot', 'text', '🚐 Jeepney selected. Which route are you boarding?') });
        break;

      case 'mode-bus':
        setTransportMode('bus');
        window.dispatchEvent(new CustomEvent('set-mode-select', { detail: { selecting: false } }));
        window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: true } }));
        dispatch({ type: 'ADD_MESSAGE', payload: createMessage('bot', 'text', '🚌 Bus selected. Which route are you boarding?') });
        break;

      case 'mode-train':
        setTransportMode('train');
        window.dispatchEvent(new CustomEvent('set-mode-select', { detail: { selecting: false } }));
        window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: true } }));
        dispatch({ type: 'ADD_MESSAGE', payload: createMessage('bot', 'text', '🚆 Train selected. Which station are you boarding?') });
        break;

      case 'mode-uv':
        setTransportMode('uv_express');
        window.dispatchEvent(new CustomEvent('set-mode-select', { detail: { selecting: false } }));
        window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: true } }));
        dispatch({ type: 'ADD_MESSAGE', payload: createMessage('bot', 'text', '🚐 UV Express selected. Which route are you boarding?') });
        break;

      case 'mode-trike':
        setTransportMode('trike');
        dispatch({ type: 'SET_COMMUTE_STATE', payload: 'riding' });
        dispatch({ type: 'SET_ROUTE_NAME', payload: 'Tricycle' });
        window.dispatchEvent(new CustomEvent('set-mode-select', { detail: { selecting: false } }));
        dispatch({ type: 'ADD_MESSAGE', payload: createMessage('bot', 'text', '🛺 Tricycle ride started. Add a pin for your destination later.') });
        break;

      case 'mode-angkas':
        setTransportMode('angkas');
        dispatch({ type: 'SET_COMMUTE_STATE', payload: 'riding' });
        dispatch({ type: 'SET_ROUTE_NAME', payload: 'Angkas' });
        window.dispatchEvent(new CustomEvent('set-mode-select', { detail: { selecting: false } }));
        dispatch({ type: 'ADD_MESSAGE', payload: createMessage('bot', 'text', '🏍️ Angkas ride started. Add a pin for your destination later.') });
        break;

      case 'mode-grab':
        setTransportMode('grab');
        dispatch({ type: 'SET_COMMUTE_STATE', payload: 'riding' });
        dispatch({ type: 'SET_ROUTE_NAME', payload: 'Grab' });
        window.dispatchEvent(new CustomEvent('set-mode-select', { detail: { selecting: false } }));
        dispatch({ type: 'ADD_MESSAGE', payload: createMessage('bot', 'text', '🚗 Grab ride started. Add a pin for your destination later.') });
        break;

      case 'switch-mode':
        window.dispatchEvent(new CustomEvent('set-mode-select', { detail: { selecting: true } }));
        dispatch({ type: 'ADD_MESSAGE', payload: createMessage('bot', 'text', 'Type a transport mode or select from buttons: 🚐 Jeepney, 🚌 Bus, 🚆 Train, 🚐 UV Express, 🛺 Trike, 🏍️ Angkas, 🚗 Grab') });
        break;

      case 'hop-on':
        handleHopOn();
        break;

      case 'hop-off':
        handleHopOff();
        break;

      case 'fare-10':
        dispatch({ type: 'ADD_MESSAGE', payload: createMessage('user', 'text', '₱10') });
        dispatch({ type: 'ADD_MESSAGE', payload: createMessage('bot', 'text', 'Fare recorded: ₱10. Thank you!') });
        window.dispatchEvent(new CustomEvent('set-fare-report', { detail: { awaiting: false } }));
        break;

      case 'fare-15':
        dispatch({ type: 'ADD_MESSAGE', payload: createMessage('user', 'text', '₱15') });
        dispatch({ type: 'ADD_MESSAGE', payload: createMessage('bot', 'text', 'Fare recorded: ₱15. Thank you!') });
        window.dispatchEvent(new CustomEvent('set-fare-report', { detail: { awaiting: false } }));
        break;

      case 'fare-20':
        dispatch({ type: 'ADD_MESSAGE', payload: createMessage('user', 'text', '₱20') });
        dispatch({ type: 'ADD_MESSAGE', payload: createMessage('bot', 'text', 'Fare recorded: ₱20. Thank you!') });
        window.dispatchEvent(new CustomEvent('set-fare-report', { detail: { awaiting: false } }));
        break;

      case 'fare-other':
        dispatch({ type: 'ADD_MESSAGE', payload: createMessage('bot', 'text', 'Type the fare amount in the chat box.') });
        break;

      case 'add-pin':
      case 'add-poi':
        handleAddPin();
        break;

      case 'end-route':
        handleEndRoute();
        break;

      default:
        const route = MOCK_ROUTES.find(r => r.id === reply.id);
        if (route) {
          handleRouteSelection(route);
        }
    }
  }, []);

  const handleRouteSelection = useCallback((route: { id: string; name: string }) => {
    if (route.id === 'add-new') {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'inline_form', 'Enter new route name:'),
      });
      return;
    }

    dispatch({ type: 'SET_ROUTE_NAME', payload: route.name });
    dispatch({ type: 'SET_COMMUTE_STATE', payload: 'riding' });
    window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: false } }));
    window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: false } }));
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'text', `Riding on ${route.name}. Use the buttons below to Hop Off or End Route.`),
    });
  }, []);

  const handlePause = useCallback(() => {
    setIsPaused(!isPaused);
    if (!isPaused) {
      dispatch({ type: 'SET_TRACKING', payload: false });
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '⏸️ Commute paused. Timer stopped.'),
      });
    } else {
      dispatch({ type: 'SET_TRACKING', payload: true });
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '▶️ Commute resumed. Timer restarted.'),
      });
    }
  }, [isPaused]);

  const handleHopOn = useCallback(async () => {
    // Fetch weather at segment start
    if (location) {
      try {
        const weather = await fetchWeather(location.lat, location.lng);
        window.__currentSegmentWeather = weather;
      } catch {
        window.__currentSegmentWeather = null;
      }
    }
    dispatch({ type: 'SET_TRACKING', payload: true });
    dispatch({ type: 'SET_APP_MODE', payload: 'tracking' });
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'text', 'Which route are you boarding? Select from the buttons above.'),
    });
    window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: true } }));
  }, []);

  const handleHopOff = useCallback(() => {
    // Record riding segment
    if (segmentStartTime.current) {
      const durationSec = Math.round((Date.now() - segmentStartTime.current) / 1000);
      segmentsRef.current.push({
        mode: 'riding',
        routeName: state.currentRouteName,
        weather: window.__currentSegmentWeather || null,
        startTime: segmentStartTime.current,
        endTime: Date.now(),
        durationSec,
      });
      segmentStartTime.current = null;
      
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', `Noted. You are walking again. Riding segment: ${durationSec}s on ${state.currentRouteName || 'unknown route'}.`),
      });
    } else {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', 'Noted. You are walking again.'),
      });
    }
    
    dispatch({ type: 'SET_COMMUTE_STATE', payload: 'walking' });
    dispatch({ type: 'SET_ROUTE_NAME', payload: null });
    // Prompt for fare report after riding segment
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'text', 'How much was the fare for this segment? Select from the buttons or type the amount.'),
    });
    window.dispatchEvent(new CustomEvent('set-fare-report', { detail: { awaiting: true } }));
  }, [state.currentRouteName]);

  const handleEndRoute = useCallback(async () => {
    // Record final segment if still riding
    if (segmentStartTime.current) {
      const durationSec = Math.round((Date.now() - segmentStartTime.current) / 1000);
      segmentsRef.current.push({
        mode: 'riding',
        routeName: state.currentRouteName,
        weather: window.__currentSegmentWeather || null,
        startTime: segmentStartTime.current,
        endTime: Date.now(),
        durationSec,
      });
      segmentStartTime.current = null;
    }

    // Build segments
    const segments = segmentsRef.current;
    const totalDuration = segments.reduce((sum, seg) => sum + (seg.durationSec || 0), 0);
    const totalDistance = 0; // TODO: Calculate from GPS points

    console.log('Saving commute payload...', {
      segments,
      totalDurationSec: totalDuration,
      timestamp: new Date().toISOString(),
    });

    dispatch({ type: 'SET_TRACKING', payload: false });
    dispatch({ type: 'SET_COMMUTE_STATE', payload: 'walking' });
    dispatch({ type: 'SET_ROUTE_NAME', payload: null });
    dispatch({ type: 'SET_APP_MODE', payload: 'idle' });
    
    // Show segment timeline
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'segment_timeline', '', segments.map(seg => ({
        type: seg.mode === 'riding' ? 'riding' : 'walking',
        routeName: seg.routeName || 'Walking',
        durationSec: seg.durationSec || 0,
        startTime: seg.startTime,
      }))),
    });
    
    // Calculate Biyahe Score
    const ridingSegments = segments.filter(seg => seg.mode === 'riding');
    const transferCount = Math.max(0, ridingSegments.length - 1);
    const waitTimeSec = ridingSegments.length * 5 * 60; // 5 min wait per ride
    const transferPenaltySec = transferCount * 5 * 60; // 5 min penalty per transfer
    // Calculate weather penalty from actual segments
    let weatherPenalty = 0;
    for (const seg of segments) {
      if (seg.weather && seg.weather.code >= 61) {
        const basePenalty = getWeatherPenalty(seg.weather);
        const floodMultiplier = isFloodZone(seg.routeName) ? 1.5 : 1.0;
        weatherPenalty = Math.max(weatherPenalty, basePenalty * floodMultiplier);
      }
    }

    const totalPenaltySec = waitTimeSec + transferPenaltySec;
    const biyaheScore = Math.max(10, Math.min(100, Math.round((1 - totalPenaltySec / Math.max(totalDuration + totalPenaltySec, 60) - weatherPenalty) * 100)));

    // Optimistic UI - show success immediately
    setSuccessMessage('Commute Saved!');
    setShowSuccess(true);

    // Save to Supabase via commute-save Edge Function
    const commutePayload = {
      route_name: state.currentRouteName || 'Personal Commute',
      total_time_sec: totalDuration,
      distance_m: totalDistance,
      gps_points: segments.map(seg => seg.gpsPoints || []).flat(),
      segments: segments,
      user_id: user?.id || null,
      submitted_by: user?.email || 'guest',
    };

    try {
      const res = await edgePost('commute-save', commutePayload);
      console.log('✅ Commute saved:', res);
    } catch (err) {
      console.error('❌ Failed to save commute:', err);
      await offlineBuffer.addCommute(commutePayload);
      console.log('📦 Queued in offline buffer');
    }

    // Show Strava-style summary with Biyahe Score
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'strava_summary', '', [{
        totalTimeSec: totalDuration,
        totalDistanceM: totalDistance,
        totalFare: 0,
        avgSpeedKmh: totalDuration > 0 ? (totalDistance / 1000) / (totalDuration / 3600) : 0,
        biyaheScore,
        segments: segments.map(seg => ({
          type: seg.mode === 'riding' ? 'riding' : 'walking',
          routeName: seg.routeName || 'Walking',
          durationSec: seg.durationSec || 0,
          distanceM: 0,
        })),
      }]),
    });
    
    // Reset segments
    segmentsRef.current = [];
  }, [state.currentRouteName, state.commuteState, state.isTracking]);

  const handleTrackCommute = useCallback(() => {
    console.log('🟢 handleTrackCommute CALLED - starting commute tracking');
    
    // Show offline/background warning
    if (!navigator.onLine) {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '⚠️ You are offline. GPS points will be queued and synced when online.'),
      });
    }
    
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'text', '📱 Keep this app open for accurate tracking. Minimizing may pause GPS.'),
    });
    
    dispatch({ type: 'SET_TRACKING', payload: true });
    dispatch({ type: 'SET_APP_MODE', payload: 'tracking' });
    dispatch({ type: 'SET_COMMUTE_STATE', payload: 'walking' });
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'text', '🚶 Commute tracking started. Tap "Hop On" when you board.'),
    });
  }, []);

  const handleRecordRoute = useCallback(() => {
    setRouteDrawingMode(true);
    dispatch({ type: 'SET_TRACKING', payload: true });
    dispatch({ type: 'SET_APP_MODE', payload: 'tracking' });
    dispatch({ type: 'SET_COMMUTE_STATE', payload: 'walking' });
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'text', '🗺️ Route recording started. Walk or ride the route. Type "finish route" when done.'),
    });
    window.dispatchEvent(new CustomEvent('route-drawing-start'));
  }, []);

  const handleFinishRoute = useCallback(async () => {
    setRouteDrawingMode(false);
    
    // Get route shape points from LiveMapBackground
    const routePoints = window.__routeShapePoints || [];
    const routeName = state.currentRouteName || 'Unnamed Route';
    
    if (routePoints.length < 2) {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '⚠️ Not enough GPS points. Record a longer route.'),
      });
      window.dispatchEvent(new CustomEvent('route-drawing-stop'));
      return;
    }
    
    // Save route to offline buffer first (always works)
    // Then try Edge Function which uses service_role (bypasses RLS)
    const routePayload = {
      route_name: routeName,
      mode: transportMode || 'jeepney',
      path_coordinates: routePoints,
      submitted_by: 'user',
      region: null,  // Will be derived from GPS location
    };
    
    // Track as pending contribution for later claiming
    if (!isLoggedIn) {
      addPendingContribution({ type: 'route', payload: routePayload });
    }

    // Queue in offline buffer regardless
    await offlineBuffer.enqueue({
      type: 'route-save',
      payload: routePayload,
      timestamp: Date.now(),
    });
    
    // Try Edge Function (needs DB_SERVICE_KEY set in Supabase Dashboard)
    try {
      const res = await edgePost('route-save', routePayload);
      // Optimistic UI - show success immediately with auth state
    if (isLoggedIn && user?.email) {
      setSuccessMessage('Route Saved!');
    } else {
      setSuccessMessage('Route Saved as Guest!');
    }
    setShowSuccess(true);

    if (res.success) {
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'text', `✅ Route "${routeName}" submitted for review!`),
        });
      } else {
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'text', `📦 Route queued for sync: ${res.error || 'pending review'}`),
        });
      }
    } catch (err) {
      console.error('Edge Function failed:', err);
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '📦 Route saved offline. Will sync when Edge Function is configured.'),
      });
    }
    
    window.dispatchEvent(new CustomEvent('route-drawing-stop'));
  }, [state.currentRouteName, transportMode]);

  const handleMyStop = useCallback(() => {
    if (location) {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('user', 'text', '⏳ My Stop'),
      });
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', `Waiting spot marked at ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}. Other commuters can see this.`),
      });
      window.dispatchEvent(new CustomEvent('my-stop-marker', { 
        detail: { lat: location.lat, lng: location.lng } 
      }));
    } else {
      requestConsentAndLocation();
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '📍 Please allow location access to mark your stop. Tap the GPS button.'),
      });
    }
  }, [location, requestConsentAndLocation]);

  const handleStandaloneFare = useCallback(() => {
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'fare_form', 'Enter fare amount:'),
    });
  }, []);

  const handleAddPin = useCallback(() => {
    setPinMode(true);
    window.dispatchEvent(new CustomEvent('activate-pin-mode'));
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'text', '📍 Tap the map to drop a pin.'),
    });
  }, []);

  const handleSelectVehicle = useCallback((vehicleId: string) => {
    setTransportMode(vehicleId);
    dispatch({ type: 'SET_COMMUTE_STATE', payload: 'riding' });
    dispatch({ type: 'SET_APP_MODE', payload: 'tracking' });
    dispatch({ type: 'SET_TRACKING', payload: true });
    window.dispatchEvent(new CustomEvent('set-mode-select', { detail: { selecting: false } }));
    const vehicle = VEHICLES.find(v => v.id === vehicleId);
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'text', `${vehicle?.icon || '🚐'} ${vehicle?.label || 'Vehicle'} selected. Type the route name or use the form.`),
    });
  }, []);

  const handleSendMessage = useCallback((text: string) => {
    dispatch({ type: 'ADD_MESSAGE', payload: createMessage('user', 'text', text) });
    
    // Use NLP engine for intent detection
    const intents = detectIntent(text);
    const preferences = extractPreferences(text);
    const lower = normalize(text);
    
    // ACTUALLY USE NLP results
    // Check for preference intents
    const hasTimeIntent = intents.some(i => i.intent === 'MINIMIZE_TIME');
    const hasFareIntent = intents.some(i => i.intent === 'MINIMIZE_FARE');
    const hasWalkingIntent = intents.some(i => i.intent === 'MINIMIZE_WALKING');
    const hasTransferIntent = intents.some(i => i.intent === 'MINIMIZE_TRANSFERS');
    const hasWeatherIntent = intents.some(i => i.intent === 'WEATHER_AWARE' || i.intent === 'FLOOD_AWARE');
    const hasHassleIntent = intents.some(i => i.intent === 'ASK_CLARIFICATION');
    
    // Respond with preference acknowledgment
    if (hasHassleIntent) {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', 'Anong hassle ang gusto mong iwasan?\n\n⏳ Long waiting\n🚶 Walking\n🔄 Transfers\n👥 Crowding\n💰 High fare'),
      });
      return;
    }
    
    if (hasWeatherIntent) {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '🌧️ Weather-aware mode activated. I will avoid flood-prone areas if raining.'),
      });
    }
    
    if (hasTimeIntent) {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '⚡ Got it! I will prioritize the fastest route.'),
      });
    }
    
    if (hasFareIntent) {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '💰 Got it! I will prioritize the cheapest route.'),
      });
    }
    
    if (hasWalkingIntent) {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '🚶 Got it! I will minimize walking.'),
      });
    }
    
    if (hasTransferIntent) {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '🔄 Got it! I will minimize transfers.'),
      });
    }
    
    // Check if this is a fare amount being typed
    const fareMatch = lower.match(/(?:fare|bayad|pamasahe)?\s*(?:is|was|:|₱|p)?\s*(\d+(?:\.\d+)?)/);
    if (awaitingFareReport && fareMatch) {
      const amount = fareMatch[1];
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', `Fare recorded: ₱${amount}. Thank you!`),
      });
      window.dispatchEvent(new CustomEvent('set-fare-report', { detail: { awaiting: false } }));
      setAwaitingFareReport(false);
      return;
    }

    // Check if user is typing a new route name (when awaiting route selection)
    if (awaitingRouteSelection) {
      dispatch({ type: 'SET_ROUTE_NAME', payload: text.trim() });
      dispatch({ type: 'SET_COMMUTE_STATE', payload: 'riding' });
      window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: false } }));
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', `Riding on ${text.trim()}. Timer started.`),
      });
      return;
    }

    // Check for transport mode in text
    if (/(train|lrt|mrt|rail)/.test(lower)) {
      setTransportMode('train');
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '🚆 Train mode set. Which station are you boarding?'),
      });
      window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: true } }));
      return;
    }
    if (/(bus)/.test(lower)) {
      setTransportMode('bus');
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '🚌 Bus mode set. Which route are you boarding?'),
      });
      window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: true } }));
      return;
    }
    if (/(uv|van|express)/.test(lower)) {
      setTransportMode('uv_express');
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '🚐 UV Express mode set. Which route are you boarding?'),
      });
      window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: true } }));
      return;
    }
    if (/(trike|tricycle|traysikel)/.test(lower)) {
      setTransportMode('trike');
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '🛺 Tricycle mode set. Which route are you taking?'),
      });
      window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: true } }));
      return;
    }
    if (/(jeep|jeepney)/.test(lower)) {
      setTransportMode('jeepney');
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', '🚐 Jeepney mode set. Which route are you boarding?'),
      });
      window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: true } }));
      return;
    }
    const hasLocation = window.__paraMap ? true : false;
    
    setTimeout(() => {
      // Privacy policy
      if (/(privacy|data privacy|how is my data)/.test(lower)) {
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'text', '🔒 Your location data is only collected with explicit consent (DPA 2012). GPS points are downsampled to 1 per 3 seconds and anonymized. We never sell your data. Full policy: https://www.para-commute.org/privacy-policy'),
        });
        return;
      }

      // Emergency / safety keywords
      if (/(emergency|help|sos|unsafe|danger|scared|lost|stray|wrong way|off course|off route)/.test(lower)) {
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'text', '⚠️ I notice you might be off your planned route. Stay calm. Your GPS is still active. Do you want to:\n\n1. Re-route to nearest verified route\n2. Call emergency contact\n3. Share your live location\n\nUse the buttons above or type "re-route" to continue.'),
        });
        window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: true } }));
        return;
      }

      // Route change detection
      if (/(change route|different route|re-route|reroute|new route|wrong route|ibang daan|naliligaw)/.test(lower)) {
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'text', 'Detected route change request. I\'ll find nearby verified routes for you. Select from the buttons above.'),
        });
        window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: true } }));
        return;
      }

      // Hop on / off
      if (/(hop on|sakay|board|ride)/.test(lower)) {
        handleHopOn();
        return;
      }
      if (/(hop off|baba|alight|get off)/.test(lower)) {
        handleHopOff();
        return;
      }

      // Fare report
      if (/(fare|bayad|how much|magkano|pamasahe)/.test(lower)) {
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'text', 'You can report a fare by tapping "Add Pin" and selecting your vehicle type. I\'ll log the fare amount for community benefit.'),
        });
        return;
      }

      // POI / pin
      if (/(add\s*(a\s*)?pin|drop\s*(a\s*)?pin|poi|point of interest|landmark|business|amenity)/.test(lower)) {
        handleAddPin();
        return;
      }

      // Traffic / road condition
      if (/(traffic|traffic jam|bumper|slow|masikip|road condition)/.test(lower)) {
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'text', 'Noted. I\'m logging this road condition for other commuters. You can also add a pin at the exact location for more accuracy.'),
        });
        return;
      }

      // Weather concern
      if (/(rain|ulan|flood|baha|weather|panahon)/.test(lower)) {
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'text', 'Check the weather button on the map for current conditions. Stay safe! If flooding is severe, consider ending your route and finding shelter.'),
        });
        return;
      }

      // Finish route drawing
      if (routeDrawingMode && /(finish route|done|tapos|stop recording)/.test(lower)) {
        handleFinishRoute();
        return;
      }

      // End route
      if (/(end route|stop|tapos|done|finish)/.test(lower)) {
        handleEndRoute();
        return;
      }

      // Default response with hint
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', 'I\'m listening! I can help with:\n\n🚐 "Hop On" — board a vehicle\n🚶 "Hop Off" — get off\n📍 "Add Pin" — drop a location\n💰 "Fare" — report fare\n⚠️ "Emergency" — get help\n\nOr use the buttons above.'),
      });
    }, 300);
  }, [state.currentRouteName, state.commuteState, state.isTracking]);

  return (
    <div className="relative w-full h-screen bg-gray-50 overflow-hidden flex flex-col ">
      {/* Navbar */}
      <Navbar />

      {/* Version Toggle — testing only */}
      {!navbarOpen && (
      <div className="fixed top-20 left-4 z-[5000] flex items-center gap-1 bg-white rounded-full shadow-lg px-2 py-1">
        <button
          onClick={() => {
            console.log('🟢 Toggle Chat clicked');
            setUiVersion('chat');
          }}
          className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors ${
            uiVersion === 'chat' ? 'bg-[#7A4BC8] text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => {
            console.log('🟢 Toggle Buttons clicked');
            setUiVersion('buttons');
          }}
          className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors ${
            uiVersion === 'buttons' ? 'bg-[#7A4BC8] text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          Buttons
        </button>
      </div>
      )}

      {/* Map Area — full screen behind chat */}
      <div className="absolute inset-0 z-0">
        <LiveMapBackground
          isTracking={state.isTracking}
          commuteState={state.commuteState}
          currentRouteName={state.currentRouteName}
          panelHeight={uiVersion === 'chat' ? '40vh' : '230px'}
          externalPinMode={pinMode}
          onExternalPinModeChange={setPinMode}
        />
      </div>

      {/* Conditional UI based on version */}
      {uiVersion === 'chat' ? (
        <ChatPanel
          messages={state.chatHistory}
          commuteState={state.commuteState}
          appMode={state.appMode}
          currentRouteName={state.currentRouteName}
          isTracking={state.isTracking}
          onQuickReply={handleQuickReply}
          onSendMessage={handleSendMessage}
        />
      ) : (
        <ButtonVersionUI
          commuteState={state.commuteState}
          transportMode={transportMode}
          currentRouteName={state.currentRouteName}
          isTracking={state.isTracking}
          appMode={state.appMode}
          onRecordRide={handleTrackCommute}
          onMyStop={handleMyStop}
          onAddPlace={handleAddPin}
          onAddRoute={handleRecordRoute}
          onHopOn={handleHopOn}
          onHopOff={handleHopOff}
          onEndRoute={handleEndRoute}
          onReportFare={handleStandaloneFare}
          onSelectVehicle={handleSelectVehicle}
        />
      )}

      {/* Bottom Navigation */}
      <SuccessModal
        show={showSuccess}
        message={successMessage}
        subtitle="Your contribution helps the community!"
        onClose={() => setShowSuccess(false)}
      />
      <BottomNav />
    </div>
  );
};

export default ContributePage;
