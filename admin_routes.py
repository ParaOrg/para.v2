"""
admin_routes.py - Admin endpoints for route management
"""

from fastapi import APIRouter, HTTPException, Response, Query
import json
import os
import glob
import csv
import io
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

router = APIRouter(prefix="/admin", tags=["admin"])

# Resolve the data directory relative to this file's location
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "geojson_data"

# Cache for route data
_route_cache = None
_route_cache_time = 0
CACHE_TTL = 30  # seconds


def get_data_dir() -> Path:
    """Get the geojson data directory, creating if needed"""
    if not DATA_DIR.exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)
    return DATA_DIR


def get_all_routes(refresh: bool = False) -> List[Dict[str, Any]]:
    """Get all routes from GeoJSON files with caching"""
    global _route_cache, _route_cache_time
    
    if not refresh and _route_cache is not None and (time.time() - _route_cache_time) < CACHE_TTL:
        return _route_cache
    
    data_dir = get_data_dir()
    routes = []
    geojson_files = sorted(data_dir.glob("*.geojson"))
    
    # Filter out backup files
    geojson_files = [f for f in geojson_files if ".bak" not in f.name]
    
    if not geojson_files:
        print(f"⚠️ No GeoJSON files found in {data_dir}")
        return routes
    
    print(f"📂 Loading {len(geojson_files)} GeoJSON files from {data_dir}")
    
    for filepath in geojson_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            for idx, feature in enumerate(data.get("features", [])):
                props = feature.get("properties", {})
                geom = feature.get("geometry", {})
                
                # Extract coordinates
                coords = []
                if geom.get("type") == "MultiLineString":
                    coords = geom.get("coordinates", [])
                elif geom.get("type") == "LineString":
                    coords = [geom.get("coordinates", [])]
                
                # Get route name
                route_name = (
                    props.get("route_long_name") or 
                    props.get("route_name") or 
                    props.get("name") or 
                    f"Route {idx}"
                )
                
                # Determine vehicle type
                vehicle_type = props.get("type") or props.get("mode") or "jeep"
                
                routes.append({
                    "file": filepath.name,
                    "index": idx,
                    "name": route_name,
                    "mode": vehicle_type,
                    "oneway": props.get("oneway", False),
                    "bidirectional": props.get("bidirectional", False),
                    "loop": props.get("loop", False),
                    "coordinates": coords,
                    "properties": props,
                    "key": route_name,
                })
        except Exception as e:
            print(f"⚠️ Error reading {filepath}: {e}")
    
    _route_cache = routes
    _route_cache_time = time.time()
    
    print(f"✅ Loaded {len(routes)} routes from {len(geojson_files)} files")
    return routes


def _find_route_file(filename: str) -> Path:
    """Find a GeoJSON file by name"""
    data_dir = get_data_dir()
    filepath = data_dir / filename
    
    if not filepath.exists():
        # Try without .geojson extension
        if not filename.endswith(".geojson"):
            filepath = data_dir / f"{filename}.geojson"
    
    if not filepath.exists():
        raise HTTPException(404, f"File not found: {filename}")
    
    return filepath


# ============ GET ENDPOINTS ============

@router.get("/routes/list")
def list_routes(refresh: bool = Query(False, description="Force refresh cache")):
    """List all available routes with metadata"""
    routes = get_all_routes(refresh=refresh)
    
    simplified = []
    for route in routes:
        simplified.append({
            "file": route.get("file", ""),
            "index": route.get("index", 0),
            "name": route.get("name", ""),
            "mode": route.get("mode", ""),
            "oneway": route.get("oneway", False),
            "bidirectional": route.get("bidirectional", False),
            "loop": route.get("loop", False),
        })
    
    return {"routes": simplified, "total": len(simplified)}


