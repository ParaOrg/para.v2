"""
Admin Dashboard API Routes
- Traffic heatmap data
- Route inspector
- GIS correction tools (flip edge direction, rename routes)
- Telemetry statistics
"""

import sqlite3
import json
import networkx as nx
import csv
import os
from fastapi import APIRouter, Request, Query, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional, List
from pathlib import Path

admin_router = APIRouter()
router = APIRouter(prefix="/admin")

# ==========================================
# TRAFFIC DASHBOARD ENDPOINTS
# ==========================================
# Safe absolute path resolution
BASE_DIR = Path(__file__).resolve().parent.parent # Adjust based on where admin_routes.py is
CSV_PATH = BASE_DIR / "geojson_data" / "full_jeepney_routes.csv"

# In-memory cache
_csv_cache = None

def get_csv_routes():
    global _csv_cache
    if _csv_cache is not None:
        return _csv_cache
    
    if not CSV_PATH.exists():
        print(f"⚠️ CSV not found at {CSV_PATH}")
        return []
        
    routes = []
    with open(CSV_PATH, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            routes.append(row)
            
    _csv_cache = routes
    print(f"✅ Cached {len(routes)} routes from CSV.")
    return _csv_cache

@router.get("/routes/csv")
async def get_registered_routes():
    return {"routes": get_csv_routes()}

@router.post("/routes/reload")
async def reload_csv_cache():
    global _csv_cache
    _csv_cache = None
    return {"status": "success", "message": "CSV cache cleared. Next request will reload."}

@router.post("/routes/flip")
async def flip_route_edge(req: FlipRequest, request: Request):
    G = request.app.state.transit_graph
    lock = request.app.state.graph_lock
    
    async with lock:
        # Perform your edge flip/removal here
        # G.remove_edge(...)
        # G.add_edge(...)
        pass 
        
    return {"status": "success", "message": "Edge flipped safely."}

@admin_router.get("/traffic/summary")
async def traffic_summary(request: Request):
    """Get high-level traffic statistics for the dashboard."""
    db = sqlite3.connect(request.app.state.db_path)
    cursor = db.cursor()
    
    # Total pings today
    cursor.execute("""
        SELECT COUNT(*) FROM telemetry_pings 
        WHERE date(timestamp) = date('now')
    """)
    pings_today = cursor.fetchone()[0]
    
    # Active devices (unique device_ids in last hour)
    cursor.execute("""
        SELECT COUNT(DISTINCT device_id) FROM telemetry_pings
        WHERE timestamp >= datetime('now', '-1 hour')
    """)
    active_devices = cursor.fetchone()[0]
    
    # Average congestion
    cursor.execute("""
        SELECT AVG(congestion_factor), COUNT(*) 
        FROM traffic_segments
        WHERE last_updated >= datetime('now', '-30 minutes')
    """)
    avg_congestion, congested_segments = cursor.fetchone()
    
    # Segments by severity
    cursor.execute("""
        SELECT 
            SUM(CASE WHEN congestion_factor < 1.2 THEN 1 ELSE 0 END) as free_flow,
            SUM(CASE WHEN congestion_factor >= 1.2 AND congestion_factor < 2.0 THEN 1 ELSE 0 END) as moderate,
            SUM(CASE WHEN congestion_factor >= 2.0 AND congestion_factor < 3.0 THEN 1 ELSE 0 END) as heavy,
            SUM(CASE WHEN congestion_factor >= 3.0 THEN 1 ELSE 0 END) as severe
        FROM traffic_segments
        WHERE last_updated >= datetime('now', '-30 minutes')
    """)
    severity = cursor.fetchone()
    
    db.close()
    
    return {
        "pings_today": pings_today,
        "active_devices": active_devices,
        "avg_congestion": round(avg_congestion, 2) if avg_congestion else 1.0,
        "congested_segments": congested_segments,
        "severity_breakdown": {
            "free_flow": severity[0] if severity else 0,
            "moderate": severity[1] if severity else 0,
            "heavy": severity[2] if severity else 0,
            "severe": severity[3] if severity else 0
        }
    }


@admin_router.get("/traffic/segments")
async def list_segments(request: Request, route: Optional[str] = None, limit: int = 100):
    """Get individual traffic segments with congestion data."""
    db = sqlite3.connect(request.app.state.db_path)
    cursor = db.cursor()
    
    if route:
        cursor.execute("""
            SELECT route_name, from_node, to_node, observed_speed_kmh, observation_count, congestion_factor, last_updated
            FROM traffic_segments
            WHERE route_name = ? AND last_updated >= datetime('now', '-1 hour')
            ORDER BY congestion_factor DESC
            LIMIT ?
        """, (route, limit))
    else:
        cursor.execute("""
            SELECT route_name, from_node, to_node, observed_speed_kmh, observation_count, congestion_factor, last_updated
            FROM traffic_segments
            WHERE last_updated >= datetime('now', '-1 hour')
            ORDER BY congestion_factor DESC
            LIMIT ?
        """, (limit,))
    
    rows = cursor.fetchall()
    db.close()
    
    segments = []
    for row in rows:
        segments.append({
            "route_name": row[0],
            "from_node": row[1],
            "to_node": row[2],
            "observed_speed_kmh": round(row[3], 1) if row[3] else None,
            "observation_count": row[4],
            "congestion_factor": round(row[5], 2),
            "last_updated": row[6]
        })
    
    return {"segments": segments, "count": len(segments)}


# ==========================================
# GIS CORRECTION TOOLS
# ==========================================

@admin_router.get("/routes")
async def list_routes(request: Request):
    """List all unique transit routes in the graph for the admin panel."""
    G = request.app.state.G
    routes = set()
    for u, v, data in G.edges(data=True):
        route = data.get('route', 'Unknown')
        if route not in ['WALK_TRANSFER', 'WALK_TO_TRANSIT', 'WALK_FROM_TRANSIT']:
            routes.add(route)
    return {"routes": sorted(list(routes)), "count": len(routes)}


@admin_router.get("/routes/{route_name}/edges")
async def get_route_edges(request: Request, route_name: str):
    """Get all edges for a specific route (for the edge inspector)."""
    G = request.app.state.G
    edges = []
    for u, v, data in G.edges(data=True):
        if data.get('route', '').lower() == route_name.lower():
            u_attrs = G.nodes[u]
            v_attrs = G.nodes[v]
            edges.append({
                "from_node": u,
                "to_node": v,
                "from_coords": [u_attrs.get('lat'), u_attrs.get('lng')],
                "to_coords": [v_attrs.get('lat'), v_attrs.get('lng')],
                "distance_m": round(data.get('distance', 0), 1),
                "time_min": round(data.get('time_min', 0), 1),
                "type": data.get('type', 'jeep'),
                "routing_weight": round(data.get('routing_weight', 0), 2)
            })
    return {"route_name": route_name, "edges": edges, "count": len(edges)}


@admin_router.post("/routes/flip")
async def flip_edge_direction(request: Request):
    """Flip a specific edge's direction (for GIS correction)."""
    body = await request.json()
    from_node = body.get('from_node')
    to_node = body.get('to_node')
    
    if not from_node or not to_node:
        return JSONResponse(status_code=400, content={"error": "from_node and to_node required"})
    
    G = request.app.state.G
    
    if not G.has_edge(from_node, to_node):
        return JSONResponse(status_code=404, content={"error": "Edge not found"})
    
    # Get edge data
    edge_data = dict(G.edges[from_node, to_node])
    
    # Remove old edge, add reversed
    G.remove_edge(from_node, to_node)
    G.add_edge(to_node, from_node, **edge_data)
    
    return {
        "status": "flipped",
        "new_from": to_node,
        "new_to": from_node,
        "route": edge_data.get('route', 'Unknown')
    }


@admin_router.post("/routes/rename")
async def rename_route(request: Request):
    """Rename all edges belonging to a route."""
    body = await request.json()
    old_name = body.get('old_name')
    new_name = body.get('new_name')
    
    if not old_name or not new_name:
        return JSONResponse(status_code=400, content={"error": "old_name and new_name required"})
    
    G = request.app.state.G
    renamed = 0
    
    for u, v, data in G.edges(data=True):
        if data.get('route', '') == old_name:
            G.edges[u, v]['route'] = new_name
            renamed += 1
    
    return {"status": "renamed", "old_name": old_name, "new_name": new_name, "edges_renamed": renamed}


@admin_router.get("/telemetry/recent")
async def recent_pings(request: Request, limit: int = 50):
    """Get most recent telemetry pings for live tracking view."""
    db = sqlite3.connect(request.app.state.db_path)
    cursor = db.cursor()
    cursor.execute("""
        SELECT device_id, lat, lng, speed_kmh, heading, timestamp, trip_id
        FROM telemetry_pings
        ORDER BY timestamp DESC
        LIMIT ?
    """, (limit,))
    
    rows = cursor.fetchall()
    db.close()
    
    pings = []
    for row in rows:
        pings.append({
            "device_id": row[0],
            "lat": row[1],
            "lng": row[2],
            "speed_kmh": row[3],
            "heading": row[4],
            "timestamp": row[5],
            "trip_id": row[6]
        })
    
    return {"pings": pings, "count": len(pings)}


@admin_router.get("/graph/stats")
async def graph_statistics(request: Request):
    """Return graph statistics for the admin dashboard."""
    G = request.app.state.G
    
    # Count by vehicle type
    vehicle_counts = {}
    for u, v, data in G.edges(data=True):
        vtype = data.get('type', 'unknown')
        vehicle_counts[vtype] = vehicle_counts.get(vtype, 0) + 1
    
    return {
        "nodes": G.number_of_nodes(),
        "edges": G.number_of_edges(),
        "vehicle_types": vehicle_counts,
        "is_directed": G.is_directed()
    }


# ==========================================
# ROUTE LIST ENDPOINTS (for React frontend)
# ==========================================

# Cache for CSV routes (load once, serve from memory)
_csv_cache = None

@admin_router.get("/routes/csv")
async def get_csv_routes(request: Request):
    """Return all registered routes from full_jeepney_routes.csv (cached in memory)."""
    global _csv_cache
    
    if _csv_cache is not None:
        return _csv_cache
    
    # Try multiple possible paths
    possible_paths = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "geojson_data", "full_jeepney_routes.csv"),
        os.path.join("geojson_data", "full_jeepney_routes.csv"),
    ]
    
    csv_path = None
    for p in possible_paths:
        if os.path.exists(p):
            csv_path = p
            break
    
    if not csv_path:
        return {"routes": [], "count": 0, "error": f"CSV not found. Tried: {possible_paths}"}
    
    seen = set()
    routes = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            route_name = row.get("route_long_name", "").strip()
            if route_name and route_name.lower() not in seen:
                seen.add(route_name.lower())
                routes.append({
                    "route_id": row.get("route_id", "").strip(),
                    "route_name": route_name,
                    "agency": row.get("agency_id", "").strip(),
                    "route_type": row.get("route_type", "").strip(),
                    "description": row.get("route_desc", "").strip(),
                })
    
    _csv_cache = {"routes": routes, "count": len(routes)}
    return _csv_cache


