"""
Admin Dashboard API Routes
- Traffic heatmap, Route inspector, GIS tools, Telemetry
"""

import sqlite3
import json
import os
import csv
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from typing import Optional

admin_router = APIRouter()
_csv_cache = None

# ── helpers ──────────────────────────────────────────────
def _get_db(request):
    return sqlite3.connect(request.app.state.db_path)

# ==========================================================
# TRAFFIC
# ==========================================================
@admin_router.get("/traffic/summary")
async def traffic_summary(request: Request):
    db = _get_db(request)
    cur = db.cursor()
    cur.execute("SELECT COUNT(*) FROM telemetry_pings WHERE date(timestamp)=date('now')")
    pings_today = cur.fetchone()[0]
    cur.execute("SELECT COUNT(DISTINCT device_id) FROM telemetry_pings WHERE timestamp>=datetime('now','-1 hour')")
    active = cur.fetchone()[0]
    cur.execute("SELECT AVG(congestion_factor),COUNT(*) FROM traffic_segments WHERE last_updated>=datetime('now','-30 minutes')")
    avg_c, segs = cur.fetchone()
    cur.execute("""
        SELECT SUM(CASE WHEN congestion_factor<1.2 THEN 1 ELSE 0 END),
               SUM(CASE WHEN congestion_factor>=1.2 AND congestion_factor<2.0 THEN 1 ELSE 0 END),
               SUM(CASE WHEN congestion_factor>=2.0 AND congestion_factor<3.0 THEN 1 ELSE 0 END),
               SUM(CASE WHEN congestion_factor>=3.0 THEN 1 ELSE 0 END)
        FROM traffic_segments WHERE last_updated>=datetime('now','-30 minutes')
    """)
    sev = cur.fetchone()
    db.close()
    return {"pings_today":pings_today,"active_devices":active,"avg_congestion":round(avg_c or 1,2),
            "congested_segments":segs,"severity_breakdown":{"free_flow":sev[0]or 0,"moderate":sev[1]or 0,"heavy":sev[2]or 0,"severe":sev[3]or 0}}

@admin_router.get("/traffic/segments")
async def list_segments(request: Request, route: Optional[str]=None, limit: int=100):
    db = _get_db(request)
    cur = db.cursor()
    if route:
        cur.execute("SELECT route_name,from_node,to_node,observed_speed_kmh,observation_count,congestion_factor,last_updated FROM traffic_segments WHERE route_name=? AND last_updated>=datetime('now','-1 hour') ORDER BY congestion_factor DESC LIMIT ?",(route,limit))
    else:
        cur.execute("SELECT route_name,from_node,to_node,observed_speed_kmh,observation_count,congestion_factor,last_updated FROM traffic_segments WHERE last_updated>=datetime('now','-1 hour') ORDER BY congestion_factor DESC LIMIT ?",(limit,))
    rows = cur.fetchall()
    db.close()
    return {"segments":[{"route_name":r[0],"from_node":r[1],"to_node":r[2],"observed_speed_kmh":round(r[3],1)if r[3]else None,"observation_count":r[4],"congestion_factor":round(r[5],2),"last_updated":r[6]}for r in rows],"count":len(rows)}

# ==========================================================
# ROUTE LISTS
# ==========================================================
@admin_router.get("/routes/csv")
async def get_csv_routes():
    global _csv_cache
    if _csv_cache:
        return _csv_cache
    paths = [os.path.join(os.path.dirname(os.path.abspath(__file__)),"geojson_data","full_jeepney_routes.csv"),
             os.path.join("geojson_data","full_jeepney_routes.csv")]
    fp = next((p for p in paths if os.path.exists(p)), None)
    if not fp:
        return {"routes":[],"count":0,"error":"CSV not found"}
    seen, routes = set(), []
    with open(fp, encoding='utf-8') as f:
        for row in csv.DictReader(f):
            name = row.get("route_long_name","").strip()
            if name and name.lower() not in seen:
                seen.add(name.lower())
                routes.append({"route_id":row.get("route_id","").strip(),"route_name":name,"agency":row.get("agency_id","").strip()})
    _csv_cache = {"routes":routes,"count":len(routes)}
    return _csv_cache

@admin_router.post("/routes/reload")
async def reload_csv():
    global _csv_cache
    _csv_cache = None
    return {"status":"ok"}

@admin_router.get("/routes/verified")
async def get_verified_routes(request: Request):
    """Return routes from graph that match GeoJSON feature names (auto-detected, no walk paths)."""
    G = request.app.state.G
    
    # Collect verified route names from all GeoJSON files
    verified_names = set()
    skip_types = {'walk', 'WALK_TRANSFER', 'WALK_TO_TRANSIT', 'WALK_FROM_TRANSIT'}
    geojson_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "geojson_data")
    if os.path.exists(geojson_dir):
        for fname in os.listdir(geojson_dir):
            if fname.endswith(".geojson"):
                try:
                    with open(os.path.join(geojson_dir, fname), encoding='utf-8') as f:
                        data = json.load(f)
                    for feat in data.get("features", []):
                        props = feat.get("properties", {})
                        name = props.get("route_long_name") or props.get("name", "")
                        ftype = props.get("type", "")
                        if name.strip() and ftype not in skip_types:
                            verified_names.add(name.strip())
                except:
                    pass
    
    routes = {}
    for u,v,d in G.edges(data=True):
        r = d.get('route','')
        t = d.get('type','')
        if r not in verified_names or t in skip_types:
            continue
        if r not in routes:
            routes[r] = []
        ul, vl = G.nodes[u], G.nodes[v]
        routes[r].append([[ul.get('lng'),ul.get('lat')],[vl.get('lng'),vl.get('lat')]])
    
    out = [{"key":k,"name":k,"edge_count":len(v)} for k,v in sorted(routes.items())]
    return {"routes":out,"count":len(out)}

