import csv
import sqlite3
import json
import networkx as nx
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from models import (
    RouteRequest, RouteResponse, RouteStep, ChatMessage, ChatResponse, FeedbackRequest,
    AddStationRequest, SubmitPriceReportRequest, GAS_BRANDS, GAS_FUEL_TYPES,
)
from graph_engine import haversine, SPEED_WALK_KMH, calculate_fare, bearing_to_compass, compass_to_bound
from llm_engine import parse_chat_intent_async, ask_info_llm, geocode_location
import gas_price_db as gas_db
from gas_price_sync import blend_gas_prices

router = APIRouter()

DB_PATH = Path(__file__).resolve().parent / "para_ml_data.db"
JEEPNEY_ROUTES_PATH = Path(__file__).resolve().parent / "data" / "geojson_data" / "routes.geojson"
ALL_ROUTES_CSV_PATH = Path(__file__).resolve().parent / "data" / "geojson_data" / "full_jeepney_routes.csv"

# ==========================================
# JEEPNEY ROUTES CATALOG (backs the /routes explorer page)
# ==========================================
# Two distinct datasets, not the same 51 entries twice:
#  - routes.geojson: 51 GPS-traced features with real path geometry ("Verified" tab).
#  - full_jeepney_routes.csv: the larger franchised-route catalog (name/agency/type
#    only, no GPS geometry) ("All Routes" tab). See docs/RAIL_BUS_DATA_SOURCES.md.
_jeepney_routes_cache = None
_all_routes_csv_cache = None


def _load_jeepney_routes() -> list:
    global _jeepney_routes_cache
    if _jeepney_routes_cache is None:
        with open(JEEPNEY_ROUTES_PATH, encoding="utf-8") as f:
            data = json.load(f)
        _jeepney_routes_cache = data.get("features", [])
    return _jeepney_routes_cache


