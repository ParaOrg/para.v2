import sqlite3
import networkx as nx
from fastapi import APIRouter, Request
from models import RouteRequest, RouteResponse, RouteStep, ChatMessage, ChatResponse, FeedbackRequest
from graph_engine import haversine, SPEED_WALK_KMH
from llm_engine import parse_user_intent_async, geocode_location

router = APIRouter()

# --- Core Routing Logic ---
def find_route(G: nx.DiGraph, req: RouteRequest) -> RouteResponse:
    src_id = "VIRTUAL_SRC"
    tgt_id = "VIRTUAL_TGT"
    
    G.add_node(src_id, lat=req.origin_lat, lng=req.origin_lng)
    G.add_node(tgt_id, lat=req.dest_lat, lng=req.dest_lng)
    
    try:
        _connect_virtual_node(G, src_id, req.origin_lat, req.origin_lng, is_source=True)
        _connect_virtual_node(G, tgt_id, req.dest_lat, req.dest_lng, is_source=False)
        
        # DIAGNOSTIC: See how many nodes the virtual points actually connected to
        src_connections = G.degree(src_id)
        tgt_connections = G.degree(tgt_id)
        print(f"🔗 VIRTUAL SRC connected to {src_connections} transit nodes.")
        print(f"🔗 VIRTUAL TGT connected to {tgt_connections} transit nodes.")
        
        if src_connections == 0 or tgt_connections == 0:
            return RouteResponse(success=False, total_distance_m=0, total_duration_min=0, total_fare=0, steps=[], message="No transit nodes found within 1km of your locations. The map data might not cover this area.")

        path = nx.shortest_path(G, source=src_id, target=tgt_id, weight='time_min')
        
        # DIAGNOSTIC: See the actual path it found
        print(f"🛣️ PATH FOUND: {len(path)} nodes. First 5 nodes: {path[:5]}")
        
        steps = []
        total_dist = 0.0
        total_fare = 0.0
        total_time = 0.0
        
        for i in range(len(path) - 1):
            u, v = path[i], path[i+1]
            edge_data = G.edges[u, v]
            dist = edge_data['distance']
            time_min = edge_data['time_min']
            
            total_dist += dist
            total_time += time_min
            
            if edge_data['type'] == 'jeep':
                fare = 15.0 + max(0, (dist / 1000 - 4)) * 2.5
                total_fare += fare
            else:
                fare = 0.0
                
            steps.append(RouteStep(
                action="board" if edge_data['type'] != 'walk' else "walk",
                vehicle_type=edge_data['type'],
                route_name=edge_data.get('route', 'Unknown'),
                from_node=u,
                to_node=v,
                distance_m=dist,
                duration_min=time_min,
                fare=fare,
                geometry=[[G.nodes[u]['lng'], G.nodes[u]['lat']], [G.nodes[v]['lng'], G.nodes[v]['lat']]]
            ))
            
        return RouteResponse(
            success=True,
            total_distance_m=total_dist,
            total_duration_min=total_time,
            total_fare=total_fare,
            steps=steps,
            message=f"Route found! {total_time:.0f} mins, ₱{total_fare:.0f}."
        )
    except nx.NetworkXNoPath:
        return RouteResponse(success=False, total_distance_m=0, total_duration_min=0, total_fare=0, steps=[], message="No path found. The locations might not be connected.")
    finally:
        if G.has_node(src_id): G.remove_node(src_id)
        if G.has_node(tgt_id): G.remove_node(tgt_id)

def _connect_virtual_node(G, v_node, lat, lng, is_source):
    candidates = []
    for node, node_attrs in G.nodes(data=True): 
        if node.startswith("VIRTUAL"): continue
        dist = haversine(lat, lng, node_attrs['lat'], node_attrs['lng'])
        
        if dist < 1000:  
            walk_time_min = (dist / 1000) / SPEED_WALK_KMH * 60
            candidates.append((node, dist, walk_time_min))
            
    candidates.sort(key=lambda x: x[2])
    
    for node, dist, walk_time in candidates[:10]:
        if is_source:
            G.add_edge(v_node, node, distance=dist, time_min=walk_time, route="WALK_TO_TRANSIT", type="walk")
        else:
            G.add_edge(node, v_node, distance=dist, time_min=walk_time, route="WALK_FROM_TRANSIT", type="walk")

# --- API Endpoints ---
@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(msg: ChatMessage, request: Request):
    G = request.app.state.G
    
    print(f"\n{'='*60}")
    print(f"📩 RAW MESSAGE: {msg.message}")
    
    intent = await parse_user_intent_async(msg.message)
    print(f"🧠 EXTRACTED: Origin='{intent['origin']}', Dest='{intent['destination']}'")
    
    o_coords = geocode_location(intent['origin'])
    d_coords = geocode_location(intent['destination'])
    print(f"📍 GEOCODED: Start={o_coords}, End={d_coords}")
    
    # DIAGNOSTIC: Calculate straight-line distance between start and end
    if o_coords and d_coords:
        straight_dist = haversine(o_coords[0], o_coords[1], d_coords[0], d_coords[1])
        print(f"📏 STRAIGHT LINE DISTANCE: {straight_dist:.0f} meters")
    
    if not o_coords or not d_coords:
        return ChatResponse(reply_text="Hindi ko mahanap ang lokasyon.", route_data=None)

    req = RouteRequest(origin_lat=o_coords[0], origin_lng=o_coords[1], dest_lat=d_coords[0], dest_lng=d_coords[1])
    route_res = find_route(G, req)
    
    reply = f"📍 Start: {intent['origin']}\n🏁 End: {intent['destination']}\n\n{route_res.message}"
    print(f"{'='*60}\n")
    
    return ChatResponse(reply_text=reply, route_data=route_res)

@router.post("/feedback")
async def submit_feedback(feedback: FeedbackRequest):
    db = sqlite3.connect("para_ml_data.db")
    cursor = db.cursor()
    cursor.execute("""
        INSERT INTO route_feedback (user_id, route_id, rating, comment, timestamp)
        VALUES (?, ?, ?, ?, datetime('now'))
    """, (feedback.user_id, feedback.route_id, feedback.rating, feedback.comment))
    db.commit()
    db.close()
    return {"status": "success"}