@admin_router.get("/routes/geojson")
async def get_raw_geojson():
    """Serve routes.geojson directly — like opening in QGIS."""
    fp = os.path.join(os.path.dirname(os.path.abspath(__file__)),"geojson_data","routes.geojson")
    if not os.path.exists(fp):
        return JSONResponse(status_code=404, content={"error":"routes.geojson not found"})
    with open(fp, encoding='utf-8') as f:
        return json.load(f)

@admin_router.get("/routes/geometry/{route_name:path}")
async def get_route_geometry(request: Request, route_name: str):
    G = request.app.state.G
    
    # Collect all edges for this route
    edges = []
    for u,v,d in G.edges(data=True):
        if d.get('route','') == route_name:
            ul, vl = G.nodes[u], G.nodes[v]
            edges.append({
                "from": [ul.get('lng'), ul.get('lat')],
                "to": [vl.get('lng'), vl.get('lat')]
            })
    
    if not edges:
        return JSONResponse(status_code=404, content={"error": "Route not found"})
    
    # Sort edges to follow the path: each edge's "from" should connect to previous "to"
    if len(edges) > 1:
        sorted_edges = [edges[0]]
        remaining = edges[1:]
        while remaining:
            last = sorted_edges[-1]["to"]
            # Find edge that starts where last one ended
            best_idx = 0
            best_dist = float('inf')
            for i, e in enumerate(remaining):
                d = ((e["from"][0]-last[0])**2 + (e["from"][1]-last[1])**2)**0.5
                if d < best_dist:
                    best_dist = d
                    best_idx = i
            sorted_edges.append(remaining.pop(best_idx))
        edges = sorted_edges
    
    all_coords = [edges[0]["from"]]
    for e in edges:
        all_coords.append(e["to"])
    
    return {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": all_coords},
        "properties": {"route_name": route_name, "edge_count": len(edges)}
    }
# ==========================================================
# GIS TOOLS
# ==========================================================
@admin_router.get("/routes")
async def list_routes(request: Request):
    G = request.app.state.G
    skip = {'WALK_TRANSFER','WALK_TO_TRANSIT','WALK_FROM_TRANSIT'}
    names = {d.get('route','') for _,_,d in G.edges(data=True) if d.get('route','') not in skip}
    return {"routes":sorted(names),"count":len(names)}

@admin_router.get("/routes/{route_name}/edges")
async def get_route_edges(request: Request, route_name: str):
    G = request.app.state.G
    edges = []
    for u,v,d in G.edges(data=True):
        if d.get('route','').lower() == route_name.lower():
            ul, vl = G.nodes[u], G.nodes[v]
            edges.append({"from_node":u,"to_node":v,"from_coords":[ul['lat'],ul['lng']],"to_coords":[vl['lat'],vl['lng']],"distance_m":round(d.get('distance',0),1),"time_min":round(d.get('time_min',0),1),"type":d.get('type','jeep'),"routing_weight":round(d.get('routing_weight',0),2)})
    return {"route_name":route_name,"edges":edges,"count":len(edges)}

@admin_router.post("/routes/flip")
async def flip_edge(request: Request):
    body = await request.json()
    u, v = body.get('from_node'), body.get('to_node')
    if not u or not v:
        return JSONResponse(400,{"error":"from_node and to_node required"})
    G = request.app.state.G
    if not G.has_edge(u,v):
        return JSONResponse(404,{"error":"Edge not found"})
    data = dict(G.edges[u,v])
    G.remove_edge(u,v)
    G.add_edge(v,u,**data)
    return {"status":"flipped","new_from":v,"new_to":u,"route":data.get('route','')}

@admin_router.post("/routes/rename")
async def rename_route(request: Request):
    body = await request.json()
    old, new = body.get('old_name'), body.get('new_name')
    if not old or not new:
        return JSONResponse(400,{"error":"old_name and new_name required"})
    G = request.app.state.G
    n = 0
    for u,v,d in G.edges(data=True):
        if d.get('route','') == old:
            G.edges[u,v]['route'] = new
            n += 1
    return {"status":"renamed","old_name":old,"new_name":new,"edges_renamed":n}

