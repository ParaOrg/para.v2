import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import MapComponent from "../components/map_component";
import SearchInput from "../components/SearchInput";
import RouteSteps from "../components/RouteSteps";
import RouteOptionsPanel from "../components/RouteOptionsPanel";
import { getGoogleMapsApiKey } from "../config/googleMaps";
import { getApiBaseUrl } from "../config/api";
import { adaptChatResponse } from "../services/routeAdapter";
import { supabase } from "../../supabase";
import paralogo from "../assets/images/paralogo.png";

const API_BASE = getApiBaseUrl();

export default function MapPage({ user }) {
  const apiKey = getGoogleMapsApiKey();
  const navigate = useNavigate();

  const [markers, setMarkers] = useState([]);
  const [lines, setLines] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [routeResponse, setRouteResponse] = useState("");

  // Route options state
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showRouteOptions, setShowRouteOptions] = useState(false);
  const [destination, setDestination] = useState("");

  // Debug: Log route options state changes
  useEffect(() => {
    console.log("[Map] 🔍 State changed - showRouteOptions:", showRouteOptions, "routeOptions.length:", routeOptions.length);
  }, [showRouteOptions, routeOptions]);

  // Menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [showRecents, setShowRecents] = useState(true);

  // Alerts
  const [alerts] = useState([
    { type: "warning", text: "Road Closure: Avoid EspaÃ±a Blvd" },
    { type: "info", text: "Weather Alert: Moderate rain in..." }
  ]);

  // Recent locations
  const [recentLocations, setRecentLocations] = useState([]);

  // Load recent searches from Supabase
  useEffect(() => {
    if (user) {
      loadRecentSearches();
    } else {
      // Load from localStorage for non-authenticated users
      const localRecents = JSON.parse(localStorage.getItem('recentSearches') || '[]');
      setRecentLocations(localRecents);
    }
  }, [user]);

  const loadRecentSearches = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('recent_searches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentLocations(data || []);
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveRecentSearch = async (searchQuery, results) => {
    if (user) {
      // Save to Supabase for authenticated users
      try {
        const { error } = await supabase
          .from('recent_searches')
          .insert({
            user_id: user.id,
            search_query: searchQuery,
            search_results: results,
          });

        if (error) throw error;
        await loadRecentSearches();
      } catch (error) {
        console.error('Error saving search:', error);
      }
    } else {
      // Save to localStorage for non-authenticated users
      const localRecents = JSON.parse(localStorage.getItem('recentSearches') || '[]');
      const newSearch = {
        name: searchQuery,
        address: results?.markers?.[0]?.address || 'Location',
        created_at: new Date().toISOString()
      };
      const updated = [newSearch, ...localRecents].slice(0, 10);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
      setRecentLocations(updated);
    }
  };

  // Get and Watch User Location
  useEffect(() => {
    let watchId;

    if (navigator.geolocation) {
      // Watch position for real-time updates
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          console.log("User Location Updated:", latitude, longitude);

          // Send to Backend
          fetch(`${API_BASE}/api/v1/location`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": user ? `Bearer ${user.access_token}` : ''
            },
            body: JSON.stringify({
              latitude,
              longitude,
              user_id: user?.id
            }),
          })
            .then((res) => res.json())
            .then((data) => console.log("Location ack:", data))
            .catch((err) => console.error("Error sending location:", err));
        },
        (error) => {
          console.error("Error getting location:", error);
          setUserLocation({ lat: 14.5995, lng: 120.9842 });
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    } else {
      setUserLocation({ lat: 14.5995, lng: 120.9842 });
    }

    // Cleanup: stop watching when component unmounts
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [user]);

  // Handle search submission
  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    setIsLoading(true);
    setShowRecents(false);

    try {
        console.log("[Map] Sending search request:", searchInput);
        const res = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": user ? `Bearer ${user.access_token}` : ''
            },
            body: JSON.stringify({
              user_id: user?.id ?? "guest",
              message: searchInput
            })
        });
        const data = await res.json();
        console.log("[Map] Full response received:", data);

        // Clear existing state first
        setMarkers([]);
        setLines([]);
        setRouteOptions([]);
        setSelectedRoute(null);
        setShowRouteOptions(false);

        // Translate the backend's ChatResponse (route_data/alternatives) into
        // the {markers, lines, route_options} shape the map/route UI expects.
        const mapData = adaptChatResponse(data);
        console.log("[Map] Adapted map data:", mapData);

        if (mapData.route_options.length > 0) {
            setRouteOptions(mapData.route_options);
            setShowRouteOptions(true);
            setDestination(searchInput);
            setMarkers(mapData.markers);
            setLines(mapData.lines);
        }

        // Set route response text
        if (data.reply_text) {
            setRouteResponse(data.reply_text);
        }

        // Save search to database
        await saveRecentSearch(searchInput, mapData);
    } catch (err) {
        console.error("[Map] Search error:", err);
        alert("Error searching for routes. Please try again.");
    } finally {
        setIsLoading(false);
    }
  };

  // Handle route selection from RouteOptionsPanel
  const handleSelectRoute = (routeId) => {
    const selected = routeOptions.find(route => route.route_id === routeId);
    if (selected) {
      console.log("[Map] Selected route:", routeId);
      setSelectedRoute(selected);
      setMarkers(selected.markers || []);
      setLines(selected.lines || []);
      setShowRouteOptions(false);
    }
  };

  // Handle closing route options panel
  const handleCloseRouteOptions = () => {
    setShowRouteOptions(false);
    setRouteOptions([]);
    setSelectedRoute(null);
    setMarkers([]);
    setLines([]);
  };

  // Handle back from route details
  const handleBackFromRouteDetails = () => {
    if (routeOptions.length > 0) {
      // Go back to route options panel
      setShowRouteOptions(true);
      setSelectedRoute(null);
      // Show the first route on map
      const firstRoute = routeOptions[0];
      setMarkers(firstRoute.markers || []);
      setLines(firstRoute.lines || []);
    } else {
      // Just clear the route
      setMarkers([]);
      setLines([]);
    }
  };

  const handleQuickAction = (action) => {
    setSearchInput(action);
    setShowRecents(false);
  };

  const handleRecentClick = (location) => {
    setSearchInput(location.search_query || location.name);
    setShowRecents(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsUserMenuOpen(false);
    navigate('/login');
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isMenuOpen && !e.target.closest('.sidebar-menu') && !e.target.closest('.menu-button')) {
        setIsMenuOpen(false);
      }
      if (isUserMenuOpen && !e.target.closest('.user-menu') && !e.target.closest('.user-button')) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isMenuOpen, isUserMenuOpen]);

  return (
    <div className="relative h-screen w-full bg-gray-50">
      {/* Menu Button with Logo */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="menu-button absolute top-4 left-4 z-30 bg-white rounded-lg p-2 shadow-lg hover:bg-gray-50 flex items-center gap-2"
      >
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <img src={paralogo} alt="PARAPH" className="h-6 w-6" />
        <span className="font-bold text-gray-800 text-sm">PARAPH</span>
      </button>

      {/* Sidebar Menu */}
      {isMenuOpen && (
        <>
          {/* Overlay */}
          <div className="fixed inset-0 bg-black/30 z-30" onClick={() => setIsMenuOpen(false)} />

          {/* Sidebar */}
          <div className="sidebar-menu fixed top-0 left-0 h-full w-72 bg-white shadow-2xl z-40 transform transition-transform">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-100">
              <img src={paralogo} alt="PARAPH" className="h-10 w-10" />
              <span className="text-xl font-bold text-gray-800">PARAPH</span>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="ml-auto p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="p-4 space-y-2">
              <Link
                to="/"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-pink-50 hover:text-pink-500 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span className="font-medium">Map</span>
              </Link>

              <Link
                to="/about"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-pink-50 hover:text-pink-500 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">About</span>
              </Link>

              <Link
                to="/contact"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-pink-50 hover:text-pink-500 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">Contact</span>
              </Link>
            </nav>

            {/* Divider */}
            <div className="border-t border-gray-100 mx-4" />

            {/* Auth Section */}
            <div className="p-4">
              {user ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="font-medium">Logout</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <Link
                    to="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 text-pink-500 border border-pink-500 hover:bg-pink-50 rounded-lg transition-colors"
                  >
                    <span className="font-medium">Login</span>
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 text-white bg-pink-500 hover:bg-pink-600 rounded-lg transition-colors"
                  >
                    <span className="font-medium">Sign Up</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* User Icon (Top Right) */}
      {user ? (
        <div className="absolute top-4 right-4 z-30">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="user-button flex items-center gap-2 bg-white rounded-full p-1 pr-3 shadow-lg hover:bg-gray-50"
          >
            <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* User Dropdown Menu */}
          {isUserMenuOpen && (
            <div className="user-menu absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
              {/* User Info */}
              <div className="p-4 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold">
                      {user.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{user.email}</p>
                    <p className="text-xs text-gray-500">Logged in</p>
                  </div>
                </div>
              </div>

              {/* Recent Searches */}
              <div className="p-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                  Recent Routes
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {recentLocations.length > 0 ? (
                    recentLocations.slice(0, 5).map((location, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          handleRecentClick(location);
                          setIsUserMenuOpen(false);
                        }}
                        className="flex items-center gap-2 w-full px-2 py-2 text-left hover:bg-gray-50 rounded-lg"
                      >
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-gray-700 truncate">
                          {location.search_query || location.name}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 px-2 py-2">No recent searches</p>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Logout Button */}
              <div className="p-2">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="text-sm font-medium">Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Login/Signup buttons for non-authenticated users */
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
          <Link
            to="/login"
            className="px-4 py-2 text-sm font-medium text-pink-500 bg-white rounded-lg shadow-lg hover:bg-gray-50"
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="px-4 py-2 text-sm font-medium text-white bg-pink-500 rounded-lg shadow-lg hover:bg-pink-600"
          >
            Sign Up
          </Link>
        </div>
      )}

      {/* Map Component */}
      <div className="absolute inset-0">
        <MapComponent
          apiKey={apiKey}
          userLocation={userLocation}
          markers={markers}
          lines={lines}
        />
      </div>

      {/* Route Options Panel (shown when multiple routes are available) */}
      {(() => {
        console.log("[Map] 🎨 Render check - showRouteOptions:", showRouteOptions, "routeOptions.length:", routeOptions.length);
        return null;
      })()}
      {showRouteOptions && routeOptions.length > 0 ? (
        <>
          {console.log("[Map] ✅ RENDERING RouteOptionsPanel")}
          <RouteOptionsPanel
            routeOptions={routeOptions}
            destination={destination}
            onSelectRoute={handleSelectRoute}
            onClose={handleCloseRouteOptions}
          />
        </>
      ) : (
        console.log("[Map] ❌ NOT rendering RouteOptionsPanel - showRouteOptions:", showRouteOptions, "length:", routeOptions.length)
      )}

      {/* Route Steps Guide (shown when a route is selected or only one route available) */}
      {!showRouteOptions && lines.length > 0 && (
        <RouteSteps
          markers={markers}
          lines={lines}
          response={routeResponse}
          onBack={handleBackFromRouteDetails}
        />
      )}

      {/* Alert Banners */}
      <div className="absolute bottom-32 left-0 right-0 z-10 px-4 space-y-2">
        {alerts.map((alert, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg max-w-md mx-auto ${
              alert.type === 'warning'
                ? 'bg-yellow-500'
                : 'bg-blue-500'
            }`}
          >
            <div className="bg-white rounded-full p-1">
              {alert.type === 'warning' ? (
                <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              )}
            </div>
            <span className="text-white text-sm font-medium flex-1">{alert.text}</span>
          </div>
        ))}
      </div>

      {/* Bottom Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-20">
        {/* Search Bar */}
        <div className="p-4 border-b border-gray-100">
          <form onSubmit={handleSearchSubmit}>
            <SearchInput
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSubmit={handleSearchSubmit}
              onFocus={() => setShowRecents(true)}
              apiKey={apiKey}
            />
          </form>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-around px-6 py-4 border-b border-gray-100">
          <button
            onClick={() => handleQuickAction("Home")}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="bg-pink-50 p-3 rounded-xl group-hover:bg-pink-100">
              <svg className="w-6 h-6 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <span className="text-xs text-gray-600 font-medium">Home</span>
          </button>

          <button
            onClick={() => handleQuickAction("School")}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="bg-blue-50 p-3 rounded-xl group-hover:bg-blue-100">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <span className="text-xs text-gray-600 font-medium">School</span>
          </button>

          <button className="flex flex-col items-center gap-1 group">
            <div className="bg-yellow-50 p-3 rounded-xl group-hover:bg-yellow-100">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-xs text-gray-600 font-medium">Add New</span>
          </button>
        </div>

        {/* Recent Locations */}
        {showRecents && recentLocations.length > 0 && (
          <div className="px-4 py-3 max-h-48 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Recent</h3>
            <div className="space-y-3">
              {recentLocations.map((location, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRecentClick(location)}
                  className="flex items-start gap-3 w-full text-left hover:bg-gray-50 p-2 rounded-lg"
                >
                  <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {location.search_query || location.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {location.address || 'Recent search'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="px-4 py-6 text-center bg-pink-50">
            <div className="flex flex-col items-center gap-3">
              <div className="inline-block w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-800">Searching for routes...</p>
                <p className="text-xs text-gray-500">Finding the best public transport options</p>
              </div>
            </div>
          </div>
        )}

        {/* Login Prompt for Non-Authenticated Users */}
        {!user && (
          <div className="px-4 py-2 bg-pink-50 border-t border-pink-100">
            <p className="text-xs text-center text-gray-600">
              <Link to="/login" className="text-pink-500 hover:text-pink-600 font-medium">Login</Link> to save your searches
            </p>
          </div>
        )}
      </div>
    </div>
  );
}