@admin_router.post("/routes/reload")
async def reload_routes():
    """Clear cache and reload routes from CSV (use after dropping new files)."""
    global _csv_cache
    _csv_cache = None
    return {"status": "ok", "message": "Cache cleared. Next request will reload from CSV."}

@admin_router.get("/debug/paths")
async def debug_paths():
    """Show file paths to debug loading issues."""
    base = os.path.dirname(os.path.abspath(__file__))
    geojson_dir = os.path.join(base, "geojson_data")
    
    files_found = []
    if os.path.exists(geojson_dir):
        files_found = os.listdir(geojson_dir)
    
    return {
        "admin_routes_location": base,
        "geojson_dir": geojson_dir,
        "geojson_exists": os.path.exists(geojson_dir),
        "files": files_found[:20],
        "csv_path": os.path.join(geojson_dir, "full_jeepney_routes.csv"),
        "csv_exists": os.path.exists(os.path.join(geojson_dir, "full_jeepney_routes.csv")),
    }

@admin_router.get("/routes/verified")
async def get_verified_routes(request: Request):
    """Return routes that have actual GPS geometry in the graph."""
    G = request.app.state.G
    
    route_names = set()
    for u, v, data in G.edges(data=True):
        route = data.get('route', '')
        if route and route not in ['WALK_TRANSFER', 'WALK_TO_TRANSIT', 'WALK_FROM_TRANSIT']:
            route_names.add(route)
    
    verified = []
    for route_name in sorted(route_names):
        coords = []
        for u, v, data in G.edges(data=True):
            if data.get('route', '') == route_name:
                u_attrs = G.nodes[u]
                v_attrs = G.nodes[v]
                coords.append([
                    [u_attrs.get('lng'), u_attrs.get('lat')],
                    [v_attrs.get('lng'), v_attrs.get('lat')],
                ])
        
        if coords:
            verified.append({
                "key": route_name,
                "name": route_name,
                "edge_count": len(coords),
                "coords": coords,
            })
    
    return {"routes": verified, "count": len(verified)}


@admin_router.get("/routes/geometry/{route_name:path}")
async def get_route_geometry(request: Request, route_name: str):
    """Return GeoJSON LineString for a specific route."""
    G = request.app.state.G
    
    edges = []
    for u, v, data in G.edges(data=True):
        if data.get('route', '') == route_name:
            u_attrs = G.nodes[u]
            v_attrs = G.nodes[v]
            edges.append({
                "from": [u_attrs.get('lng'), u_attrs.get('lat')],
                "to": [v_attrs.get('lng'), v_attrs.get('lat')],
            })
    
    if not edges:
        return JSONResponse(status_code=404, content={"error": "Route not found"})
    
    all_coords = []
    for edge in edges:
        if not all_coords:
            all_coords.append(edge["from"])
        all_coords.append(edge["to"])
    
    return {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": all_coords
        },
        "properties": {
            "route_name": route_name,
            "edge_count": len(edges)
        }
    }