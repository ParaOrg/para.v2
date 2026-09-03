"""
Build multi-modal transit graph from Supabase
Run this in Lambda or locally to generate the graph
"""
import json
import urllib.request
import urllib.parse
import os

def haversine(lat1, lon1, lat2, lon2):
    import math
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def build_graph_from_supabase():
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    
    graph = {}
    nodes = {}
    
    # Fetch routes
    offset = 0
    all_routes = []
    while True:
        url = f"{supabase_url}/rest/v1/ph_routes?select=route_uuid,name,mode,is_approved&limit=1000&offset={offset}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            routes = json.loads(resp.read())
        if not routes:
            break
        all_routes.extend(routes)
        offset += 1000
        if len(routes) < 1000:
            break
    
    # Fetch shapes using RPC
    url = f"{supabase_url}/rest/v1/rpc/get_route_shapes_geojson"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        shapes = json.loads(resp.read())
    
    route_map = {r["route_uuid"]: r for r in all_routes}
    
    # Build graph
    all_nodes = []
    
    for shape in shapes:
        route = route_map.get(shape["route_uuid"])
        if not route:
            continue
        
        try:
            geo = json.loads(shape["geojson"])
            if geo.get("type") != "LineString":
                continue
            coords = geo["coordinates"]
        except:
            continue
        
        if len(coords) < 2:
            continue
        
        # Sample every 3rd point
        step = 3
        sampled = [coords[i] for i in range(0, len(coords), step)]
        if coords[-1] not in sampled:
            sampled.append(coords[-1])
        
        avg_speed = 40 if route["mode"] == "rail" else 20 if route["mode"] == "bus" else 15
        
        for i in range(len(sampled)):
            coord = sampled[i]
            node_id = f"{route['route_uuid']}_pt{i}"
            
            if node_id not in nodes:
                nodes[node_id] = (coord[1], coord[0])
                all_nodes.append({"id": node_id, "lat": coord[1], "lon": coord[0]})
            
            if node_id not in graph:
                graph[node_id] = []
            
            if i > 0:
                prev_id = f"{route['route_uuid']}_pt{i-1}"
                dist_km = haversine(sampled[i-1][1], sampled[i-1][0], coord[1], coord[0])
                travel_min = max(0.1, (dist_km / avg_speed) * 60)
                weight = travel_min if route["is_approved"] else travel_min * 1.5
                
                if prev_id not in graph:
                    graph[prev_id] = []
                
                graph[prev_id].append([node_id, weight, route["name"], route["mode"]])
                graph[node_id].append([prev_id, weight, route["name"], route["mode"]])
    
    # Add transfer edges (800m)
    TRANSFER_DIST = 0.8
    all_nodes.sort(key=lambda n: n["lat"])
    
    transfer_count = 0
    for i in range(len(all_nodes)):
        for j in range(i + 1, len(all_nodes)):
            if all_nodes[j]["lat"] - all_nodes[i]["lat"] > 0.01:
                break
            dist = haversine(all_nodes[i]["lat"], all_nodes[i]["lon"], all_nodes[j]["lat"], all_nodes[j]["lon"])
            if dist < TRANSFER_DIST:
                walk_min = max(1, round(dist * 12))
                graph[all_nodes[i]["id"]].append([all_nodes[j]["id"], walk_min, "Transfer", "walk"])
                graph[all_nodes[j]["id"]].append([all_nodes[i]["id"], walk_min, "Transfer", "walk"])
                transfer_count += 1
    
    return graph, nodes, len(all_routes), len(all_nodes), len(edges), transfer_count

# For Lambda cold start - build graph once
_graph = None
_nodes = None

def get_graph():
    global _graph, _nodes
    if _graph is None:
        _graph, _nodes, *stats = build_graph_from_supabase()
    return _graph, _nodes
