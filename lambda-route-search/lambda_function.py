import json, gzip, os, re, heapq, logging
import urllib.request

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Supabase connection from env vars
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://tcvomrkytxnetzijwqad.supabase.co')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')

# Graph
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GRAPH_PATH = os.path.join(BASE_DIR, 'graph_full.json.gz')
ADJ, NODES = {}, {}

# Dynamic location cache
_location_cache = None

def load_graph():
    global ADJ, NODES
    if ADJ and NODES: return
    with gzip.open(GRAPH_PATH, 'rt') as f:
        data = json.load(f)
    ADJ = data.get('adj', {})
    NODES = data.get('nodes', {})

def fetch_locations_from_supabase():
    """Fetch all locations from Supabase: rail stations + POIs + routes."""
    global _location_cache
    if _location_cache is not None:
        return _location_cache
    
    locations = {}
    
    # 1. Fetch rail stations
    try:
        url = f"{SUPABASE_URL}/rest/v1/rail_station_points?select=name,geom"
        headers = {'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {SUPABASE_ANON_KEY}'}
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            stations = json.loads(resp.read())
        
        for station in stations:
            name = station.get('name', '').lower().strip()
            geom = station.get('geom', {})
            coords = geom.get('coordinates', []) if isinstance(geom, dict) else []
            if name and len(coords) >= 2:
                locations[name] = (name, float(coords[1]), float(coords[0]))
    except Exception as e:
        logger.warning(f"Failed to fetch rail stations: {e}")
    
    # 2. Fetch POIs
    try:
        url = f"{SUPABASE_URL}/rest/v1/ph_places?select=canonical_name,location"
        headers = {'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {SUPABASE_ANON_KEY}'}
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            pois = json.loads(resp.read())
        
        for poi in pois:
            name = poi.get('canonical_name', '').lower().strip()
            location = poi.get('location', '')
            lat, lng = None, None
            if 'POINT' in str(location):
                coords = str(location).replace('POINT(', '').replace(')', '').split()
                if len(coords) == 2:
                    lng, lat = float(coords[0]), float(coords[1])
            if name and lat and lng:
                locations[name] = (name, lat, lng)
    except Exception as e:
        logger.warning(f"Failed to fetch POIs: {e}")
    
    # 3. Fetch route names as locations
    try:
        url = f"{SUPABASE_URL}/rest/v1/ph_routes?select=name&is_approved=true&limit=500"
        headers = {'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {SUPABASE_ANON_KEY}'}
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            routes = json.loads(resp.read())
        
        for route in routes:
            name = route.get('name', '').lower().strip()
            if name:
                # Store as searchable term (no coordinates - will be matched via graph nodes)
                locations[name] = None
    except Exception as e:
        logger.warning(f"Failed to fetch routes: {e}")
    
    _location_cache = locations
    return locations

def geocode_place(place_name):
    """Geocode using Supabase locations + graph nodes."""
    name_lower = place_name.lower().strip()
    
    # 1. Check Supabase locations
    locations = fetch_locations_from_supabase()
    if name_lower in locations:
        loc = locations[name_lower]
        if loc:
            return loc[1], loc[2]
    
    # 2. Check graph nodes (rail stations embedded in node IDs)
    for node_id, coords in NODES.items():
        parts = node_id.lower().split('::')
        if name_lower in parts:
            return coords[0], coords[1]
    
    # 3. Fuzzy match graph nodes
    for node_id, coords in NODES.items():
        if name_lower in node_id.lower():
            return coords[0], coords[1]
    
    return None, None

def find_nearest_node(lat, lng):
    nearest = None
    min_dist = float('inf')
    for node_id, coords in NODES.items():
        dist = (lat - coords[0])**2 + (lng - coords[1])**2
        if dist < min_dist:
            min_dist = dist
            nearest = node_id
    return nearest

def dijkstra(start, end):
    if start not in ADJ or end not in ADJ:
        return []
    heap = [(0, start)]
    dist = {start: 0}
    prev = {}
    visited = set()
    
    while heap:
        d, u = heapq.heappop(heap)
        if u in visited: continue
        visited.add(u)
        if u == end: break
        
        for edge in ADJ.get(u, []):
            v = edge[0]
            w = edge[1]
            new_dist = d + w
            if v not in dist or new_dist < dist[v]:
                dist[v] = new_dist
                prev[v] = u
                heapq.heappush(heap, (new_dist, v))
    
    if end not in prev: return []
    
    path = [end]
    while path[-1] != start:
        path.append(prev[path[-1]])
    return list(reversed(path))

def lambda_handler(event, context):
    if isinstance(event, dict) and event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': ''}

    try:
        load_graph()
        body = json.loads(event['body']) if isinstance(event.get('body'), str) else (event.get('body') or event)
        
        message = body.get('message', '').lower()
        user_loc = body.get('user_location', {})
        
        origin_lat, origin_lng, dest_lat, dest_lng = None, None, None, None

        # Handle "from here to X"
        if 'here' in message and user_loc.get('lat'):
            origin_lat, origin_lng = float(user_loc['lat']), float(user_loc['lng'])
            dest_name = re.sub(r'.*to\s*', '', message).strip()
            dest = geocode_place(dest_name)
            if dest: dest_lat, dest_lng = dest
        # Handle "X to Y"
        elif ' to ' in message:
            parts = message.split(' to ')
            origin = geocode_place(parts[0].replace('from', '').strip())
            dest = geocode_place(parts[1].strip())
            if origin: origin_lat, origin_lng = origin
            if dest: dest_lat, dest_lng = dest
        # Handle "Destination only"
        else:
            dest = geocode_place(message.replace('papunta', '').replace('punta', '').strip())
            if dest:
                dest_lat, dest_lng = dest
                if user_loc.get('lat'):
                    origin_lat, origin_lng = float(user_loc['lat']), float(user_loc['lng'])
                else:
                    origin_lat, origin_lng = 14.6225, 121.0538  # Default Cubao

        if not all([origin_lat, origin_lng, dest_lat, dest_lng]):
            return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 
                    'body': json.dumps({'status': 'error', 'message': f'Could not geocode: {message}'})}

        start = find_nearest_node(origin_lat, origin_lng)
        end = find_nearest_node(dest_lat, dest_lng)
        
        if not start or not end:
            return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 
                    'body': json.dumps({'status': 'error', 'message': 'No route nodes found'})}
        
        path = dijkstra(start, end)
        
        if not path:
            return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 
                    'body': json.dumps({'status': 'error', 'message': 'No path found'})}
        
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 
                'body': json.dumps({'status': 'success', 'path_length': len(path), 'origin': [origin_lat, origin_lng], 'dest': [dest_lat, dest_lng]})}
                
    except Exception as e:
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 
                'body': json.dumps({'status': 'error', 'message': str(e)})}
