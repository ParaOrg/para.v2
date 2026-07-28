import React, { useState, useEffect } from 'react';

// Safe wrapper in case AuthContext is missing or fails
const useSafeAuth = () => {
  try {
    const { useAuth } = require('../context/AuthContext');
    return useAuth();
  } catch (e) {
    return { user: null, isGuest: true, loading: false, logout: () => {} };
  }
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'routes', label: 'Routes', icon: '🗺️' },
  { id: 'traffic', label: 'Traffic', icon: '🚦' },
  { id: 'telemetry', label: 'Telemetry', icon: '📡' },
  { id: 'gis', label: 'GIS Tools', icon: '🛠️' },
];

export default function AdminDashboard() {
  const { user, isGuest, loading: authLoading } = useSafeAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/admin/graph/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.warn("Could not fetch admin stats:", err);
      }
    };
    fetchStats();
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500">
        Loading authentication...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 text-sm mt-1">
            {isGuest ? 'Viewing as Guest (Read-Only)' : `Welcome, ${user?.displayName || 'Admin'}`}
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex space-x-1 md:space-x-2 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-blue-600 border-b-2 border-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {activeTab === 'overview' && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">System Overview</h2>
            {stats ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <p className="text-sm text-blue-600 font-medium">Total Nodes</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.nodes || 0}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <p className="text-sm text-green-600 font-medium">Total Edges</p>
                  <p className="text-2xl font-bold text-green-900">{stats.edges || 0}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                  <p className="text-sm text-purple-600 font-medium">System Status</p>
                  <p className="text-2xl font-bold text-green-600">Online</p>
                </div>
              </div>
            ) : (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-24 bg-gray-100 rounded"></div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'routes' && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Route Management</h2>
            <p className="text-gray-600 mb-4">View and manage verified and CSV routes here.</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              Route tables and CSV management will be rendered here.
            </div>
          </div>
        )}

        {activeTab === 'traffic' && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Traffic & Congestion</h2>
            <p className="text-gray-600">Real-time and historical traffic analysis.</p>
          </div>
        )}

        {activeTab === 'telemetry' && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Telemetry Data</h2>
            <p className="text-gray-600">GPS pings and device tracking.</p>
          </div>
        )}

        {activeTab === 'gis' && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">GIS Tools</h2>
            <p className="text-gray-600">Spatial analysis and data ingestion tools.</p>
          </div>
        )}
      </div>
    </div>
  );
}