@router.get("/routes/geojson")
def get_routes_geojson(refresh: bool = Query(False)):
    """Get all routes as a single GeoJSON FeatureCollection"""
    routes = get_all_routes(refresh=refresh)
    
    features = []
    for route in routes:
        coords = route.get("coordinates", [])
        if not coords:
            continue
        
        # Use MultiLineString if multiple segments, LineString otherwise
        if len(coords) > 1:
            geometry = {"type": "MultiLineString", "coordinates": coords}
        else:
            geometry = {"type": "LineString", "coordinates": coords[0]}
        
        features.append({
            "type": "Feature",
            "properties": {
                "route_long_name": route.get("name", ""),
                "name": route.get("name", ""),
                "mode": route.get("mode", ""),
                "oneway": route.get("oneway", False),
                "bidirectional": route.get("bidirectional", False),
                "loop": route.get("loop", False),
                "file": route.get("file", ""),
            },
            "geometry": geometry,
        })
    
    return {
        "type": "FeatureCollection",
        "features": features,
        "total": len(features),
    }


@router.get("/routes/verified")
def get_verified_routes():
    """Get routes that have been manually verified (have 'verified' flag in properties)"""
    all_routes = get_all_routes()
    verified = []
    
    for r in all_routes:
        props = r.get("properties", {})
        # A route is "verified" if it has the verified flag or was manually edited
        if props.get("verified") or props.get("last_updated"):
            verified.append({
                "name": r.get("name", ""),
                "key": r.get("name", ""),
                "mode": r.get("mode", "jeep"),
                "file": r.get("file", ""),
                "oneway": r.get("oneway", False),
                "bidirectional": r.get("bidirectional", False),
                "last_updated": props.get("last_updated", ""),
            })
    
    return {"routes": verified, "total": len(verified)}


@router.get("/routes/csv")
def get_routes_csv():
    """Export all routes as CSV file"""
    routes = get_all_routes()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "route_id", "name", "mode", "oneway", "bidirectional", 
        "loop", "file", "index"
    ])
    
    for i, route in enumerate(routes):
        writer.writerow([
            f"ROUTE_{i + 1}",
            route.get("name", ""),
            route.get("mode", ""),
            route.get("oneway", False),
            route.get("bidirectional", False),
            route.get("loop", False),
            route.get("file", ""),
            route.get("index", 0),
        ])
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=routes_export.csv"}
    )


@router.get("/routes/stats")
def get_route_stats():
    """Get statistics about all routes"""
    routes = get_all_routes()
    
    total_files = len(set(r.get("file") for r in routes))
    total_routes = len(routes)
    
    route_types = {}
    oneway_count = 0
    bidirectional_count = 0
    loop_count = 0
    verified_count = 0
    
    for route in routes:
        mode = route.get("mode", "unknown")
        route_types[mode] = route_types.get(mode, 0) + 1
        
        if route.get("oneway", False):
            oneway_count += 1
        if route.get("bidirectional", False):
            bidirectional_count += 1
        if route.get("loop", False):
            loop_count += 1
        if route.get("properties", {}).get("verified"):
            verified_count += 1
    
    return {
        "total_files": total_files,
        "total_routes": total_routes,
        "route_types": route_types,
        "oneway_count": oneway_count,
        "bidirectional_count": bidirectional_count,
        "loop_count": loop_count,
        "verified_count": verified_count,
    }

# Add these endpoints to admin_routes.py (before the POST endpoints section)

@router.get("/routes")
def get_routes_root():
    """Redirect alias - same as /admin/routes/list"""
    return list_routes()


@router.get("/graph/stats")
def get_graph_stats():
    """Get graph statistics from the running graph instance"""
    # Try to import the graph from main module
    try:
        import sys
        if "main" in sys.modules:
            main_module = sys.modules["main"]
            if hasattr(main_module, "G") and main_module.G is not None:
                G = main_module.G
                graph_stats = G.graph.get("stats", {})
                return {
                    "status": "ok",
                    "nodes": G.number_of_nodes(),
                    "edges": G.number_of_edges(),
                    "routes": len(G.graph.get("route_nodes", {})),
                    "build_time": graph_stats.get("build_time", 0),
                    "transfers": graph_stats.get("transfers", 0),
                }
    except Exception as e:
        print(f"⚠️ Could not get graph stats: {e}")
    
    # Fallback: return what we know from routes
    routes = get_all_routes()
    return {
        "status": "fallback",
        "routes_loaded": len(routes),
        "files_loaded": len(set(r.get("file") for r in routes)),
        "note": "Graph stats only available when server is running with graph loaded"
    }
