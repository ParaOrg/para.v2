import json
import gzip
import math
import heapq
import os
import urllib.request
import urllib.parse

_graph = None
_nodes = None

def load_graph_from_supabase():
    """Load graph from Supabase"""
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not service_key:
        raise Exception("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars")
    
    graph = {}
    nodes = {}
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    
    # Load edges
    offset = 0
    while True:
        url = f"{supabase_url}/rest/v1/graph_edges?select=from_node,to_node,weight,route_name,mode&limit=1000&offset={offset}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            edges = json.loads(resp.read())
        if not edges:
            break
        for edge in edges:
            if edge["from_node"] not in graph:
                graph[edge["from_node"]] = []
            graph[edge["from_node"]].append([
                edge["to_node"], 
                edge["weight"],
                edge.get("route_name", "Unknown"),
                edge.get("mode", "transit")
            ])
        offset += 1000
        if len(edges) < 1000:
            break
    
    # Load nodes
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
    
    return graph, nodes

def load_graph():
    global _graph, _nodes
    if _graph is None:
        try:
            _graph, _nodes = load_graph_from_supabase()
        except:
            with gzip.open("graph_full_rail.json.gz", "rt") as f:
                data = json.load(f)
            _graph = data.get("adj", {})
            _nodes = data.get("nodes", {})
    return _graph, _nodes

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def geocode_place(place_name):
    """Geocode using Supabase ph_places then Nominatim, then cache"""
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    
    # Check Supabase ph_places
    try:
        url = f"{supabase_url}/rest/v1/ph_places?canonical_name=ilike.*{urllib.parse.quote(place_name)}*&select=canonical_name,location&limit=1"
        req = urllib.request.Request(url, headers=headers)
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
    
    # Nominatim
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
            # Save to Supabase
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
    nearest = None
    min_dist = float('inf')
    for node_id, coords in graph_nodes.items():
        dist = haversine(lat, lng, coords[0], coords[1])
        if dist < min_dist and dist <= max_dist_km:
            min_dist = dist
            nearest = node_id
    return nearest, min_dist

def dijkstra(graph, start, end, max_time_min=200):
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
        for edge in graph.get(u, []):
            v = edge[0]
            w = edge[1]
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
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
    }
    
    try:
        if 'body' in event and isinstance(event['body'], str):
            event = json.loads(event['body'])
        
        message = event.get('message', '').lower()
        user_location = event.get('user_location', {})
        user_lat = user_location.get('lat')
        user_lng = user_location.get('lng')
        
        # Extract origin and destination from message
        origin_text = None
        dest_text = None
        
        if ' to ' in message:
            parts = message.split(' to ')
            dest_text = parts[-1].strip()
            # Check if origin is in "from X to Y"
            if ' from ' in parts[0]:
                origin_text = parts[0].split(' from ')[-1].strip()
            elif parts[0].strip():
                origin_text = parts[0].strip()
        
        # If no origin from message, use user_location
        if not user_lat or not user_lng:
            if origin_text:
                origin_result = geocode_place(origin_text)
                if origin_result:
                    user_lat = origin_result['lat']
                    user_lng = origin_result['lng']
                else:
                    return {'statusCode': 200, 'headers': cors_headers, 'body': json.dumps({'status': 'error', 'message': f'Cannot find origin: {origin_text}'})}
            else:
                return {'statusCode': 200, 'headers': cors_headers, 'body': json.dumps({'status': 'error', 'message': 'No location provided'})}
        
        if not dest_text:
            dest_text = message.strip()
        
        dest_result = geocode_place(dest_text)
        if not dest_result:
            return {'statusCode': 200, 'headers': cors_headers, 'body': json.dumps({'status': 'error', 'message': f'Cannot find: {dest_text}'})}
        
        dest_lat = dest_result['lat']
        dest_lng = dest_result['lng']
        dest_name = dest_result['name']
        
        graph, nodes = load_graph()
        
        start_node, _ = find_nearest_node(user_lat, user_lng, nodes, 10.0)
        end_node, _ = find_nearest_node(dest_lat, dest_lng, nodes, 10.0)
        
        if not start_node or not end_node:
            distance_km = haversine(user_lat, user_lng, dest_lat, dest_lng)
            walk_min = round(distance_km * 12, 1)
            return {
                'statusCode': 200, 'headers': cors_headers,
                'body': json.dumps({
                    'status': 'success',
                    'route_data': {
                        'total_time_min': walk_min,
                        'segments': [{'type': 'walk', 'route': f'Walk to {dest_name}', 'time_min': walk_min, 'distance_km': round(distance_km, 1)}],
                        'message': f'No transit nearby.',
                    }
                })
            }
        
        path = dijkstra(graph, start_node, end_node)
        
        if not path:
            distance_km = haversine(user_lat, user_lng, dest_lat, dest_lng)
            walk_min = round(distance_km * 12, 1)
            return {
                'statusCode': 200, 'headers': cors_headers,
                'body': json.dumps({
                    'status': 'success',
                    'route_data': {
                        'total_time_min': walk_min,
                        'segments': [{'type': 'walk', 'route': f'Walk to {dest_name}', 'time_min': walk_min, 'distance_km': round(distance_km, 1)}],
                        'message': f'No transit route.',
                    }
                })
            }
        
        segments = []
        for i in range(len(path) - 1):
            u = path[i]
            v = path[i + 1]
            for edge in graph.get(u, []):
                if edge[0] == v:
                    u_coords = nodes.get(u)
                    v_coords = nodes.get(v)
                    seg = {
                        'type': (edge[3] if len(edge) > 3 and edge[3] else 'transit'),
                        'route': (edge[2] if len(edge) > 2 and edge[2] else 'Unknown route'),
                        'time_min': edge[1],
                        'reliability': 0.5,
                        'fare': 0,
                        'is_verified': False,
                    }
                    if u_coords and v_coords:
                        seg['path'] = [[u_coords[0], u_coords[1]], [v_coords[0], v_coords[1]]]
                    segments.append(seg)
                    break
        
        total_time = sum(s['time_min'] for s in segments)
        
        return {
            'statusCode': 200, 'headers': cors_headers,
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
        return {'statusCode': 200, 'headers': cors_headers, 'body': json.dumps({'status': 'error', 'message': str(e)})}
