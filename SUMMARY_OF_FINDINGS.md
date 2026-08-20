# PH Routes - Data Flow Analysis

## Current Tables in Supabase:
1. **ph_routes** - Main routes table (has GPS data, is_approved, ride_count, etc.)
2. **ph_route_reference** - Reference table for route names (catalog)
3. **ph_user_tracks** - User GPS tracks (raw tracking data)
4. **ph_route_shapes** - Route shape/geometry data

## Current Flow When User Tracks:

### 1. User starts tracking
- Frontend: `LiveRouteRecorder.jsx` or `InlineRecorder.jsx`
- GPS points collected via `pwaTracker.js` or `backgroundTracker.js`
- Points downsampled via `gpsDownsampler.ts`

### 2. User submits track
- Frontend calls API endpoint
- **Endpoint**: `POST /api/save_commute` (in `api_routes.py`)
- Data goes to **`ph_user_tracks`** table (NOT `ph_routes` directly)
- Fields: `route_name`, `gps_track`, `gps_points`, `submitted_by`, `track_uuid`

### 3. Community route submission
- **Endpoint**: `POST /api/save_community_route` (in `admin_routes.py`)
- Data goes to **`ph_routes`** table with `is_approved: false, status: "pending"`
- Admin reviews and approves

### 4. Admin approval
- Admin approves via `POST /api/approve_route`
- Updates `ph_routes` with `is_approved: true, status: "verified"`

## Issue:
The routes from the CSV (`full_jeepney_routes.csv`) need to go into **`ph_route_reference`** table as the catalog. Then when users track, the GPS data goes into **`ph_routes`** or **`ph_user_tracks`** and references the `route_name` from `ph_route_reference`.

## What Needs to Happen:
1. **Populate `ph_route_reference`** with all routes from the CSV
2. **When user tracks**, check if route exists in `ph_route_reference`
3. **If yes**, allow tracking and save GPS data to `ph_user_tracks` or `ph_routes`
4. **If no**, prompt user to add the route to reference first (or auto-add)
