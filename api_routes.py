from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
import networkx as nx
import os
import sqlite3

from models import RouteRequest, RouteResponse, RouteStep, FeedbackRequest
from graph_engine import haversine

router = APIRouter()

@router.get("/")
def serve_frontend():
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return {"error": "index.html not found."}

@router.post("/route", response_model=RouteResponse)
def get_route(req: RouteRequest, request: Request):
    # Access the graph from the app state
    G = request.app.state.transit_graph
    all_nodes = request.app.state.all_nodes
    
    if G.number_of_nodes() == 0:
        raise HTTPException(status_code=500, detail="Graph is empty.")

    # Find closest nodes to user's start/end
    start_candidates = sorted([(haversine(req.start_lat, req.start_lng, lat, lon), nid) for nid, (lat, lon) in all_nodes.items()], key=lambda x: x[0])
    end_candidates = sorted([(haversine(req.end_lat, req.end_lng, lat, lon), nid) for nid, (lat, lon) in all_nodes.items()], key=lambda x: x[0])

    SOURCE, TARGET = "VIRTUAL_SOURCE", "VIRTUAL_TARGET"
    G_req = G.copy() # Copy graph to safely add virtual walking nodes per request
    G_req.add_node(SOURCE, lat=req.start_lat, lon=req.start_lng)
    G_req.add_node(TARGET, lat=req.end_lat, lon=req.end_lng)

    MAX_WALK_M = 1000.0
    for dist, node_id in start_candidates[:10]:
        if dist <= MAX_WALK_M:
            walk_time = (dist / 1000.0) / 4.0 * 60.0
            G_req.add_edge(SOURCE, node_id, weight=walk_time, distance=dist, route_name="Walk to Stop", edge_type="walk")
            
    for dist, node_id in end_candidates[:10]:
        if dist <= MAX_WALK_M:
            walk_time = (dist / 1000.0) / 4.0 * 60.0
            G_req.add_edge(node_id, TARGET, weight=walk_time, distance=dist, route_name="Walk to Dest", edge_type="walk")

    if G_req.out_degree(SOURCE) == 0 or G_req.in_degree(TARGET) == 0:
        raise HTTPException(status_code=404, detail="Locations too far from transit network.")

    try:
        path = nx.shortest_path(G_req, source=SOURCE, target=TARGET, weight="weight")
    except nx.NetworkXNoPath:
        raise HTTPException(status_code=404, detail="No connected route found.")

    # Reconstruct steps
    steps = []
    current_step = None

    for i in range(len(path) - 1):
        u, v = path[i], path[i+1]
        edge = G_req.edges[u, v]
        e_type = edge.get("edge_type", "ride")
        r_name = edge.get("route_name", "Unknown")
        dist = edge.get("distance", 0)
        time_mins = edge.get("weight", 0)
        u_data, v_data = G_req.nodes[u], G_req.nodes[v]

        if current_step and current_step["route_name"] == r_name and current_step["edge_type"] == e_type:
            current_step["distance"] += dist
            current_step["time"] += time_mins
            current_step["polyline"].append([v_data["lat"], v_data["lon"]])
        else:
            if current_step: steps.append(current_step)
            current_step = {
                "route_name": r_name, "edge_type": e_type, "distance": dist, "time": time_mins,
                "polyline": [[u_data["lat"], u_data["lon"]], [v_data["lat"], v_data["lon"]]]
            }
            
    if current_step: steps.append(current_step)

    # Format response
    formatted_steps = []
    total_dist, total_time, total_fare = 0, 0, 0

    for s in steps:
        dist_km = s["distance"] / 1000.0
        total_dist += dist_km
        total_time += s["time"]
        fare = 15.0 + max(0.0, (dist_km - 4.0)) * 2.5 if s["edge_type"] == "ride" else 0.0
        if s["edge_type"] == "ride": total_fare += fare

        formatted_steps.append(RouteStep(
            route_name=s["route_name"], mode=s["edge_type"],
            from_lat=s["polyline"][0][0], from_lng=s["polyline"][0][1],
            to_lat=s["polyline"][-1][0], to_lng=s["polyline"][-1][1],
            distance_km=round(dist_km, 2), time_mins=round(s["time"], 1),
            fare=round(fare, 2), polyline=s["polyline"]
        ))

    return RouteResponse(
        total_fare=round(total_fare, 2), total_time_mins=round(total_time, 1),
        total_distance_km=round(total_dist, 2), steps=formatted_steps
    )

@router.post("/feedback")
def submit_feedback(req: FeedbackRequest):
    try:
        conn = sqlite3.connect("para_ml_data.db")
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO route_feedback 
            (start_lat, start_lng, end_lat, end_lng, suggested_steps, estimated_time, estimated_fare, is_approved)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (req.start_lat, req.start_lng, req.end_lat, req.end_lng, req.suggested_steps, req.estimated_time, req.estimated_fare, req.is_approved))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Feedback recorded."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")