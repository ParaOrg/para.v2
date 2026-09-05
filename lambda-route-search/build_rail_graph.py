"""
Build rail graph with ADJACENT station edges only.
Lambda concatenates paths at response time for longer rides.
"""
import json
import urllib.request
import os
import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def build_rail_graph():
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    
    # Fetch rail track segments
    url = f"{supabase_url}/rest/v1/rail_network_lines?select=name,geom&limit=500"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        lines = json.loads(resp.read())
    
    # Fetch station points
    url = f"{supabase_url}/rest/v1/rail_station_points?select=name,geom&limit=200"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as resp:
        stations = json.loads(resp.read())
    
    # Group track coords by line
    line_coords = {}
    for line in lines:
        name = line.get("name") or "Rail"
        geom = line.get("geom")
        if isinstance(geom, dict) and geom.get("coordinates"):
            if name not in line_coords:
                line_coords[name] = []
            line_coords[name].extend(geom["coordinates"])
    
    # Extract station locations
    station_locations = {}
    for station in stations:
        geom = station.get("geom")
        if isinstance(geom, dict) and geom.get("coordinates"):
            lng, lat = geom["coordinates"][0], geom["coordinates"][1]
            station_locations[station["name"]] = (lat, lng)
    
    rail_graph = {}
    rail_nodes = {}
    
    # Process each line - ADJACENT stations only
    for line_name, all_coords in line_coords.items():
        if len(all_coords) < 2:
            continue
        
        # Find stations on this line
        line_stations = []
        for station_name, (lat, lng) in station_locations.items():
            for i, coord in enumerate(all_coords):
                if haversine(lat, lng, coord[1], coord[0]) < 0.5:
                    line_stations.append({"name": station_name, "idx": i, "lat": lat, "lng": lng})
                    break
        
        line_stations.sort(key=lambda s: s["idx"])
        
        # Remove duplicate station names
        unique = []
        seen = set()
        for s in line_stations:
            if s["name"] not in seen:
                seen.add(s["name"])
                unique.append(s)
        line_stations = unique
        
        if len(line_stations) < 2:
            continue
        
        # ADJACENT only - i to i+1
        for i in range(len(line_stations) - 1):
            from_s = line_stations[i]
            to_s = line_stations[i+1]
            
            from_id = f"rail_{line_name}_{from_s['name']}"
            to_id = f"rail_{line_name}_{to_s['name']}"
            
            if from_id not in rail_nodes:
                rail_nodes[from_id] = [from_s["lat"], from_s["lng"]]
            if to_id not in rail_nodes:
                rail_nodes[to_id] = [to_s["lat"], to_s["lng"]]
            
            # Extract path between adjacent stations
            path_coords = all_coords[from_s["idx"]:to_s["idx"]+1]
            if len(path_coords) < 2:
                path_coords = [[from_s["lng"], from_s["lat"]], [to_s["lng"], to_s["lat"]]]
            
            path = [[c[1], c[0]] for c in path_coords]
            
            total_dist = sum(
                haversine(path[k][0], path[k][1], path[k+1][0], path[k+1][1])
                for k in range(len(path)-1)
            )
            travel_min = max(1.0, round((total_dist / 40) * 60, 1))
            
            if from_id not in rail_graph:
                rail_graph[from_id] = []
            if to_id not in rail_graph:
                rail_graph[to_id] = []
            
            rail_graph[from_id].append([to_id, travel_min, line_name, "rail", path])
            rail_graph[to_id].append([from_id, travel_min, line_name, "rail", list(reversed(path))])
    
    return rail_graph, rail_nodes

if __name__ == "__main__":
    graph, nodes = build_rail_graph()
    print(f"Rail graph: {len(nodes)} station nodes")
    total_edges = sum(len(v) for v in graph.values())
    print(f"Total edges (adjacent only): {total_edges}")
    
    # Show sample
    for n in list(nodes.keys())[:5]:
        edges = graph.get(n, [])
        print(f"  {n} → {len(edges)} connections")
    
    with open("rail_graph.json", "w") as f:
        json.dump({"graph": graph, "nodes": nodes}, f)
    print("Saved rail_graph.json")
