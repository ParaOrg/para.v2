# 🚐 Para PH v2.1 — Development Update

**Date:** July 28, 2026  
**Status:** Pre-MVP — Core features complete, polish in progress

---

# 📋 What We Built Today

## 1. Telemetry & Traffic Intelligence System

**New file:** `telemetry_engine.py`

### Features
- Ingests GPS pings
- Snaps locations to graph edges
- Calculates congestion factors
- Applies traffic-aware routing

### Database
- `telemetry_pings` — anonymized GPS data
- `traffic_segments` — congestion analysis

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/telemetry/ping` | POST | Receive a single GPS ping |
| `/telemetry/batch` | POST | Receive bulk GPS pings |
| `/telemetry/simulate` | POST | Generate simulated GPS pings for development |
| `/traffic/analyze` | POST | Trigger congestion recalculation |
| `/traffic/geojson` | GET | Return heatmap GeoJSON for map overlays |

### Background Tasks
- Congestion analysis runs automatically every **5 minutes**

### Routing
- `apply_traffic_to_graph()` multiplies graph edge weights using congestion factors before pathfinding.

---

## 2. Admin Dashboard

### New Files
- `admin_routes.py`
- `src/pages/AdminDashboard.jsx`

### Dashboard Tabs

| Tab | Features |
|------|----------|
| **Overview** | Graph statistics, traffic summary, severity breakdown |
| **Traffic** | Simulate pings, analyze congestion, inspect segments |
| **Routes** | Browse routes, flip edge directions, rename routes |
| **Telemetry** | Manual GPS ping submission and API examples |
| **GIS Tools** | Reload CSV files and manage GIS data |

---

## 3. Frontend Migration (Google Maps → OpenStreetMap)

### Removed
- `@vis.gl/react-google-maps`
- `useGoogleMaps`

### Migrated
- `map_component.jsx` → Leaflet
- `RouteLines.jsx` → Leaflet
- `RouteMarkers.jsx` → Leaflet
- `map_constants.js` → Leaflet-compatible marker icons

### Deleted
- `src/hooks/useGoogleMaps.js`
- `src/config/googleMaps.js`

**Result:** Entire mapping stack now uses **Leaflet + OpenStreetMap**, eliminating Google Maps API keys and associated costs.

---

## 4. Route Explorer Page

**File:** `src/pages/RoutesExplorer.jsx`

### Features
- Verified (GPS-traced) routes
- All CSV routes
- Search and filtering
- Leaflet route visualization

### Backend APIs
- `/admin/routes/verified`
- `/admin/routes/csv`

---

## 5. Bug Fixes

### Frontend
- ✅ Fixed WSOD by adding `<BrowserRouter>` in `main.jsx`
- ✅ Fixed Tailwind by enabling `tailwindcss()` in `vite.config.js`
- ✅ Removed duplicate `App()` function
- ✅ Fixed `apiKey is not defined` in `Map.jsx`

### Backend
- ✅ Connected previously commented-out admin router
- ✅ Fixed CSV path resolution
- ✅ Added missing `/admin` Vite proxy

### Authentication
- ✅ Prevented `AuthContext` crash when Firebase keys are missing

---

## 6. Backend API Additions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/routes/csv` | GET | Cached CSV route list |
| `/admin/routes/verified` | GET | Verified GPS routes |
| `/admin/routes/geometry/{name}` | GET | Route GeoJSON |
| `/admin/routes/reload` | POST | Clear CSV cache |
| `/admin/routes/flip` | POST | Reverse edge direction |
| `/admin/routes/rename` | POST | Rename route |
| `/admin/traffic/summary` | GET | Traffic overview |
| `/admin/traffic/segments` | GET | Segment congestion |
| `/admin/telemetry/recent` | GET | Recent GPS pings |
| `/admin/graph/stats` | GET | Graph statistics |

---

# 🔄 Changes Since Last Update

## Architecture

### Thread-safe Graph
- `find_routes_with_alternatives()` now copies the routing graph before pathfinding to avoid race conditions.

### Traffic-Aware Routing
- Live congestion factors now influence shortest-path calculations.

### CSV Route Loading
- `full_jeepney_routes.csv` is loaded once and cached in memory for fast subsequent requests.

---

## Frontend

