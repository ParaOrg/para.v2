import json
import gzip
import math
import heapq
import os
import urllib.request
import urllib.parse

# Global cache
_graph = None
_nodes = None
_route_info = {}

def load_graph_from_supabase():
    """Load RICH graph from Supabase - routes + shapes + ML stats + fares"""
    supabase_url = os.environ.get("SUPABASE_URL", "https://tcvomrkytxnetzijwqad.supabase.co").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    
    if not service_key:
        service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdm9tcmt5dHhuZXR6aWp3cWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzY3NDgsImV4cCI6MjA3MzAxMjc0OH0.ljYfw72N5dm4GsM1yKvV4bNNb8sWEoErTD3TrGz1s0o"
    
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}"
    }
    
    graph = {}
    nodes = {}
    route_info = {}  # node_id -> {name, mode, reliability, fare}
    
    # 1. Get ALL routes with ML stats
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
    
    # 2. Get ML stats for reliability/speed
    try:
        url = f"{supabase_url}/rest/v1/route_ml_stats?select=route_uuid,avg_speed_kmh,reliability_score,avg_fare&limit=5000"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            ml_stats = {s["route_uuid"]: s for s in json.loads(resp.read())}
    except:
        ml_stats = {}
    
    # 3. Load ALL graph edges with proper pagination
    offset = 0
    edges_loaded = 0
    while True:
        url = f"{supabase_url}/rest/v1/graph_edges?select=from_node,to_node,weight&limit=1000&offset={offset}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            edges = json.loads(resp.read())
        if not edges:
            break
        edges_loaded += len(edges)
        for edge in edges:
            if edge["from_node"] not in graph:
                graph[edge["from_node"]] = []
            graph[edge["from_node"]].append([edge["to_node"], edge["weight"]])
        offset += 1000
        if len(edges) < 1000:
            break
    print(f"Loaded {edges_loaded} edges")
    
    # 4. Get nodes
    offset = 0
    while True:
        url = f"{supabase_url}/rest/v1/graph_nodes?select=node_id,lat,lon&limit=1000&offset={offset}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            nodes_data = json.loads(resp.read())
        if not nodes_data:
            break
        for node in nodes_data:
            nodes[node["node_id"]] = (node["lat"], node["lon"])
        offset += 1000
        if len(nodes_data) < 1000:
            break
    
    # 5. Build route_info from node IDs (extract route_uuid)
    import re
    for node_id in nodes:
        match = re.match(r'(.+)_(start|end)', node_id)
        if match:
            route_uuid = match.group(1)
            for route in all_routes:
                if route["route_uuid"] == route_uuid:
                    ml = ml_stats.get(route_uuid, {})
                    route_info[node_id] = {
                        "name": route.get("name", "Unknown"),
                        "mode": route.get("mode", "transit"),
                        "is_approved": route.get("is_approved", False),
                        "reliability": ml.get("reliability_score", 0.5),
                        "avg_speed": ml.get("avg_speed_kmh", 15),
                        "avg_fare": ml.get("avg_fare", 0),
                    }
                    break
    
    return graph, nodes, route_info

def load_graph():
    """Load graph with fallback to static file"""
    global _graph, _nodes, _route_info
    if _graph is None:
        try:
            _graph, _nodes, _route_info = load_graph_from_supabase()
            print(f"SUPABASE GRAPH LOADED: {len(_graph)} edges, {len(_nodes)} nodes, {len(_route_info)} route info")
        except Exception as e:
            print(f"SUPABASE LOAD FAILED: {type(e).__name__}: {e}")
            print("Falling back to static file...")
            with gzip.open("graph_full_rail.json.gz", "rt") as f:
                data = json.load(f)
            _graph = data.get("adj", {})
            _nodes = data.get("nodes", {})
            _route_info = {}
            print(f"STATIC GRAPH LOADED: {len(_graph)} edges, {len(_nodes)} nodes")
    return _graph, _nodes