def _load_all_routes_csv() -> list:
    global _all_routes_csv_cache
    if _all_routes_csv_cache is None:
        seen = set()
        routes = []
        with open(ALL_ROUTES_CSV_PATH, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                name = (row.get("route_long_name") or "").strip()
                if name and name.lower() not in seen:
                    seen.add(name.lower())
                    routes.append({
                        "route_id": (row.get("route_id") or "").strip(),
                        "route_name": name,
                        "agency": (row.get("agency_id") or "").strip(),
                        "route_type": (row.get("route_type") or "").strip(),
                        "description": (row.get("route_desc") or "").strip(),
                    })
        _all_routes_csv_cache = routes
    return _all_routes_csv_cache

# ==========================================
# HELPER: Optimized Virtual Node Connection
# ==========================================
def _connect_virtual_node(G, v_node, lat, lng, is_source):
    spatial_grid = G.graph.get('spatial_grid', {})
    grid_size = G.graph.get('grid_size', 0.0005)
    gx, gy = int(lat / grid_size), int(lng / grid_size)
    
    candidate_nodes = []
    for dx in [-2, -1, 0, 1, 2]:
        for dy in [-2, -1, 0, 1, 2]:
            candidate_nodes.extend(spatial_grid.get((gx + dx, gy + dy), []))
            
    candidates = []
    for node in candidate_nodes:
        node_attrs = G.nodes[node]
        dist = haversine(lat, lng, node_attrs['lat'], node_attrs['lng'])
        
        if dist < 2500:
            w_time = (dist / 1000) / SPEED_WALK_KMH * 60
            candidates.append((node, dist, w_time))
            
    if not candidates:
        print(f"⚠️ No nodes within 2.5km. Finding absolute closest node in graph...")
        min_dist = float('inf')
        closest_node = None
        
        for node, node_attrs in G.nodes(data=True):
            if node.startswith("VIRTUAL"): continue
            dist = haversine(lat, lng, node_attrs['lat'], node_attrs['lng'])
            if dist < min_dist:
                min_dist = dist
                closest_node = node
                if dist < 500: break
                
        if closest_node:
            w_time = (min_dist / 1000) / SPEED_WALK_KMH * 60
            candidates.append((closest_node, min_dist, w_time))
            print(f"🔗 Fallback connected to {closest_node} at {min_dist:.0f}m")
            
    candidates.sort(key=lambda x: x[2])

    # Connect to the top 5 closest nodes
    for node, dist, w_time in candidates[:5]:
        routing_weight = w_time  # Safely defined INSIDE the loop
        node_attrs = G.nodes[node]

        if is_source:
            direction = bearing_to_compass(lat, lng, node_attrs['lat'], node_attrs['lng'])
            G.add_edge(v_node, node, distance=dist, time_min=w_time, routing_weight=routing_weight, route="WALK_TO_TRANSIT", type="walk", direction=direction)
        else:
            direction = bearing_to_compass(node_attrs['lat'], node_attrs['lng'], lat, lng)
            G.add_edge(node, v_node, distance=dist, time_min=w_time, routing_weight=routing_weight, route="WALK_FROM_TRANSIT", type="walk", direction=direction)

# ==========================================
# HELPER: Segment Builder
# ==========================================
def _calculate_route_from_path(G: nx.DiGraph, path: list) -> RouteResponse:
    segments = []
    current_segment = None

    for j in range(len(path) - 1):
        u, v = path[j], path[j+1]
        if not G.has_edge(u, v): continue
        
        edge = G.edges[u, v]
        dist = edge.get('distance', 0.0)
        time_min = edge.get('time_min', 0.0)
        v_type = edge.get('type', 'walk')
        r_name = edge.get('route', 'Unknown')

        if not current_segment or current_segment['type'] != v_type:
            if current_segment: 
                segments.append(current_segment)
            
            u_lng = G.nodes[u].get('lng', 121.0)
            u_lat = G.nodes[u].get('lat', 14.5)
            
            current_segment = {
                'type': v_type, 
                'route': r_name, 
                'distance': 0.0, 
                'time': 0.0,
                'geometry': [[u_lng, u_lat]]
            }
        
        current_segment['distance'] += dist
        current_segment['time'] += time_min
        
        v_lng = G.nodes[v].get('lng', 121.0)
        v_lat = G.nodes[v].get('lat', 14.5)
        current_segment['geometry'].append([v_lng, v_lat])

    if current_segment: 
        segments.append(current_segment)

    steps = []
    total_dist = total_fare = total_time = 0.0

    for seg in segments:
        total_dist += seg['distance']
        total_time += seg['time']

        # Calculate fare ONCE per continuous segment (e.g. a continuous jeep
        # ride only gets ONE base fare), using the per-mode formula in
        # graph_engine.calculate_fare rather than a jeep-only hardcode.
        fare = calculate_fare(seg['type'], seg['distance'])
        total_fare += fare

        action = "walk" if seg['type'] == 'walk' else ("board" if len(steps) == 0 or steps[-1].action == "walk" else "transfer")

        direction = None
        if len(seg['geometry']) >= 2:
            (lng1, lat1), (lng2, lat2) = seg['geometry'][0], seg['geometry'][-1]
            if (lat1, lng1) != (lat2, lng2):
                direction = bearing_to_compass(lat1, lng1, lat2, lng2)

        steps.append(RouteStep(
            action=action, vehicle_type=seg['type'], route_name=seg['route'],
            from_node="start", to_node="end", distance_m=seg['distance'],
            duration_min=seg['time'], fare=fare, geometry=seg['geometry'],
            direction=direction
        ))

    message = f"{total_time:.0f} mins, ₱{total_fare:.0f}."
    first_transit_step = next((s for s in steps if s.vehicle_type != 'walk' and s.direction), None)
    if first_transit_step:
        bound = compass_to_bound(first_transit_step.direction)
        if bound:
            message = f"{total_time:.0f} mins, ₱{total_fare:.0f}. Head {bound} on {first_transit_step.route_name}."

    return RouteResponse(
        success=True, total_distance_m=total_dist, total_duration_min=total_time,
        total_fare=total_fare, steps=steps, path_nodes=path,
        message=message
    )
    
# ==========================================
# CORE ROUTING: Traffic-Aware Edge Penalty Method
# ==========================================
def find_routes_with_alternatives(G_global: nx.DiGraph, req: RouteRequest) -> tuple:
    """
    Find primary + alternative routes.
    Uses graph COPY to prevent race conditions between concurrent requests.
    """
    # STEP 0: Deep copy for thread safety (CRITICAL)
    G = G_global.copy()

    # STEP 1: Unique virtual node IDs
    unique_id = str(uuid.uuid4())[:8]
    src_id = f"VIRTUAL_SRC_{unique_id}"
    tgt_id = f"VIRTUAL_TGT_{unique_id}"
    
    G.add_node(src_id, lat=req.origin_lat, lng=req.origin_lng)
    G.add_node(tgt_id, lat=req.dest_lat, lng=req.dest_lng)
    
    try:
        _connect_virtual_node(G, src_id, req.origin_lat, req.origin_lng, is_source=True)
        _connect_virtual_node(G, tgt_id, req.dest_lat, req.dest_lng, is_source=False)
        
        if G.degree(src_id) == 0 or G.degree(tgt_id) == 0:
            print(f"❌ [ROUTING] Virtual node has no connections")
            return None, []

        # STEP 2: Find Primary Route
        try:
            path_1 = nx.shortest_path(G, source=src_id, target=tgt_id, weight='routing_weight')
        except nx.NetworkXNoPath:
            print("❌ [ROUTING] No path found")
            return None, []
            
        route_1 = _calculate_route_from_path(G, path_1)
        if not route_1 or not route_1.steps:
            return None, []
        
        print(f"✅ [ROUTING] Primary: {route_1.total_duration_min:.0f} min, ₱{route_1.total_fare:.0f}")

        # STEP 3: Find Alternative Route (Edge Penalty)
        penalized_edges = []
        for i in range(len(path_1) - 1):
            u, v = path_1[i], path_1[i+1]
            if G.has_edge(u, v):
                original_weight = G.edges[u, v].get('routing_weight', G.edges[u, v].get('time_min', 1.0))
                penalized_edges.append((u, v, original_weight))
                G.edges[u, v]['routing_weight'] = original_weight * 3.0

        route_2 = None
        try:
            path_2 = nx.shortest_path(G, source=src_id, target=tgt_id, weight='routing_weight')
            
            # Only accept if meaningfully different
            if path_2 != path_1:
                route_2 = _calculate_route_from_path(G, path_2)
                if route_2 and route_2.steps:
                    same_dist = abs(route_2.total_distance_m - route_1.total_distance_m) < 10
                    same_steps = len(route_2.steps) == len(route_1.steps)
                    if same_dist and same_steps:
                        print("⚠️ [ROUTING] Alternative too similar — discarding")
                        route_2 = None
                    else:
                        print(f"✅ [ROUTING] Alternative: {route_2.total_duration_min:.0f} min, ₱{route_2.total_fare:.0f}")
        except nx.NetworkXNoPath:
            print("⚠️ [ROUTING] No alternative found after penalty")
        finally:
            # ALWAYS restore original weights
            for u, v, orig_weight in penalized_edges:
                if G.has_edge(u, v):
                    G.edges[u, v]['routing_weight'] = orig_weight

        all_routes = [route_1]
        if route_2 and route_2.steps:
            all_routes.append(route_2)

        return all_routes[0], all_routes[1:]

    finally:
        # ALWAYS clean up virtual nodes
        if G.has_node(src_id): G.remove_node(src_id)
        if G.has_node(tgt_id): G.remove_node(tgt_id)

# ==========================================
# API ENDPOINTS
# ==========================================

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(msg: ChatMessage, request: Request):
    G = request.app.state.G

    intent_data = await parse_chat_intent_async(msg.message)
    
    # PATH A: CUSTOMER SERVICE / INFO
    if intent_data.get('intent') == 'INFO':
        ai_answer = await ask_info_llm(intent_data.get('question', msg.message))
        return ChatResponse(reply_text=ai_answer, route_data=None, origin="", destination="")

    # PATH B: ROUTING
    origin_name = intent_data.get('origin', "")
    dest_name = intent_data.get('destination', "")
    
    if not origin_name or not dest_name:
        return ChatResponse(reply_text="Saan ka pupunta?", route_data=None, origin="", destination="")

    o_coords = await geocode_location(origin_name)
    d_coords = await geocode_location(dest_name)
    
    print(f"📍 GEOCODED: Start={o_coords}, End={d_coords}")

    if not o_coords or not d_coords:
        return ChatResponse(reply_text="Hindi ko mahanap ang isa sa mga lokasyon sa mapa.", route_data=None, origin=origin_name, destination=dest_name)

    # CROWDSOURCED CHECK
    db = sqlite3.connect(DB_PATH)
    cursor = db.cursor()
    cursor.execute("""
        SELECT path_nodes, total_fare, total_time, rating_sum, trip_count 
        FROM approved_routes 
        WHERE origin = ? AND destination = ?
        ORDER BY (rating_sum * 1.0 / trip_count) DESC, trip_count DESC
        LIMIT 1
    """, (origin_name.lower(), dest_name.lower()))
    
    approved = cursor.fetchone()
    db.close()
    
    if approved:
        path_nodes_json, fare, time, rating_sum, trip_count = approved
        avg_rating = rating_sum / trip_count
        
        if avg_rating >= 5.0:
            print(f"🌟 [COMMUNITY APPROVED] Using memorized route for {origin_name} -> {dest_name}")
            path_list = json.loads(path_nodes_json)
            primary_route = _calculate_route_from_path(G, path_list)
            primary_route.message = f"🌟 Commuter Favorite ({trip_count} trips): {time:.0f} mins, ₱{fare:.0f}."
            
            return ChatResponse(
                reply_text=f"📍 {origin_name} ➡️ {dest_name}\n{primary_route.message}", 
                route_data=primary_route, alternatives=[],
                origin=origin_name, destination=dest_name
            )

    # FALLBACK: Run the routing algorithm
    print("🗺️ Calculating Primary + Alternative routes...")
    req = RouteRequest(origin_lat=o_coords[0], origin_lng=o_coords[1], dest_lat=d_coords[0], dest_lng=d_coords[1])
    primary_route, alt_routes = find_routes_with_alternatives(G, req)
    
    if not primary_route:
        return ChatResponse(reply_text="Walang nakitang ruta.", route_data=None, origin=origin_name, destination=dest_name)

    reply = f"📍 {origin_name} ➡️ {dest_name}\n✅ {primary_route.message}"
    if alt_routes:
        reply += f"\n🔄 May {len(alt_routes)} pang alternatibong ruta (tingnan sa baba)."
    
    print(f"📦 SENDING TO FRONTEND: route_data is {'NULL' if not primary_route else 'VALID'}")
    if primary_route and primary_route.steps:
        print(f"   📊 Total Steps: {len(primary_route.steps)}")
        print(f"   📏 First step geometry points: {len(primary_route.steps[0].geometry)}")
        
    return ChatResponse(
        reply_text=reply, 
        route_data=primary_route, 
        alternatives=alt_routes,
        origin=origin_name,
        destination=dest_name
    )

@router.post("/feedback")
async def submit_feedback(feedback: FeedbackRequest):
    db = sqlite3.connect(DB_PATH)
    cursor = db.cursor()
    
    cursor.execute("""
        INSERT INTO route_feedback (user_id, route_id, rating, comment, timestamp)
        VALUES (?, ?, ?, ?, datetime('now'))
    """, (feedback.user_id, feedback.route_id, feedback.rating, feedback.comment))
    
    if feedback.rating >= 6 and feedback.route_nodes and len(feedback.route_nodes) > 0:
        try:
            cursor.execute("""
                INSERT INTO approved_routes (origin, destination, path_nodes, total_fare, total_time, rating_sum, trip_count)
                VALUES (?, ?, ?, ?, ?, ?, 1)
                ON CONFLICT(origin, destination, path_nodes) 
                DO UPDATE SET 
                    rating_sum = rating_sum + excluded.rating_sum,
                    trip_count = trip_count + 1
            """, (
                feedback.origin_name.lower(), 
                feedback.destination_name.lower(), 
                json.dumps(feedback.route_nodes), 
                feedback.total_fare, 
                feedback.total_time,
                feedback.rating
            ))
            print(f"💾 [LEARNED] Saved approved route: {feedback.origin_name} -> {feedback.destination_name}")
        except Exception as e:
            print(f"⚠️ Error saving approved route: {e}")
    
    db.commit()
    db.close()
    return {"status": "success"}


@router.get("/api/v1/jeepney-routes")
async def list_jeepney_routes():
    return [
        {
            "Route_No": f["properties"]["fid"],
            "Route_Name": f["properties"].get("route_long_name"),
        }
        for f in _load_jeepney_routes()
    ]


@router.get("/api/v1/jeepney-routes/manifest")
async def jeepney_routes_manifest():
    features = _load_jeepney_routes()
    verified = [
        {
            "key": str(f["properties"]["fid"]),
            "name": f["properties"].get("route_long_name"),
            "notes": f["properties"].get("Notes") or "",
        }
        for f in features
    ]
    by_route_no = {f["properties"]["fid"]: str(f["properties"]["fid"]) for f in features}
    return {"verified": verified, "byRouteNo": by_route_no}


@router.get("/api/v1/jeepney-routes/{key}/geometry")
async def jeepney_route_geometry(key: str):
    for f in _load_jeepney_routes():
        if str(f["properties"]["fid"]) == key:
            return f
    raise HTTPException(status_code=404, detail="Route not found")


@router.get("/api/v1/jeepney-routes/all")
async def list_all_jeepney_routes():
    """The larger franchised-route catalog (name/agency/type, no GPS geometry)."""
    routes = _load_all_routes_csv()
    return {"routes": routes, "count": len(routes)}


# ==========================================
# GAS PRICES
# ==========================================

@router.get("/api/v1/gas-prices/blended")
async def gas_prices_blended():
    conn = gas_db.get_connection()
    try:
        return blend_gas_prices(conn)
    finally:
        conn.close()


@router.get("/api/v1/gas-prices/stations")
async def gas_price_stations():
    conn = gas_db.get_connection()
    try:
        stations = gas_db.get_stations(conn)
        community = gas_db.get_community_prices_by_station(conn)
        for s in stations:
            s["community_prices"] = community.get(s["id"], {})
        return stations
    finally:
        conn.close()


@router.post("/api/v1/gas-prices/stations")
async def add_gas_station(req: AddStationRequest):
    if req.brand not in GAS_BRANDS:
        raise HTTPException(status_code=400, detail={"error": f"Unknown brand '{req.brand}'"})
    if not req.name.strip():
        raise HTTPException(status_code=400, detail={"error": "Station name is required"})

    conn = gas_db.get_connection()
    try:
        station_id = gas_db.insert_station(conn, req.brand, req.name.strip(), req.address.strip(), req.lat, req.lng)
        return {
            "id": station_id, "brand": req.brand, "name": req.name.strip(),
            "address": req.address.strip(), "lat": req.lat, "lng": req.lng,
            "source": "user_added", "community_prices": {},
        }
    finally:
        conn.close()


@router.post("/api/v1/gas-prices/stations/{station_id}/submit")
async def submit_gas_price(station_id: int, req: SubmitPriceReportRequest):
    if req.fuel_type not in GAS_FUEL_TYPES:
        raise HTTPException(status_code=400, detail={"error": f"Unknown fuel type '{req.fuel_type}'"})

    conn = gas_db.get_connection()
    try:
        if not gas_db.station_exists(conn, station_id):
            raise HTTPException(status_code=404, detail={"error": "Station not found"})
        gas_db.insert_price_report(conn, station_id, req.fuel_type, req.price)
        return {"message": "Thanks for reporting! Your price helps other commuters."}
    finally:
        conn.close()