# ============ ADDITIONAL MISSING ENDPOINTS ============

@router.get("/routes/geometry/{name:path}")
def get_route_geometry(name: str):
    """Get geometry for a specific route by name"""
    routes = get_all_routes()
    
    for route in routes:
        if route.get("name", "").lower() == name.lower():
            return {
                "name": route["name"],
                "geometry": route.get("coordinates", []),
                "mode": route.get("mode", ""),
            }
    
    raise HTTPException(404, f"Route not found: {name}")


@router.post("/routes/rename")
def rename_route(file: str = Query(...), index: int = Query(...), new_name: str = Query(...)):
    """Rename a route"""
    filepath = _find_route_file(file)
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if index >= len(data["features"]):
            raise HTTPException(404, f"Feature index {index} not found")
        
        old_name = data["features"][index]["properties"].get("route_long_name", "")
        data["features"][index]["properties"]["route_long_name"] = new_name
        data["features"][index]["properties"]["route_name"] = new_name
        data["features"][index]["properties"]["name"] = new_name
        data["features"][index]["properties"]["last_updated"] = time.strftime("%Y-%m-%d")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        global _route_cache
        _route_cache = None
        
        return {
            "status": "success",
            "message": f"Renamed: '{old_name}' → '{new_name}'",
            "old_name": old_name,
            "new_name": new_name,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error renaming: {e}")


@router.post("/routes/reload")
def reload_routes():
    """Reload all routes from disk (clears cache)"""
    global _route_cache, _route_cache_time
    _route_cache = None
    _route_cache_time = 0
    routes = get_all_routes(refresh=True)
    return {
        "status": "success",
        "message": f"Reloaded {len(routes)} routes from disk",
        "total": len(routes),
    }


@router.get("/telemetry/recent")
def get_recent_telemetry(limit: int = Query(20, ge=1, le=100)):
    """Get recent telemetry/route search data"""
    # Placeholder - connect to your telemetry database
    return {
        "searches": [],
        "total": 0,
        "note": "Telemetry database not yet connected"
    }


@router.post("/routes/chain")
def chain_routes(routes: str = Query(...)):
    """Chain multiple routes together into a single path"""
    # Parse the routes parameter (comma-separated or repeated)
    route_names = [r.strip() for r in routes.split(",")]
    
    all_routes = get_all_routes()
    found_routes = []
    
    for name in route_names:
        for r in all_routes:
            if r.get("name", "").lower() == name.lower():
                found_routes.append(r)
                break
    
    if not found_routes:
        raise HTTPException(404, "No matching routes found")
    
    combined_geometry = []
    for r in found_routes:
        coords = r.get("coordinates", [])
        if coords:
            combined_geometry.extend(coords)
    
    return {
        "routes": [r["name"] for r in found_routes],
        "combined_geometry": combined_geometry,
        "total_routes": len(found_routes),
    }


@router.post("/routes/custom")
def create_custom_route(data: Dict[str, Any]):
    """Create a custom route from provided data"""
    # Placeholder for custom route creation
    return {
        "status": "received",
        "message": "Custom route creation not yet implemented",
        "data_keys": list(data.keys()),
    }

# ============ POST ENDPOINTS ============

@router.post("/routes/flip")
def flip_route(file: str = Query(...), index: int = Query(...)):
    """Flip a route's direction (reverse the geometry)"""
    filepath = _find_route_file(file)
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if index >= len(data["features"]):
            raise HTTPException(404, f"Feature index {index} not found (max: {len(data['features']) - 1})")
        
        feature = data["features"][index]
        geom = feature["geometry"]
        
        if geom["type"] == "LineString":
            geom["coordinates"] = geom["coordinates"][::-1]
        elif geom["type"] == "MultiLineString":
            geom["coordinates"] = [line[::-1] for line in geom["coordinates"]]
        else:
            raise HTTPException(400, f"Unsupported geometry type: {geom['type']}")
        
        # Update properties
        feature["properties"]["oneway"] = True
        feature["properties"]["bidirectional"] = False
        feature["properties"]["last_updated"] = time.strftime("%Y-%m-%d")
        feature["properties"]["verified"] = True
        
        # Create backup before saving
        backup_path = filepath.with_suffix(f".geojson.bak.{time.strftime('%Y%m%d_%H%M%S')}")
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        # Invalidate cache
        global _route_cache
        _route_cache = None
        
        route_name = feature["properties"].get("route_long_name") or feature["properties"].get("name", "Route")
        
        return {
            "status": "success",
            "message": f"🔄 Flipped: {route_name}",
            "file": file,
            "index": index,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error flipping route: {e}")


@router.post("/routes/toggle-oneway")
def toggle_oneway(file: str = Query(...), index: int = Query(...)):
    """Toggle one-way/bidirectional status of a route"""
    filepath = _find_route_file(file)
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if index >= len(data["features"]):
            raise HTTPException(404, f"Feature index {index} not found")
        
        feature = data["features"][index]
        props = feature["properties"]
        
        current_oneway = props.get("oneway", False)
        props["oneway"] = not current_oneway
        props["bidirectional"] = current_oneway  # Flip bidirectional too
        props["last_updated"] = time.strftime("%Y-%m-%d")
        props["verified"] = True
        
        # Create backup
        backup_path = filepath.with_suffix(f".geojson.bak.{time.strftime('%Y%m%d_%H%M%S')}")
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        global _route_cache
        _route_cache = None
        
        route_name = props.get("route_long_name") or props.get("name", "Route")
        new_status = "one-way" if not current_oneway else "bidirectional"
        
        return {
            "status": "success",
            "message": f"🔀 {route_name}: now {new_status}",
            "file": file,
            "index": index,
            "oneway": not current_oneway,
            "bidirectional": current_oneway,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error toggling: {e}")


@router.post("/routes/refresh")
def refresh_routes():
    """Force refresh the route cache"""
    global _route_cache, _route_cache_time
    _route_cache = None
    _route_cache_time = 0
    routes = get_all_routes(refresh=True)
    return {
        "status": "success",
        "message": f"Cache refreshed: {len(routes)} routes loaded",
        "total": len(routes),
    }
@router.post("/routes/save")
def save_route(data: Dict[str, Any]):
    """Save a crowdsourced route to geojson_data/"""
    import time
    features = data.get("features", [])
    if not features:
        raise HTTPException(400, "No features in GeoJSON")
    
    route_name = features[0]["properties"].get("route_long_name", "unknown_route")
    safe_name = route_name.replace(" ", "_").replace("/", "-")[:50]
    filename = f"community_{safe_name}_{int(time.time())}.geojson"
    pending_dir = DATA_DIR.parent / "pending_routes"
    pending_dir.mkdir(exist_ok=True)
    filepath = pending_dir / filename
    
    # Add metadata
    data["metadata"] = {
        "source": "community",
        "saved_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "status": "pending_review",
    "approved": false
    }
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    # Invalidate cache
    global _route_cache
    _route_cache = None
    
    return {
        "status": "success",
        "message": f"Route saved: {filename}",
        "file": filename,
        "route_name": route_name
    }
@router.get("/pending/list")
def list_pending_routes():
    """List all pending community-submitted routes awaiting approval"""
    pending_dir = DATA_DIR.parent / "pending_routes"
    pending_dir.mkdir(exist_ok=True)
    
    routes = []
    for fp in sorted(pending_dir.glob("*.geojson"), reverse=True):
        try:
            with open(fp) as f:
                data = json.load(f)
            feat = data.get("features", [{}])[0]
            props = feat.get("properties", {})
            routes.append({
                "file": fp.name,
                "name": props.get("route_long_name", "Unknown"),
                "type": props.get("type", "jeep"),
                "bidirectional": props.get("bidirectional", False),
                "loop": props.get("loop", False),
                "status": data.get("metadata", {}).get("status", "pending"),
                "saved_at": data.get("metadata", {}).get("saved_at", ""),
                "coords_count": len(feat.get("geometry", {}).get("coordinates", [])),
            })
        except:
            pass
    
    return {"routes": routes, "total": len(routes)}

@router.get("/pending/geojson/{filename}")
def get_pending_geojson(filename: str):
    """Get a specific pending route's GeoJSON for review"""
    pending_dir = DATA_DIR.parent / "pending_routes"
    filepath = pending_dir / filename
    if not filepath.exists():
        raise HTTPException(404, "File not found")
    with open(filepath) as f:
        return json.load(f)

@router.post("/pending/approve")
def approve_route(filename: str = Query(...)):
    """Approve a pending route - moves it to geojson_data/"""
    pending_dir = DATA_DIR.parent / "pending_routes"
    filepath = pending_dir / filename
    if not filepath.exists():
        raise HTTPException(404, "File not found")
    
    # Read and update metadata
    with open(filepath) as f:
        data = json.load(f)
    
    data["metadata"]["status"] = "approved"
    data["metadata"]["approved_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    data["metadata"]["verified"] = True
    
    # Mark features as verified
    for feat in data.get("features", []):
        feat["properties"]["verified"] = True
        feat["properties"]["source"] = "community_approved"
    
    # Move to geojson_data/
    dest = DATA_DIR / filename
    with open(dest, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    # Remove from pending
    filepath.unlink()
    
    global _route_cache
    _route_cache = None
    
    return {"status": "success", "message": f"Approved: {filename} → geojson_data/"}

@router.post("/pending/reject")
def reject_route(filename: str = Query(...), reason: str = Query("")):
    """Reject a pending route"""
    pending_dir = DATA_DIR.parent / "pending_routes"
    filepath = pending_dir / filename
    if not filepath.exists():
        raise HTTPException(404, "File not found")
    
    # Move to rejected folder
    rejected_dir = DATA_DIR.parent / "rejected_routes"
    rejected_dir.mkdir(exist_ok=True)
    
    with open(filepath) as f:
        data = json.load(f)
    data["metadata"]["status"] = "rejected"
    data["metadata"]["rejected_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    data["metadata"]["rejection_reason"] = reason
    
    dest = rejected_dir / filename
    with open(dest, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    filepath.unlink()
    
    return {"status": "success", "message": f"Rejected: {filename}"}

@router.get("/commute/logs")
def list_commute_logs():
    """List all saved commute logs"""
    log_dir = DATA_DIR.parent / "commute_logs"
    log_dir.mkdir(exist_ok=True)
    
    logs = []
    for fp in sorted(log_dir.glob("*.json"), reverse=True)[:50]:
        try:
            with open(fp) as f:
                data = json.load(f)
            logs.append({
                "file": fp.name,
                "time": data.get("totalTime", 0),
                "distance": data.get("distance", 0),
                "gps_points": len(data.get("gpsTrack", [])),
                "actions": len(data.get("logs", [])),
                "route": data.get("routeData", {}).get("message", ""),
                "saved_at": data.get("saved_at", ""),
            })
        except:
            pass
    
    return {"logs": logs, "total": len(logs)}
@router.post("/commute/save")
def save_commute_log(data: Dict[str, Any]):
    """Save a completed commute log with GPS data"""
    log_dir = DATA_DIR.parent / "commute_logs"
    log_dir.mkdir(exist_ok=True)
    
    filename = f"commute_{int(time.time())}.json"
    filepath = log_dir / filename
    
    data["saved_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    return {
        "status": "success",
        "message": f"Commute log saved: {filename}",
        "gps_points": len(data.get("gpsTrack", [])),
        "distance_m": data.get("distance", 0),
        "total_time_s": data.get("totalTime", 0)
    }

@router.get("/commute/logs")
def list_commute_logs():
    """List all saved commute logs"""
    log_dir = DATA_DIR.parent / "commute_logs"
    log_dir.mkdir(exist_ok=True)
    
    logs = []
    for fp in sorted(log_dir.glob("*.json"), reverse=True)[:50]:
        try:
            with open(fp) as f:
                d = json.load(f)
            logs.append({
                "file": fp.name,
                "time": d.get("totalTime", 0),
                "distance": d.get("distance", 0),
                "gps_points": len(d.get("gpsTrack", [])),
                "actions": len(d.get("logs", [])),
                "route": d.get("routeData", {}).get("message", ""),
                "saved_at": d.get("saved_at", ""),
            })
        except: pass
    
    return {"logs": logs, "total": len(logs)}

