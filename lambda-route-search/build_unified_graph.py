"""
UNIFIED graph: surface (jeepney/bus) + rail (LRT/MRT) with KDTree transfers.
One graph, all modes, seamless routing.
"""
import json
import math
import os
import urllib.request
import numpy as np
from scipy.spatial import KDTree

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
    edge_paths = {}
    
    # ========== SURFACE GRAPH ==========
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
    
    url = f"{supabase_url}/rest/v1/rpc/get_route_shapes_geojson"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        shapes = json.loads(resp.read())
    
    surface_node_coords = []
    surface_node_ids = []
    
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
        
        avg_speed = 20 if route["mode"] == "bus" else 15
        sampled = coords[::3]
        if sampled[-1] != coords[-1]:
            sampled.append(coords[-1])
        
        for i, coord in enumerate(sampled):
            node_id = f"{route['route_uuid']}_pt{i}"
            nodes[node_id] = [coord[1], coord[0]]
            surface_node_coords.append([coord[1], coord[0]])
            surface_node_ids.append(node_id)
            
            if node_id not in graph:
                graph[node_id] = []
            
            if i > 0:
                prev_id = f"{route['route_uuid']}_pt{i-1}"
                dist_km = haversine(sampled[i-1][1], sampled[i-1][0], coord[1], coord[0])
                travel_min = max(0.1, round((dist_km / avg_speed) * 60, 1))
                weight = travel_min if route["is_approved"] else round(travel_min * 1.5, 1)
                graph[prev_id].append([node_id, weight, route["name"], route["mode"]])
                graph[node_id].append([prev_id, weight, route["name"], route["mode"]])
    
    # ========== RAIL GRAPH ==========
    url = f"{supabase_url}/rest/v1/rail_network_lines?select=name,geom&limit=500"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        rail_lines = json.loads(resp.read())
    
    url = f"{supabase_url}/rest/v1/rail_station_points?select=name,geom&limit=200"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as resp:
        rail_stations = json.loads(resp.read())
    
    line_coords = {}
    for line in rail_lines:
        name = line.get("name") or "Rail"
        geom = line.get("geom")
        if isinstance(geom, dict) and geom.get("coordinates"):
            if name not in line_coords:
                line_coords[name] = []
            line_coords[name].extend(geom["coordinates"])
    
    station_locations = {}
    for station in rail_stations:
        geom = station.get("geom")
        if isinstance(geom, dict) and geom.get("coordinates"):
            lng, lat = geom["coordinates"][0], geom["coordinates"][1]
            station_locations[station["name"]] = (lat, lng)
    
    rail_node_ids = []
    rail_coords_list = []
    
    for line_name, all_coords in line_coords.items():
        if len(all_coords) < 2:
            continue
        
        line_stations = []
        for station_name, (lat, lng) in station_locations.items():
            for i, coord in enumerate(all_coords):
                if haversine(lat, lng, coord[1], coord[0]) < 0.5:
                    line_stations.append({"name": station_name, "idx": i, "lat": lat, "lng": lng})
                    break
        
        line_stations.sort(key=lambda s: s["idx"])
        unique = []
        seen = set()
        for s in line_stations:
            if s["name"] not in seen:
                seen.add(s["name"])
                unique.append(s)
        line_stations = unique
        
        # ADJACENT rail edges
        for i in range(len(line_stations) - 1):
            from_s = line_stations[i]
            to_s = line_stations[i+1]
            
            from_id = f"rail_{line_name}_{from_s['name']}"
            to_id = f"rail_{line_name}_{to_s['name']}"
            
            nodes[from_id] = [from_s["lat"], from_s["lng"]]
            nodes[to_id] = [to_s["lat"], to_s["lng"]]
            rail_node_ids.append(from_id)
            rail_node_ids.append(to_id)
            rail_coords_list.append([from_s["lat"], from_s["lng"]])
            rail_coords_list.append([to_s["lat"], to_s["lng"]])
            
            path_coords = all_coords[from_s["idx"]:to_s["idx"]+1]
            path = [[c[1], c[0]] for c in path_coords]
            
            total_dist = sum(
                haversine(path[k][0], path[k][1], path[k+1][0], path[k+1][1])
                for k in range(len(path)-1)
            )
            travel_min = max(1.0, round((total_dist / 40) * 60, 1))
            
            if from_id not in graph:
                graph[from_id] = []
            if to_id not in graph:
                graph[to_id] = []
            graph[from_id].append([to_id, travel_min, line_name, "rail"])
            graph[to_id].append([from_id, travel_min, line_name, "rail"])
            
            edge_paths[f"{from_id}->{to_id}"] = path
            edge_paths[f"{to_id}->{from_id}"] = list(reversed(path))
    
    # ========== KDTree TRANSFERS (rail <-> surface) ==========
    if surface_node_coords and rail_coords_list:
        surface_tree = KDTree(np.array(surface_node_coords))
        rail_coords_arr = np.array(rail_coords_list)
        
        transfer_count = 0
        MAX_TRANSFERS = 5
        # Use 1km radius for transfers (0.01 degrees approx)
        for i, rail_coord in enumerate(rail_coords_arr):
            dists, idxs = surface_tree.query(rail_coord, k=MAX_TRANSFERS, distance_upper_bound=0.01)
            for dist, idx in zip(dists, idxs):
                if idx >= len(surface_node_ids):
                    continue
                rail_nid = rail_node_ids[i]
                surface_nid = surface_node_ids[idx]
                walk_min = max(3, round(dist * 111 * 60))
                
                if rail_nid not in graph:
                    graph[rail_nid] = []
                if surface_nid not in graph:
                    graph[surface_nid] = []
                graph[rail_nid].append([surface_nid, walk_min, "Transfer", "walk"])
                graph[surface_nid].append([rail_nid, walk_min, "Transfer", "walk"])
                transfer_count += 1
        
        print(f"✅ Unified graph: {len(nodes)} nodes, {transfer_count} rail-surface transfers")
    
    with open("graph_data.json", "w") as f:
        json.dump({"graph": graph, "nodes": nodes, "edge_paths": edge_paths}, f)

if __name__ == "__main__":
    build()
