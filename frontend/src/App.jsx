import { Component } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';
import MapPage from './pages/Map';
import GasPricePage from './pages/GasPricePage';
import Signup from './pages/Signup';
import Login from './pages/Login';
import PrivacyPolicy from './pages/privacy_policy';
import RouteOptionsPage from './pages/RouteOptionsPage';
import RoutesExplorer from './pages/RoutesExplorer';
import AdminDashboard from './pages/AdminDashboard';
import { useAuth } from './context/AuthContext';

class RoutesBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 9999, padding: 40, fontFamily: 'monospace' }}>
          <h2 style={{ color: '#e11d48', marginBottom: 12 }}>RoutesExplorer crashed</h2>
          <pre style={{ background: '#fef2f2', padding: 16, borderRadius: 8, fontSize: 12, whiteSpace: 'pre-wrap', color: '#7f1d1d' }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Hide navbar on full-screen pages
  const hideNavbarPaths = ['/map'];
  const showNavbar = !hideNavbarPaths.includes(location.pathname);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f5ff]">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4"
          style={{ borderColor: '#e9d5ff', borderTopColor: '#4f00cd' }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-white">
      {showNavbar && <Navbar user={user} />}
      <main className="relative min-h-0 flex-1 overflow-x-hidden">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/gas-prices" element={<GasPricePage />} />
          <Route path="/map" element={<MapPage user={user} />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/route-options" element={<RouteOptionsPage />} />
          <Route path="/routes" element={<RoutesBoundary><RoutesExplorer /></RoutesBoundary>} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return <AppRoutes />;
}
