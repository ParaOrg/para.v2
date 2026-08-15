import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { TrackingConsentProvider } from "./context/TrackingConsentContext";

import HomeNew from "./pages/HomeNew";
import RoutesExplorer from "./pages/RoutesExplorer";
import Community from "./pages/Community";
import AdminDashboard from "./pages/AdminDashboard";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import About from "./pages/About";
import GasPrices from "./pages/GasPrices";
import POIBrowser from "./pages/POIBrowser";
import Contribute from "./pages/Contribute";
import GlobalWeather from "./components/GlobalWeather";

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="w-8 h-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="w-8 h-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" /></div>;
  if (!isAuthenticated || (user?.role !== "admin" && user?.role !== "founder")) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <TrackingConsentProvider>
      <AuthProvider>
        <GlobalWeather />
        <Routes>
          <Route path="/" element={<HomeNew />} />
          <Route path="/explore" element={<RoutesExplorer />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/about" element={<About />} />
          <Route path="/gas-prices" element={<GasPrices />} />
          <Route path="/poi" element={<POIBrowser />} />
          <Route path="/contribute" element={<Contribute />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </TrackingConsentProvider>
  );
}