def haversine(lat1, lon1, lat2, lon2):
    """Distance in km between two coordinates"""
    R = 6371
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def geocode_place(place_name):
    """Geocode using Supabase ph_places first, then Nominatim, then save"""
    supabase_url = os.environ.get("SUPABASE_URL", "https://tcvomrkytxnetzijwqad.supabase.co")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    
    # Step 1: Check Supabase ph_places
    try:
        url = f"{supabase_url}/rest/v1/ph_places?canonical_name=ilike.*{urllib.parse.quote(place_name)}*&select=canonical_name,location&limit=1"
        req = urllib.request.Request(url, headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}"
        })
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read())
        
        if data:
            loc = data[0].get("location")
            if isinstance(loc, str):
                import re
                m = re.search(r'POINT\(([-\d.]+) ([-\d.]+)\)', loc)
                if m:
                    return {"name": data[0]["canonical_name"], "lat": float(m.group(2)), "lng": float(m.group(1))}
            elif isinstance(loc, dict):
                return {"name": data[0]["canonical_name"], "lat": loc.get("lat"), "lng": loc.get("lng")}
    except:
        pass
    
    # Step 2: Nominatim
    try:
        query = f"{place_name}, Metro Manila, Philippines"
        url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(query)}&format=json&limit=1"
        req = urllib.request.Request(url, headers={'User-Agent': 'ParaPH/1.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        
        if data:
            result = {
                "name": data[0].get("display_name", place_name).split(',')[0],
                "lat": float(data[0]["lat"]),
                "lng": float(data[0]["lon"])
            }
            # Step 3: Save to Supabase
            try:
                payload = json.dumps({
                    "canonical_name": place_name.title(),
                    "category": "auto_geocoded",
                    "location": f"POINT({result['lng']} {result['lat']})"
                })
                save_url = f"{supabase_url}/rest/v1/ph_places"
                save_req = urllib.request.Request(save_url, data=payload.encode(), headers={
                    "apikey": service_key,
                    "Authorization": f"Bearer {service_key}",
                    "Content-Type": "application/json"
                })
                urllib.request.urlopen(save_req, timeout=3)
            except:
                pass
            return result
    except:
        pass
    
    return None

def find_nearest_node(lat, lng, graph_nodes, max_dist_km=10.0):
    """Find nearest node from graph_nodes dict"""
    nearest = None
    min_dist = float('inf')
    
    for node_id, coords in graph_nodes.items():
        dist = haversine(lat, lng, coords[0], coords[1])
        if dist < min_dist and dist <= max_dist_km:
            min_dist = dist
            nearest = node_id
    
    return nearest, min_dist

def dijkstra(graph, start, end, max_time_min=200):
    """Dijkstra with ML-informed weights (reliability + verification)"""
    if start not in graph or end not in graph:
        return None
    
    dist = {start: 0}
    prev = {}
    pq = [(0, start)]
    visited = set()
    
    while pq:
        d, u = heapq.heappop(pq)
        
        if u in visited:
            continue
        visited.add(u)
        
        if u == end:
            break
        
        if d > max_time_min:
            continue
        
        for v, base_w in graph.get(u, []):
            # Apply ML weight: unreliable routes cost more
            info = _route_info.get(u, {})
            reliability = info.get('reliability', 0.5)
            is_verified = info.get('is_approved', False)
            
            # Weight formula: base_time × (1/reliability) × verification_penalty
            reliability_factor = 1.0 / max(reliability, 0.2)
            verification_penalty = 1.0 if is_verified else 1.3
            
            w = base_w * reliability_factor * verification_penalty
            
            nd = d + w
            if v not in dist or nd < dist[v]:
                dist[v] = nd
                prev[v] = u
                heapq.heappush(pq, (nd, v))
    
    if end not in prev and start != end:
        return None
    
    path = []
    u = end
    while u is not None:
        path.append(u)
        u = prev.get(u)
    return path[::-1]

def lambda_handler(event, context):
    """Main handler"""
    try:
        # Parse event
        if 'body' in event and isinstance(event['body'], str):
            event = json.loads(event['body'])
        
        message = event.get('message', '').lower()
        user_location = event.get('user_location', {})
        user_lat = user_location.get('lat')
        user_lng = user_location.get('lng')
        
        if not user_lat or not user_lng:
            return {
                'statusCode': 200,
                'body': json.dumps({'status': 'error', 'message': 'No location provided'})
            }
        
        # Extract destination from "to X"
        dest_text = message.split(' to ')[-1].strip() if ' to ' in message else message
        dest_result = geocode_place(dest_text)
        
        if not dest_result:
            return {
                'statusCode': 200,
                'body': json.dumps({'status': 'error', 'message': f'Cannot find location: {dest_text}'})
            }
        
        dest_lat = dest_result['lat']
        dest_lng = dest_result['lng']
        dest_name = dest_result['name']
        
        # Load graph
        graph, nodes = load_graph()
        
        # Find nearest nodes
        start_node, start_dist = find_nearest_node(user_lat, user_lng, nodes, 10.0)
        end_node, end_dist = find_nearest_node(dest_lat, dest_lng, nodes, 10.0)
        
        if not start_node or not end_node:
            # No transit nearby, return walking
            distance_km = haversine(user_lat, user_lng, dest_lat, dest_lng)
            walk_min = round(distance_km * 12, 1)
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'status': 'success',
                    'route_data': {
                        'total_time_min': walk_min,
                        'segments': [{
                            'type': 'walk',
                            'route': f'Walk to {dest_name}',
                            'time_min': walk_min,
                            'distance_km': round(distance_km, 1)
                        }],
                        'message': f'No transit nearby. Walking {round(distance_km, 1)} km takes ~{walk_min} min.',
                        'cta': {
                            'type': 'contribute_route',
                            'text': f'Know a route to {dest_name}? Help the community!',
                            'action': 'navigate_to_contribute'
                        }
                    }
                })
            }
        
        # Find path
        path = dijkstra(graph, start_node, end_node)
        
        if not path:
            distance_km = haversine(user_lat, user_lng, dest_lat, dest_lng)
            walk_min = round(distance_km * 12, 1)
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'status': 'success',
                    'route_data': {
                        'total_time_min': walk_min,
                        'segments': [{
                            'type': 'walk',
                            'route': f'Walk to {dest_name}',
                            'time_min': walk_min,
                            'distance_km': round(distance_km, 1)
                        }],
                        'message': f'No transit route found. Walking {round(distance_km, 1)} km takes ~{walk_min} min.',
                        'cta': {
                            'type': 'contribute_route',
                            'text': f'Know a route to {dest_name}? Help the community!',
                            'action': 'navigate_to_contribute'
                        }
                    }
                })
            }
        
        # Build segments with rich route info
        segments = []
        for i in range(len(path) - 1):
            u = path[i]
            v = path[i + 1]
            for edge in graph.get(u, []):
                if edge[0] == v:
                    info = _route_info.get(u, {})
                    segments.append({
                        'type': info.get('mode', 'transit'),
                        'route': info.get('name', 'Unknown route'),
                        'from': u,
                        'to': v,
                        'time_min': edge[1],
                        'reliability': info.get('reliability', 0.5),
                        'fare': info.get('avg_fare', 0),
                        'is_verified': info.get('is_approved', False),
                    })
                    break
        
        total_time = sum(s['time_min'] for s in segments)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'status': 'success',
                'route_data': {
                    'total_time_min': total_time,
                    'segments': segments,
                    'destination': dest_name
                }
            })
        }
    
    except Exception as e:
        return {
            'statusCode': 200,
            'body': json.dumps({'status': 'error', 'message': str(e)})
        }