### Mapping
- Fully migrated to **OpenStreetMap + Leaflet**
- No API keys required

### New Pages

| Route | Description |
|--------|-------------|
| `/admin` | Full administrative dashboard |
| `/routes` | Route Explorer |
| `/map` | Chat-based routing interface |

### Map Features
- Chat-powered trip planning
- Step-by-step directions
- Fare estimation
- Route rating system

---

## Database

Added:

- `telemetry_pings`
- `traffic_segments`

Also introduced:

- CSV route cache
- Traffic congestion storage

---

## Project Structure

### New Files

```text
telemetry_engine.py              # GPS ingestion & congestion analysis
admin_routes.py                  # Admin API
src/pages/AdminDashboard.jsx     # Admin dashboard
src/pages/RoutesExplorer.jsx     # Route Explorer
```

### Modified Files

```text
main.py
models.py
api_routes.py

src/App.jsx
src/main.jsx

vite.config.js

src/components/map_component.jsx
src/components/RouteLines.jsx
src/components/RouteMarkers.jsx
src/components/map_constants.js

src/pages/Map.jsx

src/context/AuthContext.jsx
```

### Deleted Files

```text
src/hooks/useGoogleMaps.js
src/config/googleMaps.js
```

---

# 🚀 Pre-MVP Launch Checklist

## Must Complete Before Launch

- [ ] Run `ingest_pois.py` to populate `para_poi.db`
- [ ] Populate `geojson_data/` with real Metro Manila routes
- [ ] Test Ollama (Llama 3.2) using Filipino and Taglish queries
- [ ] Validate geocoding for 20+ Metro Manila locations
- [ ] Verify responsive layout on 375px mobile screens
- [ ] Improve error states
  - No route found
  - Server unavailable
  - Geocoding failure
- [ ] Add loading indicators for all async operations
- [ ] Configure Firebase Authentication (or remove auth before launch)

---

## Polish Tasks

- [ ] Connect Gas Price widget to a live API
- [ ] Connect Metro Countdown to a GTFS feed
- [ ] Wire Waitlist to Supabase
- [ ] Add SEO metadata and Open Graph tags
- [ ] Verify `frontend/public/favicon.jpg`
- [ ] Run production build
- [ ] Test Docker deployment

---

## Known Issues

| Issue | Severity | Planned Fix |
|------|----------|-------------|
| Initial CSV load (~690 KB) is slow | Low | Cached after first request |
| Gas Price widget uses placeholder data | Medium | Connect to real API or remove |
| Firebase Auth disabled | Low | Configure Firebase or remove login |
| No real telemetry available | Low | Use simulation endpoint during demos |

---

# 🏗️ Running the Project

## Development

### Backend

```bash
cd para.v2
venv\Scripts\activate
python main.py
```

### Frontend

```bash
cd para.v2\frontend
npm run dev
```

### Local URLs

| Service | URL |
|---------|-----|
| Backend | http://localhost:8000 |
| Frontend | http://localhost:5173 |
| Admin Dashboard | http://localhost:5173/admin |
| Route Explorer | http://localhost:5173/routes |
| Interactive Map | http://localhost:5173/map |

---

## Production Build

```bash
cd para.v2\frontend
npm run build
```

Serve the generated `frontend/dist/` directory using FastAPI static files.

---

# 📝 Next Development Session

### High Priority

1. Run POI ingestion
2. Populate real GeoJSON route data
3. Test Metro Manila geocoding accuracy
4. Replace remaining placeholder widgets
   - Gas Price
   - Metro Countdown
5. Complete mobile responsiveness audit
6. Prepare for MVP launch

---

# 📌 Summary

Today's work significantly advanced **Para PH v2.1** toward MVP readiness.

### Major accomplishments

- ✅ Built a complete telemetry and traffic intelligence system
- ✅ Added a full-featured admin dashboard
- ✅ Migrated the entire frontend from Google Maps to Leaflet/OpenStreetMap
- ✅ Created a Route Explorer interface
- ✅ Added comprehensive backend APIs
- ✅ Improved routing with real-time congestion awareness
- ✅ Resolved major frontend, backend, and authentication issues

The project is now in the **Pre-MVP** stage. Remaining work focuses on real-world data, UI polish, testing, and deployment readiness before launch.