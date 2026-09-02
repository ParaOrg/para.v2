
import json
import gzip
import math
import heapq
import os

# Load graph once at startup
_graph = None
_nodes = None

def load_graph():
    global _graph, _nodes
    if _graph is None:
        with gzip.open("graph_full_rail.json.gz", "rt") as f:
            data = json.load(f)
        _graph = data["adj"]
        _nodes = data["nodes"]
    return _graph, _nodes

import urllib.request
import urllib.parse

def geocode_place(place_name):
    """Geocode a place name using Nominatim (OpenStreetMap)"""
    try:
        # Add Philippines context
        query = f"{place_name}, Metro Manila, Philippines"
        url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(query)}&format=json&limit=1"
        
        req = urllib.request.Request(url, headers={'User-Agent': 'ParaPH/1.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read())
            
        if data and len(data) > 0:
            return {
                'name': data[0].get('display_name', place_name),
                'lat': float(data[0]['lat']),
                'lng': float(data[0]['lon']),
            }
    except Exception as e:
        print(f"Geocoding error: {e}")
    
    return None

def find_destination_coords(message):
    """Find destination coordinates from message using multiple strategies"""
    # Strategy 1: Check KNOWN_PLACES first (fast, no API call)
    for place, (name, lat, lng) in KNOWN_PLACES.items():
        if place in message:
            return name, (lat, lng)
    
    # Strategy 2: Try geocoding the message
    # Extract potential place names (words after 'to')
    if ' to ' in message:
        dest_part = message.split(' to ')[-1].strip()
        if dest_part:
            result = geocode_place(dest_part)
            if result:
                return result['name'], (result['lat'], result['lng'])
    
    # Strategy 3: Geocode the whole message
    result = geocode_place(message)
    if result:
        return result['name'], (result['lat'], result['lng'])
    
    return None, None

KNOWN_PLACES = {
    "moa": ("SM MOA", 14.5351, 120.982),
    "cubao": ("Araneta Center - Cubao", 14.62291, 121.05326),
    "upd": ("UP Diliman", 14.6547, 121.0644),
    "up": ("UP Diliman", 14.6547, 121.0644),
    "diliman": ("UP Diliman", 14.6547, 121.0644),
    "ust": ("UST Espana", 14.6091, 120.9895),
    "espana": ("UST Espana", 14.6091, 120.9895),
    "makati": ("Makati", 14.5547, 121.0244),
    "bgc": ("BGC", 14.5505, 121.0519),
    "ortigas": ("Ortigas", 14.5857, 121.0598),
    "edsa": ("EDSA", 14.6042, 121.0297),
    "quezon city": ("Quezon City", 14.6760, 121.0437),
    "manila": ("Manila", 14.5995, 120.9842),
    "pasay": ("Pasay", 14.5378, 121.0014),
    "taguig": ("Taguig", 14.5176, 121.0509),
    "pasig": ("Pasig", 14.5764, 121.0851),
    "mandaluyong": ("Mandaluyong", 14.5794, 121.0359),
    "san juan": ("San Juan", 14.6019, 121.0355),
    "caloocan": ("Caloocan", 14.7566, 121.0449),
    "valenzuela": ("Valenzuela", 14.7011, 120.9830),
    "navotas": ("Navotas", 14.6655, 120.9500),
    "malabon": ("Malabon", 14.6632, 120.9584),
    "marikina": ("Marikina", 14.6507, 121.1029),
    "paranaque": ("Paranaque", 14.4793, 121.0198),
    "las pinas": ("Las Pinas", 14.4509, 120.9822),
    "muntinlupa": ("Muntinlupa", 14.4081, 121.0415),
}

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def find_nearest_node(lat, lng, node_type='rail', max_dist_km=3.0):
    """Find nearest node of specific type"""
    graph, nodes = load_graph()
    nearest = None
    min_dist = float('inf')
    
    for node_id in nodes:
        if node_type not in node_id:
            continue
        coords = nodes[node_id]
        dist = haversine(lat, lng, coords[0], coords[1])
        if dist < min_dist and dist <= max_dist_km:
            min_dist = dist
            nearest = node_id
    
    return nearest, min_dist

def astar_search(start, end, max_time_min=150):
    """Pure time-based A* search"""
    graph, nodes = load_graph()
    
    if start not in graph or end not in graph:
        return None
    
    open_set = [(0, 0, start, [start])]
    closed_set = set()
    g_scores = {start: 0}
    
    while open_set:
        f_score, g_score, current, path = heapq.heappop(open_set)
        
        if current in closed_set:
            continue
        
        if current == end:
            return path
        
        if g_score > max_time_min:
            continue
        
        closed_set.add(current)
        
        if current not in graph:
            continue
        
        for edge in graph[current]:
            if len(edge) < 2:
                continue
            
            neighbor = edge[0]
            weight = edge[1]  # Pure time
            
            if neighbor in closed_set:
                continue
            
            tentative_g = g_score + weight
            
            if neighbor not in g_scores or tentative_g < g_scores[neighbor]:
                g_scores[neighbor] = tentative_g
                
                # Heuristic
                if neighbor in nodes and end in nodes:
                    n_coords = nodes[neighbor]
                    e_coords = nodes[end]
                    h = haversine(n_coords[0], n_coords[1], 
                                 e_coords[0], e_coords[1]) / 25 * 60
                else:
                    h = 0
                
                f = tentative_g + h
                heapq.heappush(open_set, (f, tentative_g, neighbor, path + [neighbor]))
    
    return None

def build_segments(path):
    """Build route segments from path"""
    graph, nodes = load_graph()
    segments = []
    current_segment = None
    
    for i in range(len(path) - 1):
        current = path[i]
        next_node = path[i + 1]
        
        if current not in graph:
            continue
        
        # Find the edge
        for edge in graph[current]:
            if edge[0] == next_node:
                mode = edge[3] if len(edge) > 3 else "unknown"
                route = edge[2] if len(edge) > 2 else "unknown"
                time = edge[1]
                
                if current_segment is None:
                    current_segment = {
                        "mode": mode,
                        "route": route,
                        "time_min": time,
                        "path": [current, next_node]
                    }
                elif current_segment["mode"] == mode and current_segment["route"] == route:
                    current_segment["time_min"] += time
                    current_segment["path"].append(next_node)
                else:
                    segments.append(current_segment)
                    current_segment = {
                        "mode": mode,
                        "route": route,
                        "time_min": time,
                        "path": [current, next_node]
                    }
                break
    
    if current_segment:
        segments.append(current_segment)
    
    return segments

def lambda_handler(event, context):
    """Main handler"""
    try:
        # Get destination from message
        message = event.get('message', '').lower()
        user_location = event.get('user_location', {})
        user_lat = user_location.get('lat')
        user_lng = user_location.get('lng')
        
        if not user_lat or not user_lng:
            return {
                'statusCode': 200,
                'body': json.dumps({'status': 'error', 'message': 'No location provided'})
            }
        
        # Find destination (tries KNOWN_PLACES first, then geocoding)
        dest_name, dest_coords = find_destination_coords(message)
        
        if not dest_coords:
            return {
                'statusCode': 200,
                'body': json.dumps({'status': 'error', 'message': 'Destination not found'})
            }
        
        # Find nearest rail stations
        start_rail, start_dist = find_nearest_node(user_lat, user_lng, 'rail::', 5.0)
        end_rail, end_dist = find_nearest_node(dest_coords[0], dest_coords[1], 'rail::', 5.0)
        
        # Try rail path first
        path = None
        if start_rail and end_rail:
            path = astar_search(start_rail, end_rail, max_time_min=200)
        
        # If no rail path, try jeepney
        if not path:
            start_jeep, _ = find_nearest_node(user_lat, user_lng, 'jeep::', 2.0)
            end_jeep, _ = find_nearest_node(dest_coords[0], dest_coords[1], 'jeep::', 2.0)
            
            if start_jeep and end_jeep:
                path = astar_search(start_jeep, end_jeep, max_time_min=200)
        
        if not path:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'status': 'error',
                    'message': 'No path found'
                })
            }
        
        # Build segments
        segments = build_segments(path)
        
        # Calculate total time
        total_time = sum(seg['time_min'] for seg in segments)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'status': 'success',
                'route_data': {
                    'total_time_min': total_time,
                    'segments': segments,
                    'start_rail': start_rail,
                    'end_rail': end_rail
                }
            })
        }
    
    except Exception as e:
        return {
            'statusCode': 200,
            'body': json.dumps({
                'status': 'error',
                'message': str(e)
            })
        }
