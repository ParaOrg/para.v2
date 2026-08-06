/**
 * RouteUploader.jsx — GeoJSON file upload form for community route submissions.
 *
 * Props:
 *   onSuccess — callback after successful upload
 */

import { useState, useRef } from "react";
import { getApiBaseUrl } from "../utils/api";

const API = getApiBaseUrl();

export default function RouteUploader({ onSuccess }) {
  const [file, setFile] = useState(null);
  const [routeName, setRouteName] = useState("");
  const [mode, setMode] = useState("jeepney");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const MODES = ["jeepney", "bus", "train", "lrt", "mrt", "uv_express"];

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.name.endsWith(".geojson") && !selected.name.endsWith(".json")) {
      setError("Please select a .geojson or .json file.");
      setFile(null);
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError("File is too large. Maximum size is 5MB.");
      setFile(null);
      return;
    }
    setError(null);
    setFile(selected);
    const nameFromFile = selected.name
      .replace(/\.(geojson|json)$/, "")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    if (!routeName) setRouteName(nameFromFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setError("Please select a file to upload."); return; }
    if (!routeName.trim()) { setError("Please enter a route name."); return; }
    setUploading(true);
    setError(null);
    try {
      const text = await file.text();
      let geojson;
      try { geojson = JSON.parse(text); } catch { throw new Error("Invalid JSON file."); }
      if (!geojson.features || geojson.features.length === 0) {
        throw new Error("GeoJSON file must contain at least one feature.");
      }
      geojson.features[0].properties = {
        ...geojson.features[0].properties,
        route_long_name: routeName.trim(),
        type: mode,
      };
      const res = await fetch(`${API}/admin/routes/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geojson),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Upload failed (HTTP ${res.status})`);
      }
      setSuccess(true);
      if (onSuccess) setTimeout(onSuccess, 1500);
    } catch (e) {
      setError(e.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setRouteName("");
    setMode("jeepney");
    setError(null);
    setSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
        <p className="text-2xl mb-2">✅</p>
        <h3 className="text-lg font-bold text-green-800">Route Submitted!</h3>
        <p className="text-sm text-green-600 mt-1">Your route &ldquo;{routeName}&rdquo; has been submitted for review.</p>
        <button onClick={handleReset} className="mt-4 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">Upload Another</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <h2 className="text-lg font-bold text-gray-900">📤 Upload a Route</h2>
      <p className="text-sm text-gray-500">Share a transit route with the community. Upload a GeoJSON file with the route geometry.</p>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">⚠️ {error}</div>}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Route Name <span className="text-red-500">*</span></label>
        <input type="text" value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="e.g., Cubao to Makati via EDSA" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" required />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Transit Mode</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent capitalize">
          {MODES.map((m) => (<option key={m} value={m} className="capitalize">{m.replace("_", " ")}</option>))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">GeoJSON File <span className="text-red-500">*</span></label>
        <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${file ? "border-purple-400 bg-purple-50" : "border-gray-300 hover:border-purple-400 hover:bg-purple-50/50"}`}>
          <input ref={fileInputRef} type="file" accept=".geojson,.json" onChange={handleFileChange} className="hidden" />
          {file ? (
            <div><p className="text-sm font-semibold text-purple-800">{file.name}</p><p className="text-xs text-purple-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB — Click to change</p></div>
          ) : (
            <div><p className="text-2xl mb-1">🗺️</p><p className="text-sm text-gray-500">Click to select a <code className="bg-gray-100 px-1 rounded">.geojson</code> file</p><p className="text-xs text-gray-400 mt-0.5">Max 5MB</p></div>
          )}
        </div>
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={uploading || !file} className="flex-1 py-2.5 bg-purple-800 text-white rounded-lg font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{uploading ? "Uploading…" : "🚀 Submit Route"}</button>
        <button type="button" onClick={handleReset} className="px-5 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">Clear</button>
      </div>
      <p className="text-xs text-gray-400">Submitted routes will be reviewed before appearing on the map. GeoJSON must contain valid LineString or MultiLineString geometries within Metro Manila.</p>
    </form>
  );
}