# ==========================================================
# TELEMETRY & GRAPH STATS
# ==========================================================
@admin_router.get("/telemetry/recent")
async def recent_pings(request: Request, limit: int=50):
    db = _get_db(request)
    cur = db.cursor()
    cur.execute("SELECT device_id,lat,lng,speed_kmh,heading,timestamp,trip_id FROM telemetry_pings ORDER BY timestamp DESC LIMIT ?",(limit,))
    rows = cur.fetchall()
    db.close()
    return {"pings":[{"device_id":r[0],"lat":r[1],"lng":r[2],"speed_kmh":r[3],"heading":r[4],"timestamp":r[5],"trip_id":r[6]}for r in rows],"count":len(rows)}

@admin_router.get("/graph/stats")
async def graph_stats(request: Request):
    G = request.app.state.G
    vc = {}
    for _,_,d in G.edges(data=True):
        t = d.get('type','unknown')
        vc[t] = vc.get(t,0) + 1
    return {"nodes":G.number_of_nodes(),"edges":G.number_of_edges(),"vehicle_types":vc,"is_directed":G.is_directed()}
@admin_router.post("/routes/custom")
async def save_custom_route(request: Request):
    body = await request.json()
    name = body.get("name", "Custom Route")
    stops = json.dumps(body.get("stops", []))
    path_nodes = json.dumps(body.get("path_nodes", []))
    total_fare = body.get("total_fare", 0)
    total_time = body.get("total_time", 0)
    created_by = body.get("created_by", "anonymous")
    
    db = sqlite3.connect(request.app.state.db_path)
    db.execute("INSERT INTO custom_routes(name, stops, path_nodes, total_fare, total_time, created_by, created_at) VALUES(?,?,?,?,?,?,datetime('now'))",
               (name, stops, path_nodes, total_fare, total_time, created_by))
    db.commit()
    route_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    db.close()
    return {"status": "ok", "id": route_id}

@admin_router.get("/routes/custom")
async def list_custom_routes(request: Request):
    db = sqlite3.connect(request.app.state.db_path)
    rows = db.execute("SELECT id, name, stops, total_fare, total_time, created_by, created_at FROM custom_routes ORDER BY created_at DESC").fetchall()
    db.close()
    return {"routes": [{"id": r[0], "name": r[1], "stops": json.loads(r[2]), "total_fare": r[3], "total_time": r[4], "created_by": r[5], "created_at": r[6]} for r in rows]}

@admin_router.post("/routes/chain")
async def chain_routes(request: Request):
    """Chain multiple verified routes together and return combined result."""
    body = await request.json()
    route_names = body.get("routes", [])
    if len(route_names) < 2:
        return JSONResponse(400, {"error": "Need at least 2 routes to chain"})
    
    G = request.app.state.G
    
    all_coords = []
    total_dist = 0
    total_time = 0
    total_fare = 0
    segments = []
    
    for name in route_names:
        # Collect edges for this route
        edges = []
        for u, v, d in G.edges(data=True):
            if d.get('route', '') == name:
                ul, vl = G.nodes[u], G.nodes[v]
                edges.append({
                    "from": [ul.get('lng'), ul.get('lat')],
                    "to": [vl.get('lng'), vl.get('lat')],
                    "dist": d.get('distance', 0),
                    "time": d.get('time_min', 0)
                })
        
        if not edges:
            continue
        
        # Sort edges end-to-end
        if len(edges) > 1:
            sorted_edges = [edges[0]]
            remaining = edges[1:]
            while remaining:
                last = sorted_edges[-1]["to"]
                best_idx = 0
                best_dist = float('inf')
                for i, e in enumerate(remaining):
                    d = ((e["from"][0]-last[0])**2 + (e["from"][1]-last[1])**2)**0.5
                    if d < best_dist:
                        best_dist = d
                        best_idx = i
                sorted_edges.append(remaining.pop(best_idx))
            edges = sorted_edges
        
        # Build coordinates
        route_coords = [edges[0]["from"]]
        route_dist = 0
        route_time = 0
        for e in edges:
            route_coords.append(e["to"])
            route_dist += e["dist"]
            route_time += e["time"]
        
        all_coords.extend(route_coords)
        total_dist += route_dist
        total_time += route_time
        total_fare += 13  # base jeepney fare per route
        segments.append({
            "name": name,
            "distance_km": round(route_dist/1000, 2),
            "time_min": round(route_time, 1)
        })
    
    if not all_coords:
        return JSONResponse(404, {"error": "No geometry found for these routes"})
    
    # Remove duplicate consecutive coordinates
    uniq = [all_coords[0]]
    for c in all_coords[1:]:
        if c != uniq[-1]:
            uniq.append(c)
    
    return {
        "success": True,
        "total_distance_km": round(total_dist/1000, 2),
        "total_time_min": round(total_time, 1),
        "total_fare": round(total_fare, 0),
        "segments": segments,
        "geometry": {
            "type": "LineString",
            "coordinates": uniq
        }
    }

@admin_router.get("/debug/paths")
async def debug_paths():
    base = os.path.dirname(os.path.abspath(__file__))
    gd = os.path.join(base,"geojson_data")
    files = os.listdir(gd) if os.path.exists(gd) else []
    return {"base":base,"geojson_dir":gd,"exists":os.path.exists(gd),"files":files,"csv_exists":os.path.exists(os.path.join(gd,"full_jeepney_routes.csv"))}