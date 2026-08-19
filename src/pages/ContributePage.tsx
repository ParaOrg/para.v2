import React, { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import { LiveMapBackground } from '../components/contribute/LiveMapBackground';
import { ChatPanel } from '../components/contribute/ChatPanel';
import { ButtonVersionUI } from '../components/contribute/ButtonVersionUI';
import ContributeOriginal from './Contribute';
import { contributeReducer, initialState, createMessage } from '../reducers/contributeReducer';
import { QuickReply } from '../types/contribute';

const MOCK_ROUTES = [
  { id: 'up-ikot', name: 'UP Ikot' },
  { id: 'up-katipunan', name: 'UP Katipunan' },
  { id: 'up-philcoa', name: 'UP Philcoa' },
  { id: 'add-new', name: '+ Add New Route' },
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
  const [uiVersion, setUiVersion] = useState<'chat' | 'buttons'>('chat');
  const [navbarOpen, setNavbarOpen] = useState(false);
  const segmentStartTime = useRef<number | null>(null);
  const segmentsRef = useRef<Array<{ mode: string; routeName: string | null; startTime: number; endTime: number | null; durationSec: number | null }>>([]);

  useEffect(() => {
    const handlePoiLocation = (e: CustomEvent) => {
      const { lat, lng } = e.detail;
      dispatch({ type: 'ADD_MESSAGE', payload: createMessage('user', 'text', `📍 Pin location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`) });
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('bot', 'text', 'What type of pin would you like to add? Select from the buttons above.'),
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
        dispatch({ type: 'SET_POI_TYPE', payload: 'business' });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'inline_form', 'What type of business is this? (e.g., Lugawan, Sari-sari store, Cafe, Pharmacy)'),
        });
        break;

      case 'poi-landmark':
        dispatch({ type: 'SET_POI_TYPE', payload: 'landmark' });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'inline_form', 'Optional: Add an image URL for this landmark (direct link ending in .jpg/.png)'),
        });
        break;

      case 'poi-amenity':
        dispatch({ type: 'SET_POI_TYPE', payload: 'amenity' });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('bot', 'inline_form', 'Optional: Add an image URL for this amenity (direct link ending in .jpg/.png)'),
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

  const handleHopOn = useCallback(() => {
    dispatch({ type: 'SET_TRACKING', payload: true });
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'text', 'Which route are you boarding? Select from the buttons above.'),
    });
    window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: true } }));
    window.dispatchEvent(new CustomEvent('set-awaiting-route', { detail: { awaiting: true } }));
  }, []);

  const handleHopOff = useCallback(() => {
    // Record riding segment
    if (segmentStartTime.current) {
      const durationSec = Math.round((Date.now() - segmentStartTime.current) / 1000);
      segmentsRef.current.push({
        mode: 'riding',
        routeName: state.currentRouteName,
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
        startTime: segmentStartTime.current,
        endTime: Date.now(),
        durationSec,
      });
      segmentStartTime.current = null;
    }

    // Build summary
    const segments = segmentsRef.current;
    const totalDuration = segments.reduce((sum, seg) => sum + (seg.durationSec || 0), 0);
    const summary = segments.map((seg, i) => 
      `${i + 1}. ${seg.mode === 'riding' ? '🚐' : '🚶'} ${seg.routeName || 'Walking'} — ${seg.durationSec}s`
    ).join('\n');

    console.log('Saving commute payload...', {
      routeName: state.currentRouteName,
      commuteState: state.commuteState,
      isTracking: state.isTracking,
      segments,
      totalDurationSec: totalDuration,
      timestamp: new Date().toISOString(),
    });

    dispatch({ type: 'SET_TRACKING', payload: false });
    dispatch({ type: 'SET_COMMUTE_STATE', payload: 'walking' });
    dispatch({ type: 'SET_ROUTE_NAME', payload: null });
    dispatch({ type: 'SET_APP_MODE', payload: 'idle' });
    
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'text', `Trip saved!\n\nSegment breakdown:\n${summary}\n\nTotal duration: ${totalDuration}s\n\nThank you for contributing to Para PH! 🎉`),
    });
    
    // Reset segments
    segmentsRef.current = [];
  }, [state.currentRouteName, state.commuteState, state.isTracking]);

  const handleRecordRoute = useCallback(() => {
    setRouteDrawingMode(true);
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'text', '🗺️ Route recording started. Walk or ride the route. Type "finish route" when done.'),
    });
    window.dispatchEvent(new CustomEvent('route-drawing-start'));
  }, []);

  const handleFinishRoute = useCallback(() => {
    setRouteDrawingMode(false);
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'text', '✅ Route shape saved! Thank you for mapping this route.'),
    });
    window.dispatchEvent(new CustomEvent('route-drawing-stop'));
  }, []);

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
    }
  }, [location]);

  const handleStandaloneFare = useCallback(() => {
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'text', 'How much was the fare? Type the amount or select from buttons.'),
    });
    window.dispatchEvent(new CustomEvent('set-fare-report', { detail: { awaiting: true } }));
  }, []);

  const handleAddPin = useCallback(() => {
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('bot', 'text', 'What type of pin would you like to add? Select from the buttons above.'),
    });
  }, []);

  const handleSendMessage = useCallback((text: string) => {
    dispatch({ type: 'ADD_MESSAGE', payload: createMessage('user', 'text', text) });
    
    const lower = text.toLowerCase();
    
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
          onClick={() => setUiVersion('chat')}
          className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors ${
            uiVersion === 'chat' ? 'bg-[#7A4BC8] text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setUiVersion('buttons')}
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
        <ContributeOriginal />
      )}

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default ContributePage;
