import sqlite3
import json
import networkx as nx
import uuid
from fastapi import APIRouter, Request
from models import RouteRequest, RouteResponse, RouteStep, ChatMessage, ChatResponse, FeedbackRequest
from graph_engine import haversine, SPEED_WALK_KMH
from llm_engine import parse_chat_intent_async, ask_info_llm, geocode_location

router = APIRouter()

# ==========================================
# HELPER: Optimized Virtual Node Connection
# ==========================================
def _connect_virtual_node(G, v_node, lat, lng, is_source):
    spatial_grid = G.graph.get('spatial_grid', {})
    grid_size = G.graph.get('grid_size', 0.0005)
    gx, gy = int(lat / grid_size), int(lng / grid_size)
    
    candidate_nodes = []
    # Expand search to 5x5 grid to cover a wider area
    for dx in [-2, -1, 0, 1, 2]:
        for dy in [-2, -1, 0, 1, 2]:
            candidate_nodes.extend(spatial_grid.get((gx + dx, gy + dy), []))
            
    candidates = []
    for node in candidate_nodes:
        node_attrs = G.nodes[node]
        dist = haversine(lat, lng, node_attrs['lat'], node_attrs['lng'])
        
        if dist < 2500:  # 2.5km max walk for large campuses/malls
            w_time = (dist / 1000) / SPEED_WALK_KMH * 60
            candidates.append((node, dist, w_time))
            
    # FALLBACK: If absolutely no nodes are found within 2.5km, find the single closest node in the entire graph
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
                if dist < 500: break # Early exit if we find something reasonably close
                
        if closest_node:
            w_time = (min_dist / 1000) / SPEED_WALK_KMH * 60
            candidates.append((closest_node, min_dist, w_time))
            print(f"🔗 Fallback connected to {closest_node} at {min_dist:.0f}m")
            
    candidates.sort(key=lambda x: x[2])
    
    # Connect to the top 5 closest nodes
    for node, dist, w_time in candidates[:5]:
        routing_weight = w_time  # Safely defined INSIDE the loop
        
        if is_source:
            G.add_edge(v_node, node, distance=dist, time_min=w_time, routing_weight=routing_weight, route="WALK_TO_TRANSIT", type="walk")
        else:
            G.add_edge(node, v_node, distance=dist, time_min=w_time, routing_weight=routing_weight, route="WALK_FROM_TRANSIT", type="walk")
    
    # Connect to the top 5 closest nodes
    for node, dist, walk_time in candidates[:5]:
        if is_source:
            G.add_edge(v_node, node, distance=dist, time_min=walk_time, route="WALK_TO_TRANSIT", type="walk")
        else:
            G.add_edge(node, v_node, distance=dist, time_min=walk_time, route="WALK_FROM_TRANSIT", type="walk")

# ==========================================
# HELPER: Segment Builder (Fixes the "Expensive Fare" bug)
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

        # FIX: Only start a new segment if the VEHICLE TYPE changes (e.g., jeep -> walk -> jeep).
        # Consecutive 'jeep' edges are grouped together to prevent charging the base fare multiple times!
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
        
        # FIX: Calculate fare ONCE per continuous segment. 
        # If it's a continuous jeep ride, it only gets ONE ₱13 base fare.
        fare = 13.0 + max(0, (seg['distance'] / 1000 - 4)) * 2.5 if seg['type'] == 'jeep' else 0.0
        total_fare += fare
        
        action = "walk" if seg['type'] == 'walk' else ("board" if len(steps) == 0 or steps[-1].action == "walk" else "transfer")
        
        steps.append(RouteStep(
            action=action, vehicle_type=seg['type'], route_name=seg['route'],
            from_node="start", to_node="end", distance_m=seg['distance'],
            duration_min=seg['time'], fare=fare, geometry=seg['geometry']
        ))
        
    return RouteResponse(
        success=True, total_distance_m=total_dist, total_duration_min=total_time, 
        total_fare=total_fare, steps=steps, path_nodes=path,
        message=f"{total_time:.0f} mins, ₱{total_fare:.0f}."
    )
    
# ==========================================
# CORE ROUTING: Edge Penalty Method (Fast & Guaranteed Alternatives)
# ==========================================
def find_routes_with_alternatives(G: nx.DiGraph, req: RouteRequest) -> tuple:
    # FIX: Generate a unique ID for every single request to prevent race conditions
    unique_id = str(uuid.uuid4())[:8] 
    src_id = f"VIRTUAL_SRC_{unique_id}"
    tgt_id = f"VIRTUAL_TGT_{unique_id}"
    
    G.add_node(src_id, lat=req.origin_lat, lng=req.origin_lng)
    G.add_node(tgt_id, lat=req.dest_lat, lng=req.dest_lng)
    
    try:
        _connect_virtual_node(G, src_id, req.origin_lat, req.origin_lng, is_source=True)
        _connect_virtual_node(G, tgt_id, req.dest_lat, req.dest_lng, is_source=False)
        
        if G.degree(src_id) == 0 or G.degree(tgt_id) == 0: return None, []

        # 1. Find Primary Route
        try:
            path_1 = nx.shortest_path(G, source=src_id, target=tgt_id, weight='routing_weight')
        except nx.NetworkXNoPath:
            return None, []
            
        route_1 = _calculate_route_from_path(G, path_1)
        if not route_1: return None, []

        # 2. Find Alternative Route using EDGE PENALTY
        penalized_edges = []
        for i in range(len(path_1) - 1):
            u, v = path_1[i], path_1[i+1]
            original_weight = G.edges[u, v].get('routing_weight', G.edges[u, v].get('time_min', 1.0))
            penalized_edges.append((u, v, original_weight))
            G.edges[u, v]['routing_weight'] = original_weight * 3.0

        try:
            path_2 = nx.shortest_path(G, source=src_id, target=tgt_id, weight='routing_weight')
            route_2 = _calculate_route_from_path(G, path_2)
        except nx.NetworkXNoPath:
            route_2 = None
        finally:
            for u, v, orig_weight in penalized_edges:
                G.edges[u, v]['routing_weight'] = orig_weight

        all_routes = [route_1]
        if route_2 and route_2.steps:
            if route_2.total_distance_m != route_1.total_distance_m or len(route_2.steps) != len(route_1.steps):
                all_routes.append(route_2)

        return all_routes[0], all_routes[1:]

    finally:
        # FIX: Safely remove only THIS request's unique nodes
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
    
    # DIAGNOSTIC: See the exact coordinates
    print(f"📍 GEOCODED: Start={o_coords}, End={d_coords}")

    if not o_coords or not d_coords:
        return ChatResponse(reply_text="Hindi ko mahanap ang isa sa mga lokasyon sa mapa.", route_data=None, origin=origin_name, destination=dest_name)

    # CROWDSOURCED CHECK
    db = sqlite3.connect("para_ml_data.db")
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

    # FALLBACK: Run the Math (Edge Penalty Method)
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
        
    # HERE IS THE RETURN CHATRESPONSE:
    return ChatResponse(
        reply_text=reply, 
        route_data=primary_route, 
        alternatives=alt_routes,
        origin=origin_name,
        destination=dest_name
    )

@router.post("/feedback")
async def submit_feedback(feedback: FeedbackRequest):
    db = sqlite3.connect("para_ml_data.db")
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