"""
Surface graph builder - jeepney/bus routes only.
This is the WORKING version before rail implementation.
"""
import json
import math
import os
import urllib.request

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def build():
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    
    graph = {}
    nodes = {}
    
    # Fetch routes
    routes = []
    offset = 0
    while True:
        url = f"{supabase_url}/rest/v1/ph_routes?select=route_uuid,name,mode,is_approved&limit=1000&offset={offset}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        if not data:
            break
        routes.extend(data)
        offset += 1000
        if len(data) < 1000:
            break
    
    route_map = {r["route_uuid"]: r for r in routes}
    
    # Fetch shapes
    url = f"{supabase_url}/rest/v1/rpc/get_route_shapes_geojson"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        shapes = json.loads(resp.read())
    
    # Build surface graph
    for shape in shapes:
        route = route_map.get(shape["route_uuid"])
        if not route:
            continue
        try:
            geo = json.loads(shape["geojson"])
            coords = geo.get("coordinates", [])
        except:
            continue
        if len(coords) < 2:
            continue
        
        avg_speed = 40 if route["mode"] == "rail" else 20 if route["mode"] == "bus" else 15
        
        sampled = coords[::2]
        if sampled[-1] != coords[-1]:
            sampled.append(coords[-1])
        
        for i, coord in enumerate(sampled):
            node_id = f"{route['route_uuid']}_pt{i}"
            nodes[node_id] = [coord[1], coord[0]]
            
            if node_id not in graph:
                graph[node_id] = []
            
            if i > 0:
                prev_id = f"{route['route_uuid']}_pt{i-1}"
                dist_km = haversine(sampled[i-1][1], sampled[i-1][0], coord[1], coord[0])
                travel_min = max(0.1, round((dist_km / avg_speed) * 60, 1))
                weight = travel_min if route["is_approved"] else round(travel_min * 1.5, 1)
                
                graph[prev_id].append([node_id, weight, route["name"], route["mode"]])
                graph[node_id].append([prev_id, weight, route["name"], route["mode"]])
    
    # Transfer edges - surface only, 500m radius
    all_nodes = [[nid, coords[0], coords[1]] for nid, coords in nodes.items()]
    all_nodes.sort(key=lambda n: n[1])
    
    transfer_count = 0
    max_per_node = 5
    transfer_counts = {}
    for i in range(len(all_nodes)):
        for j in range(i+1, len(all_nodes)):
            if all_nodes[j][1] - all_nodes[i][1] > 0.005:
                break
            dist = haversine(all_nodes[i][1], all_nodes[i][2], all_nodes[j][1], all_nodes[j][2])
            if dist < 0.3:
                node_a = all_nodes[i][0]
                node_b = all_nodes[j][0]
                if transfer_counts.get(node_a, 0) >= max_per_node:
                    continue
                if transfer_counts.get(node_b, 0) >= max_per_node:
                    continue
                walk_min = max(2, round(dist * 12))
                graph[node_a].append([node_b, walk_min, "Transfer", "walk"])
                graph[node_b].append([node_a, walk_min, "Transfer", "walk"])
                transfer_counts[node_a] = transfer_counts.get(node_a, 0) + 1
                transfer_counts[node_b] = transfer_counts.get(node_b, 0) + 1
                transfer_count += 1
    
    with open("graph_data.json", "w") as f:
        json.dump({"graph": graph, "nodes": nodes}, f)
    
    print(f"Surface graph: {len(nodes)} nodes, {len(routes)} routes, {transfer_count} transfers")

if __name__ == "__main__":
    build()
