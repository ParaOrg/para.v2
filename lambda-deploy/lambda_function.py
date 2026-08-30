import json
import traceback
import gzip
import heapq
import math
import logging
import urllib.request as ur
import urllib.parse
import datetime
import os
import sys

# Try to import supabase for dynamic queries
import urllib.request as urllib_request
import urllib.parse as urllib_parse

SUPABASE_AVAILABLE = True  # Always available via REST API

logger = logging.getLogger()
logger.setLevel(logging.INFO)

KNOWN_PLACES = {
    'naia': ('NAIA Terminal 3', 14.5086, 121.0194),
    'cubao': ('Araneta Center-Cubao', 14.62291, 121.05326),
    'makati': ('Ayala', 14.54876, 121.02754),  # Use Ayala MRT station for Makati CBD
    'manila': ('Manila', 14.5995, 120.9842),
    'quezon city': ('Quezon City', 14.6760, 121.0437),
    'qc': ('Quezon City', 14.6760, 121.0437),
    'ortigas': ('Ortigas', 14.6091, 121.0223),
    'bgc': ('BGC', 14.5547, 121.0244),
    'alabang': ('Alabang', 14.4450, 121.0254),
    'pasay': ('Pasay', 14.5378, 120.9910),
    'upd': ('UPD', 14.6561, 121.0648),
    'up': ('UPD', 14.6561, 121.0648),
    'up diliman': ('UPD', 14.6561, 121.0648),
    'ust': ('UST', 14.6101, 120.9894),
    'katipunan': ('Katipunan', 14.6225, 121.0785),
    'moa': ('SM MOA', 14.5351, 120.9820),
    'sm moa': ('SM MOA', 14.5351, 120.9820),
    'sm north': ('SM North', 14.6568, 121.0364),
    'monumento': ('Monumento', 14.6544, 120.9842),
    'baclaran': ('Baclaran', 14.5378, 120.9910),
    'divisoria': ('Divisoria', 14.6027, 120.9740),
    'quiapo': ('Quiapo', 14.5983, 120.9830),
}

# ── Dynamic Data Caches ──
_dynamic_pois = None
_dynamic_nlp_terms = None
_dynamic_routes_cache = None
_cache_timestamp = 0
_CACHE_TTL = 300  # 5 minutes

def get_supabase_client():
    """Return Supabase REST API config."""
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    
    if not url or not key:
        return None
    
    return {"url": url, "key": key}

def fetch_dynamic_pois(supabase):
    """Fetch POIs from ph_places table for geocoding."""
    global _dynamic_pois, _cache_timestamp
    
    if _dynamic_pois and (datetime.datetime.now().timestamp() - _cache_timestamp) < _CACHE_TTL:
        return _dynamic_pois
    
    if not supabase:
        return {}
    
    try:
        url = f"{supabase['url']}/rest/v1/ph_places?limit=500"
        req = urllib_request.Request(url, headers={"apikey": supabase["key"], "Authorization": f"Bearer {supabase['key']}"})
        with urllib_request.urlopen(req, timeout=10) as resp:
            response_data = json.loads(resp.read())
        response = type('obj', (object,), {'data': response_data})()
        pois = {}
        for poi in response.data:
            name = poi.get("name", "").lower()
            if name:
                pois[name] = {
                    "name": poi.get("name"),
                    "lat": poi.get("lat"),
                    "lng": poi.get("lng"),
                    "type": poi.get("poi_type", "general"),
                    "score": poi.get("relevance_score", 10),
                }
        _dynamic_pois = pois
        _cache_timestamp = datetime.datetime.now().timestamp()
        logger.info(f"Loaded {len(pois)} POIs from Supabase")
        return pois
    except Exception as e:
        tb = traceback.format_exc()
        print(f"❌ LAMBDA CRASH TRACEBACK:\n{tb}")
        logger.error(f"Lambda crash: {e}\n{tb}")
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'status': 'error', 'message': str(e), 'traceback': tb.splitlines()[-5:]})
        }
    return adj_weighted

def geocode_with_pois(place_name, dynamic_pois):
    """Geocode a place name using dynamic POIs first, then fallback to KNOWN_PLACES."""
    place_lower = place_name.lower().strip()
    
    # Check dynamic POIs first
    if place_lower in dynamic_pois:
        poi = dynamic_pois[place_lower]
        return poi["lat"], poi["lng"], poi["name"]
    
    # Fuzzy match against POIs
    for poi_name, poi in dynamic_pois.items():
        if place_lower in poi_name or poi_name in place_lower:
            return poi["lat"], poi["lng"], poi["name"]
    
    # Fallback to KNOWN_PLACES
    if place_lower in KNOWN_PLACES:
        return KNOWN_PLACES[place_lower][1], KNOWN_PLACES[place_lower][2], KNOWN_PLACES[place_lower][0]
    
    return None, None, None

def geocode_with_nominatim(place_name):
    """Geocode using OpenStreetMap Nominatim API."""
    try:
        query = urllib.parse.quote(place_name + ', Metro Manila, Philippines')
        url = f"https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1"
        req = ur.Request(url, headers={'User-Agent': 'ParaPH/3.0'})
        with ur.urlopen(req, timeout=5) as resp:
            results = json.loads(resp.read())
            if results:
                lat = float(results[0]['lat'])
                lng = float(results[0]['lon'])
                display_name = results[0].get('display_name', place_name)
                logger.info(f"Nominatim geocoded '{place_name}' -> ({lat}, {lng})")
                return lat, lng, display_name
    except Exception as e:
        logger.warning(f"Nominatim geocoding failed for '{place_name}': {e}")
    return None, None, None

def parse_with_nlp_terms(message, dynamic_nlp_terms):
    """Parse message using dynamic NLP terms for better Taglish understanding."""
    if not dynamic_nlp_terms:
        return message
    
    # Replace Taglish terms with canonical forms
    words = message.lower().split()
    for i, word in enumerate(words):
        if word in dynamic_nlp_terms:
            canonical = dynamic_nlp_terms[word]["canonical"]
            words[i] = canonical
    
    return ' '.join(words)

_graph = None
_nodes = None
_graph_loaded_at = 0
_GRAPH_TTL = 300  # 5 minutes cache

def load_graph_static():
    global _graph, _nodes
    # ALWAYS reload from file to avoid stale cache
    with gzip.open('graph_full_rail.json.gz', 'rt') as f:
        data = json.load(f)
    _graph = data['adj']
    _nodes = data['nodes']
    return _graph, _nodes

def load_graph_from_supabase():
    """Dynamically load graph from Supabase."""
    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    
    if not supabase_url or not supabase_key:
        return load_graph_static()
    
    try:
        adj = {}
        nodes = {}
        page_size = 5000
        offset = 0
        
        # Load edges
        while True:
            edges_url = f"{supabase_url}/rest/v1/graph_edges?select=from_node,to_node,weight&limit={page_size}&offset={offset}"
            edges_req = ur.Request(edges_url, headers={'apikey': supabase_key, 'Authorization': f'Bearer {supabase_key}'})
            with ur.urlopen(edges_req, timeout=15) as er:
                edges_data = json.loads(er.read())
            
            if not edges_data:
                break
            
            for edge in edges_data:
                from_node = edge.get('from_node', '')
                to_node = edge.get('to_node', '')
                weight = edge.get('weight', 1.0)
                
                if not from_node or not to_node:
                    continue
                
                if from_node not in adj:
                    adj[from_node] = []
                adj[from_node].append([to_node, weight])
            
            offset += page_size
            if len(edges_data) < page_size:
                break
        
        # Load nodes
        offset = 0
        while True:
            nodes_url = f"{supabase_url}/rest/v1/graph_nodes?select=node_id,lat,lon&limit={page_size}&offset={offset}"
            nodes_req = ur.Request(nodes_url, headers={'apikey': supabase_key, 'Authorization': f'Bearer {supabase_key}'})
            with ur.urlopen(nodes_req, timeout=15) as nr:
                nodes_data = json.loads(nr.read())
            
            if not nodes_data:
                break
            
            for node in nodes_data:
                node_id = node.get('node_id', '')
                lat = node.get('lat', 0)
                lon = node.get('lon', 0)
                if node_id:
                    nodes[node_id] = [lat, lon]
            
            offset += page_size
            if len(nodes_data) < page_size:
                break
        
        logger.info(f"Dynamically loaded graph: {len(nodes)} nodes, {len(adj)} with edges")
        return adj, nodes
    
    except Exception as e:
        logger.warning(f"Supabase graph load failed: {e}. Using static file.")
        return load_graph_static()

def load_graph():
    global _graph, _nodes, _graph_loaded_at
    
    # Use static graph file (already bundled in Lambda zip) as PRIMARY source
    # This avoids timeout from querying 474K edges from Supabase
    return load_graph_static()

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a)) * 1000

def find_rail_station_node(station_name, nodes):
    """Find a rail station node by name."""
    station_lower = station_name.lower()
    
    # Special case: "makati" -> Ayala station
    if station_lower in ('makati', 'makati cbd', 'makati city'):
        station_lower = 'ayala'
    
    for node_id in nodes:
        if 'rail::' in node_id:
            node_station = node_id.split('::')[1] if '::' in node_id else ''
            if station_lower in node_station.lower():
                return node_id
    return None

def find_nearest_node(lat, lon, nodes):
    """
    Find the best node to start/end a journey.
    Priority:
    1. Rail station within 1km (best for connectivity)
    2. Jeepney node with rail connection within 500m
    3. Well-connected node (10+ edges)
    4. Nearest node
    """
    candidates = []
    
    for node_id, coords in nodes.items():
        node_lat = coords[0]
        node_lng = coords[1]
        dist = haversine(lat, lon, node_lat, node_lng)
        candidates.append((dist, node_id))
    
    candidates.sort()
    
    if not candidates:
        return None
    
    # Priority 1: Rail station within 1km
    for dist, node_id in candidates[:100]:
        if 'rail::' in node_id and dist < 1000:
            return node_id
    
    # Priority 2: Jeepney node with rail connection within 500m
    for dist, node_id in candidates[:100]:
        if 'jeep::' in node_id and dist < 500:
            # Check if it has rail connections
            edges = _graph.get(node_id, []) if _graph else []
            has_rail = any('rail::' in e[0] for e in edges)
            if has_rail:
                return node_id
    
    # Priority 3: Well-connected node (10+ edges) within 500m
    for dist, node_id in candidates[:100]:
        edge_count = len(_graph.get(node_id, [])) if _graph else 0
        if edge_count >= 10 and dist < 500:
            return node_id
    
    # Fallback: nearest node
    return candidates[0][1]


def dijkstra(adj, start, end, weather_penalty=0, time_of_day_penalty=0, flood_zones=None, precipitation=0):
    """Dijkstra with dynamic penalties applied to edge weights."""
    if start not in adj or end not in adj:
        return []
    
    if flood_zones is None:
        flood_zones = ['españa', 'taft', 'buendia', 'edsa', 'commonwealth', 'recto', 'quezon ave']
    
    heap = [(0, start)]
    dist = {start: 0}
    prev = {}
    visited = set()
    
    while heap:
        d, u = heapq.heappop(heap)
        if u in visited:
            continue
        visited.add(u)
        if u == end:
            break
        
        for edge in adj.get(u, []):
            v = edge[0]
            w = edge[1]
            
            # Apply dynamic penalties to this edge
            route_name_lower = v.lower() if '::' in v else ''
            
            # Flood penalty: if raining and route passes through flood zone
            if precipitation > 0 and any(zone in route_name_lower for zone in flood_zones):
                w *= 1.20  # 20% slower in flood zones when raining
            
            # Weather penalty applied to all edges
            if weather_penalty > 0:
                w *= (1.0 + weather_penalty)
            
            # Time of day penalty
            if time_of_day_penalty > 0:
                w *= (1.0 + time_of_day_penalty)
            
            nd = d + w
            if nd < dist.get(v, float('inf')):
                dist[v] = nd
                prev[v] = u
                heapq.heappush(heap, (nd, v))
    
    if end not in prev and start != end:
        return []
    path = []
    u = end
    while u in prev:
        path.append(u)
        u = prev[u]
    path.append(start)
    return path[::-1]

def dijkstra_with_block(adj, start, end, blocked_edges):
    if start not in adj or end not in adj:
        return []
    heap = [(0, start)]
    dist = {start: 0}
    prev = {}
    visited = set()
    while heap:
        d, u = heapq.heappop(heap)
        if u in visited:
            continue
        visited.add(u)
        if u == end:
            break
        for edge in adj.get(u, []):
            v = edge[0]
            if (u, v) in blocked_edges:
                continue
            w = edge[1]
            nd = d + w
            if nd < dist.get(v, float('inf')):
                dist[v] = nd
                prev[v] = u
                heapq.heappush(heap, (nd, v))
    if end not in prev and start != end:
        return []
    path = []
    u = end
    while u in prev:
        path.append(u)
        u = prev[u]
    path.append(start)
    return path[::-1]

def fetch_rail_line_geometries():
    """
    Fetch smooth rail line geometries from Supabase.
    Returns: {line_name: [[lat, lng], ...]}
    """
    supabase = get_supabase_client()
    if not supabase:
        return {}
    
    try:
        url = f"{supabase['url']}/rest/v1/rail_network_lines?select=name,geom&limit=500"
        req = urllib_request.Request(url, headers={"apikey": supabase["key"], "Authorization": f"Bearer {supabase['key']}"})
        with urllib_request.urlopen(req, timeout=10) as resp:
            lines = json.loads(resp.read())
        
        line_geoms = {}
        for line in lines:
            name = line.get("name", "")
            geom = line.get("geom")
            if not name or not geom:
                continue
            
            # Parse GeoJSON geometry
            if isinstance(geom, str):
                try:
                    geom = json.loads(geom)
                except:
                    continue
            
            coords = geom.get("coordinates", []) if isinstance(geom, dict) else []
            if not coords:
                continue
            
            # Handle MultiLineString
            flat_coords = []
            if coords and isinstance(coords[0], list):
                if isinstance(coords[0][0], list):
                    for line_part in coords:
                        flat_coords.extend(line_part)
                else:
                    flat_coords = coords
            
            # Convert [lng, lat] to [lat, lng]
            converted = [[c[1], c[0]] for c in flat_coords if len(c) >= 2]
            
            # APPEND to existing line (combine all segments)
            if name not in line_geoms:
                line_geoms[name] = []
            line_geoms[name].extend(converted)
        
        logger.info(f"Loaded {len(line_geoms)} rail line geometries from Supabase")
        return line_geoms
    except Exception as e:
        logger.warning(f"Failed to fetch rail line geometries: {e}")
        return {}

def fetch_station_line_mapping():
    """Dynamically map stations to their rail lines using spatial proximity."""
    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    
    if not supabase_url or not supabase_key:
        return {}, {}
    
    try:
        lines_url = f"{supabase_url}/rest/v1/rail_network_lines?select=name,geom&limit=1000"
        lines_req = ur.Request(lines_url, headers={'apikey': supabase_key, 'Authorization': f'Bearer {supabase_key}'})
        with ur.urlopen(lines_req, timeout=10) as lr:
            lines_data = json.loads(lr.read())
        
        line_geoms = {}
        for line in lines_data:
            name = line.get("name", "")
            geom = line.get("geom", {})
            if isinstance(geom, str):
                try:
                    geom = json.loads(geom)
                except:
                    continue
            coords = geom.get("coordinates", [])
            if name and coords:
                if name not in line_geoms:
                    line_geoms[name] = []
                line_geoms[name].extend(coords)
        
        stations_url = f"{supabase_url}/rest/v1/rail_station_points?select=name,geom&railway=eq.stop&limit=200"
        stations_req = ur.Request(stations_url, headers={'apikey': supabase_key, 'Authorization': f'Bearer {supabase_key}'})
        with ur.urlopen(stations_req, timeout=10) as sr:
            stations_data = json.loads(sr.read())
        
        station_to_line = {}
        for station in stations_data:
            station_name = station.get("name")
            if not station_name:
                continue
            station_geom = station.get("geom", {})
            if isinstance(station_geom, str):
                try:
                    station_geom = json.loads(station_geom)
                except:
                    continue
            station_coords = station_geom.get("coordinates", [])
            if len(station_coords) < 2:
                continue
            station_lng, station_lat = station_coords[0], station_coords[1]
            
            min_dist = float('inf')
            best_line = None
            for line_name, line_coords in line_geoms.items():
                for coord in line_coords:
                    if len(coord) >= 2:
                        line_lng, line_lat = coord[0], coord[1]
                        dist = haversine(station_lat, station_lng, line_lat, line_lng)
                        if dist < min_dist:
                            min_dist = dist
                            best_line = line_name
            
            if best_line:
                station_to_line[station_name.lower()] = best_line
        
        logger.info(f"Dynamically mapped {len(station_to_line)} stations to {len(line_geoms)} lines")
        return station_to_line, line_geoms
    
    except Exception as e:
        logger.warning(f"Failed to build station-line mapping: {e}")
        return {}, {}


def build_segments_from_path(path, nodes, line_geoms=None, station_to_line=None):
    """
    PILLAR 1: Single-Line Continuity - Same rail line = ONE segment.
    Groups ALL consecutive nodes on the same line into ONE segment.
    """
    segments = []
    current_line = None
    current_group = []
    current_mode = None
    
    def get_line_for_station(station_name):
        """Get rail line from station name using dynamic mapping or inference."""
        station_lower = station_name.lower()
        if station_to_line and station_lower in station_to_line:
            return station_to_line[station_lower]
        # Fallback inference
        if any(s in station_lower for s in ('katipunan', 'anonas', 'santolan', 'marikina', 'antipolo', 'recto', 'legarda', 'pureza', 'v. mapa', 'j. ruiz', 'gilmore', 'betty go')):
            return 'LRT-2'
        elif any(s in station_lower for s in ('north avenue', 'quezon avenue', 'gma kamuning', 'ortigas', 'shaw', 'boni', 'guadalupe', 'buendia', 'ayala', 'magallanes', 'taft')):
            return 'MRT-3'
        elif any(s in station_lower for s in ('fernando poe', 'balintawak', 'monumento', '5th avenue', 'r. papa', 'abad santos', 'blumentritt', 'tayuman', 'bambang', 'doroteo jose', 'carriedo', 'united nations', 'pedro gil', 'quirino', 'vito cruz', 'gil puyat', 'libertad', 'edsa', 'baclaran', 'redemptorist', 'mia road', 'pitx', 'ninoy aquino', 'dr. santos')):
            return 'LRT-1'
        return None
    
    def get_station_name(node_id):
        """Extract clean station name from node ID."""
        if '::' not in node_id:
            return None
        parts = node_id.split('::')
        if len(parts) < 2:
            return None
        name = parts[1].replace('_', ' ').strip()
        # Skip invalid names
        if not name or name.lower() in ('none', 'null', '') or 'entrance' in name.lower():
            return None
        if '.' in name and any(c.isdigit() for c in name):
            return None
        return name
    
    def append_rail_segment(group, line_name):
        """Append a continuous rail segment with smooth geometry."""
        if not group or len(group) < 2:
            return
        
        # Extract station names in order
        stations = []
        coords_list = []
        for node_id in group:
            station = get_station_name(node_id)
            if station and station not in stations:
                stations.append(station)
            if node_id in nodes:
                coords_list.append(nodes[node_id])
        
        if len(stations) < 2 or len(coords_list) < 2:
            return
        
        # Try to use smooth rail geometry from Supabase
        try:
            smooth_geoms = fetch_rail_line_geometries()
            # Find matching line name - handle "LRT-1" vs "LRT Line 1"
            line_key = None
            line_name_normalized = line_name.upper().replace("-", " ").replace("LINE ", "")
            for key in smooth_geoms.keys():
                key_normalized = key.upper().replace("-", " ").replace("LINE ", "")
                if line_name_normalized in key_normalized or key_normalized in line_name_normalized:
                    line_key = key
                    break
            
            if line_key and smooth_geoms[line_key]:
                smooth_coords = smooth_geoms[line_key]
                # Coords are already [lat, lng] from fetch_rail_line_geometries
                # No conversion needed
                
                start_coord = coords_list[0]
                end_coord = coords_list[-1]
                
                start_idx = 0
                end_idx = len(smooth_coords) - 1
                min_start_dist = float('inf')
                min_end_dist = float('inf')
                
                for i, sc in enumerate(smooth_coords):
                    d_s = haversine(start_coord[0], start_coord[1], sc[0], sc[1])
                    d_e = haversine(end_coord[0], end_coord[1], sc[0], sc[1])
                    if d_s < min_start_dist:
                        min_start_dist = d_s
                        start_idx = i
                    if d_e < min_end_dist:
                        min_end_dist = d_e
                        end_idx = i
                
                if start_idx < end_idx:
                    coords_list = smooth_coords[start_idx:end_idx+1]
                elif end_idx < start_idx:
                    coords_list = smooth_coords[end_idx:start_idx+1][::-1]
                
                # Snap endpoints
                if coords_list:
                    coords_list[0] = start_coord
                    coords_list[-1] = end_coord
        except Exception:
            pass  # Fallback to straight lines
        
        # Calculate distance and time using STRAIGHT-LINE distance between endpoints
        # NOT the smooth curve length (which adds many km of detours)
        dist_km = haversine(
            coords_list[0][0], coords_list[0][1],
            coords_list[-1][0], coords_list[-1][1]
        ) / 1000
        
        time_min = max(dist_km / 35 * 60, 2)
        
        route_label = f"Take {line_name} from {stations[0]} to {stations[-1]}"
        segments.append({
            'route': route_label,
            'mode': 'rail',
            'line': line_name,
            'distance_km': round(dist_km, 2),
            'time_min': round(time_min, 1),
            'geometry': coords_list,
            'type': 'transit',
            'origin_station': stations[0],
            'destination_station': stations[-1],
        })
    
    def append_jeepney_segment(group, route_name):
        """Append a continuous jeepney segment."""
        if not group or len(group) < 2:
            return
        
        # Extract coordinates
        coords_list = []
        for node_id in group:
            if node_id in nodes:
                coords_list.append(nodes[node_id])
        
        if len(coords_list) < 2:
            return
        
        # Calculate distance and time
        dist_km = sum(
            haversine(coords_list[i][0], coords_list[i][1], 
                     coords_list[i+1][0], coords_list[i+1][1]) 
            for i in range(len(coords_list)-1)
        ) / 1000
        
        # Jeepney speed: 15 km/h
        time_min = max(dist_km / 15 * 60, 2)
        
        # Estimate fare: ₱13 base + ₱2.20 per km
        fare = 13 + (dist_km * 2.20)
        
        route_label = f"Take jeepney {route_name}"
        segments.append({
            'route': route_label,
            'mode': 'jeepney',
            'distance_km': round(dist_km, 2),
            'time_min': round(time_min, 1),
            'geometry': coords_list,
            'type': 'transit',
            'fare': round(fare, 2),
            'origin_station': None,
            'destination_station': None,
        })
    
    # Traverse path, grouping by mode and route
    for node_id in path:
        if 'rail::' in node_id:
            # Rail node
            station = get_station_name(node_id)
            if not station:
                continue
            
            node_line = get_line_for_station(station)
            
            if node_line is None:
                continue
            
            # Flush jeepney segment if any
            if current_group and current_mode == 'jeepney':
                append_jeepney_segment(current_group, current_line)
                current_group = []
                current_line = None
            
            # Check if this is a continuation of current rail line
            if current_line == node_line and current_mode == 'rail':
                current_group.append(node_id)
            else:
                # Flush previous rail segment
                if current_group and current_mode == 'rail':
                    append_rail_segment(current_group, current_line)
                
                # Start new rail segment
                current_line = node_line
                current_mode = 'rail'
                current_group = [node_id]
        
        elif 'jeep::' in node_id:
            # Jeepney node
            # Extract route name from node ID
            parts = node_id.split('::')
            if len(parts) >= 2:
                route_name = parts[1]
                
                # Flush rail segment if any
                if current_group and current_mode == 'rail':
                    append_rail_segment(current_group, current_line)
                    current_group = []
                    current_line = None
                
                # Check if this is a continuation of current jeepney route
                if current_line == route_name and current_mode == 'jeepney':
                    current_group.append(node_id)
                else:
                    # Flush previous jeepney segment
                    if current_group and current_mode == 'jeepney':
                        append_jeepney_segment(current_group, current_line)
                    
                    # Start new jeepney segment
                    current_line = route_name
                    current_mode = 'jeepney'
                    current_group = [node_id]
        
        else:
            # Walk or other node - flush any segment
            if current_group and current_mode == 'rail':
                append_rail_segment(current_group, current_line)
            elif current_group and current_mode == 'jeepney':
                append_jeepney_segment(current_group, current_line)
            
            current_line = None
            current_mode = None
            current_group = []
    
    # Flush final segment
    if current_group and current_mode == 'rail':
        append_rail_segment(current_group, current_line)
    elif current_group and current_mode == 'jeepney':
        append_jeepney_segment(current_group, current_line)
    
    return segments

def seg_fare(seg):
    """
    PILLAR 2: Matrix fare lookup for rail, distance-based for road.
    Uses transit_fares table for accurate point-to-point fares.
    """
    mode = seg.get('mode', 'jeepney')
    d = seg.get('distance_km', 0)
    
    if mode == 'rail':
        # Use station names for matrix lookup
        origin = seg.get('origin_station', '')
        dest = seg.get('destination_station', '')
        line = seg.get('line', '')
        
        if origin and dest and line:
            # Try to fetch from transit_fares table dynamically
            try:
                supabase_url = os.environ.get("SUPABASE_URL", "")
                supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
                if supabase_url and supabase_key:
                    import urllib.parse
                    # Normalize line name for query
                    line_query = urllib.parse.quote(line)
                    origin_enc = urllib.parse.quote(origin)
                    dest_enc = urllib.parse.quote(dest)
                    
                    # Query transit_fares with proper columns
                    fare_url = f"{supabase_url}/rest/v1/transit_fares?select=fare_amount&line=eq.{line_query}&origin_station=eq.{origin_enc}&destination_station=eq.{dest_enc}&limit=1"
                    fare_req = ur.Request(fare_url, headers={'apikey': supabase_key, 'Authorization': f'Bearer {supabase_key}'})
                    with ur.urlopen(fare_req, timeout=3) as fr:
                        fares = json.loads(fr.read())
                        if fares:
                            return float(fares[0].get('fare_amount', 20.0))
            except:
                pass
        
        # Fallback: estimate by distance
        return round(15.0 + d * 1.5, 2)
    
    if mode == 'jeepney':
        return round(13.0 if d <= 5 else 13.0 + (d - 5) * 1.5, 2)
    elif mode == 'bus':
        return round(15.0 if d <= 5 else 15.0 + (d - 5) * 2.0, 2)
    else:
        return 20.0

def error_response(message):
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'status': 'error', 'message': message})
    }


def astar_search(start_node, end_node, max_time_min=180):
    """
    A* search algorithm with haversine heuristic.
    Finds shortest path between two nodes in the transit graph.
    """
    global _graph, _nodes
    
    # Load graph if not loaded
    if _graph is None:
        _graph, _nodes = load_graph_static()
    
    if start_node not in _graph or end_node not in _graph:
        return None
    
    def heuristic(node_id):
        """Haversine distance heuristic to end node."""
        if node_id not in _nodes or end_node not in _nodes:
            return 0
        n1 = _nodes[node_id]
        n2 = _nodes[end_node]
        # Use 35 km/h as optimistic speed for heuristic
        return haversine(n1[0], n1[1], n2[0], n2[1]) / 1000 / 35 * 60
    
    # Priority queue: (f_score, g_score, node, path)
    open_set = [(heuristic(start_node), 0, start_node, [start_node])]
    closed_set = set()
    g_scores = {start_node: 0}
    
    while open_set:
        f_score, g_score, current, path = heapq.heappop(open_set)
        
        # Check if we've exceeded max time
        if g_score > max_time_min:
            continue
        
        # Check if reached destination
        if current == end_node:
            return path
        
        if current in closed_set:
            continue
        
        closed_set.add(current)
        
        # Explore neighbors
        if current not in _graph:
            continue
            
        for edge in _graph[current]:
            if len(edge) < 2:
                continue
            
            neighbor = edge[0]
            weight = edge[1]
            
            # Apply SAKAY cost multipliers
            if len(edge) >= 4:
                mode = edge[3]
                if mode == 'walk':
                    weight *= 1.0  # Walk time already reflects slowness (5 km/h)
                elif mode == 'rail':
                    weight *= 0.8  # Rail is preferred (35 km/h)
                elif mode == 'jeepney':
                    weight *= 1.0  # Pure time — no artificial penalty
            
            if neighbor in closed_set:
                continue
            
            tentative_g = g_score + weight
            
            if neighbor not in g_scores or tentative_g < g_scores[neighbor]:
                g_scores[neighbor] = tentative_g
                f_score = tentative_g + heuristic(neighbor)
                heapq.heappush(open_set, (f_score, tentative_g, neighbor, path + [neighbor]))
    
    return None  # No path found


def sakay_route_cost(path, nodes, adj, dynamic_routes=None, weather_data=None):
    """
    SAKAY ALGORITHM: Calculate total route cost.
    
    Route Cost = 
        travel_time_min × 1.0
      + waiting_time_min × 1.5
      + walking_time_min × 2.0
      + transfers × 5.0
      + fare_php × 0.5
      + crowding_penalty × 3.0
      + unreliability × 8.0
      + weather_penalty × 5.0
      + complexity × 2.0
    """
    if not path or len(path) < 2:
        return float('inf')
    
    total_cost = 0.0
    transfers = 0
    previous_mode = None
    previous_line = None
    total_fare = 0.0
    total_time = 0.0
    walking_time = 0.0
    
    for i in range(len(path) - 1):
        node1 = path[i]
        node2 = path[i + 1]
        
        # Get edge info
        if node1 not in adj:
            continue
        
        edge = None
        for e in adj[node1]:
            if e[0] == node2:
                edge = e
                break
        
        if not edge:
            continue
        
        weight = edge[1]  # Time in minutes
        mode = edge[3] if len(edge) >= 4 else "unknown"
        line = edge[2] if len(edge) >= 3 else ""
        
        # Count transfers
        if previous_mode is not None and mode != previous_mode:
            transfers += 1
        elif mode == "rail" and previous_line is not None and line != previous_line:
            transfers += 1
        
        # Calculate cost components
        if mode == "walk":
            cost = weight * 2.0  # Walking is expensive
            walking_time += weight
        elif mode == "rail":
            cost = weight * 1.0  # Rail is fast
            # Check for crowding (rush hour penalty)
            import datetime
            current_hour = datetime.datetime.now().hour
            if 7 <= current_hour <= 9 or 17 <= current_hour <= 19:
                cost += weight * 0.3  # 30% crowding penalty during rush hour
        elif mode == "jeepney":
            cost = weight * 1.0
            # Check if unverified
            route_name = line
            if dynamic_routes and route_name in dynamic_routes:
                route_info = dynamic_routes[route_name]
                if not route_info.get("is_verified", False):
                    cost *= 3.0  # Unverified penalty
                # Add unreliability from ML
                reliability = route_info.get("reliability", 1.0)
                if reliability < 1.0:
                    cost += weight * (1.0 - reliability) * 8.0
        else:
            cost = weight * 1.0
        
        total_cost += cost
        total_time += weight
        
        previous_mode = mode
        previous_line = line
    
    # Add transfer penalty
    total_cost += transfers * 5.0
    
    # Add waiting time (estimated 5 min per transfer)
    total_cost += transfers * 5 * 1.5  # waiting_time × 1.5
    
    # Add weather penalty if provided
    if weather_data:
        weather_condition = weather_data.get("condition", "clear")
        if weather_condition == "rain":
            total_cost += 15.0  # 5.0 × 3 weather severity
        elif weather_condition == "heavy_rain":
            total_cost += 25.0
        elif weather_condition == "thunderstorm":
            total_cost += 35.0
    
    # Add complexity penalty (for paths with many segments)
    total_cost += transfers * 2.0  # complexity
    
    return total_cost

def biyahe_score(path, nodes, adj, dynamic_routes=None, weather_data=None):
    """
    BIYAHE SCORE: Calculate route quality score (0-100).
    
    biyahe_score = max(0, min(100, (1 - total_penalty) × 100))
    """
    if not path or len(path) < 2:
        return 0.0
    
    # Calculate journey metrics
    total_time = 0.0
    total_fare = 0.0
    transfers = 0
    previous_mode = None
    previous_line = None
    
    for i in range(len(path) - 1):
        node1 = path[i]
        node2 = path[i + 1]
        
        if node1 not in adj:
            continue
        
        edge = None
        for e in adj[node1]:
            if e[0] == node2:
                edge = e
                break
        
        if not edge:
            continue
        
        weight = edge[1]
        mode = edge[3] if len(edge) >= 4 else "unknown"
        line = edge[2] if len(edge) >= 3 else ""
        
        total_time += weight
        
        # Estimate fare
        if mode == "rail":
            # Rail fare from matrix
            if len(path) > 0:
                # Simplified: use distance-based estimate
                dist_km = weight / 60 * 35  # 35 km/h
                total_fare += 15 + dist_km * 2
        elif mode == "jeepney":
            dist_km = weight / 60 * 15  # 15 km/h
            total_fare += 13 + dist_km * 2.2
        
        # Count transfers
        if previous_mode is not None and mode != previous_mode:
            transfers += 1
        elif mode == "rail" and previous_line is not None and line != previous_line:
            transfers += 1
        
        previous_mode = mode
        previous_line = line
    
    # Calculate penalties
    transfer_penalty = min(transfers * 0.07, 0.25)
    time_penalty = min(max((total_time - 45) / 180, 0), 0.25)
    # Only apply fare penalty if fare was actually calculated
    if total_fare > 0:
        fare_penalty = min(max((total_fare - 40) / 120, 0), 0.15)
    else:
        fare_penalty = 0
    
    # Weather penalty
    weather_penalty = 0.0
    if weather_data:
        condition = weather_data.get("condition", "clear")
        if condition == "rain":
            weather_penalty = 0.15
        elif condition == "heavy_rain":
            weather_penalty = 0.25
        elif condition == "thunderstorm":
            weather_penalty = 0.35
    
    # Time of day penalty
    import datetime
    current_hour = datetime.datetime.now().hour
    if 7 <= current_hour <= 9 or 17 <= current_hour <= 19:
        time_of_day_penalty = 0.15  # Rush hour
    elif 10 <= current_hour <= 15:
        time_of_day_penalty = 0.05  # Midday
    else:
        time_of_day_penalty = 0.10  # Night/off-peak
    
    # ML reliability penalty
    ml_penalty = 0.0
    if dynamic_routes:
        for i in range(len(path) - 1):
            node1 = path[i]
            node2 = path[i + 1]
            if node1 in adj:
                for e in adj[node1]:
                    if e[0] == node2 and len(e) >= 3:
                        route_name = e[2]
                        if route_name in dynamic_routes:
                            reliability = dynamic_routes[route_name].get("reliability", 1.0)
                            ml_penalty = max(ml_penalty, (1.0 - reliability) * 0.15)
    
    # Calculate total penalty
    total_penalty = (
        transfer_penalty +
        time_penalty +
        fare_penalty +
        weather_penalty +
        time_of_day_penalty +
        ml_penalty
    )
    
    # Calculate score
    score = max(0, min(100, (1 - total_penalty) * 100))
    
    return score


# ============================================
# DYNAMIC SELF-IMPROVING LAYER
# ============================================

_dynamic_ml_stats = None
_ml_cache_timestamp = 0
_ML_CACHE_TTL = 300  # 5 minutes

def fetch_ml_stats(supabase):
    """
    Fetch ML stats from route_ml_stats table for dynamic weights.
    
    Returns: {
        route_name: {
            "avg_speed": float,
            "reliability": float (0-1),
            "wait_time_min": float,
            "num_trips": int,
            "last_updated": timestamp
        }
    }
    """
    global _dynamic_ml_stats, _ml_cache_timestamp
    
    # Check cache
    import datetime
    now = datetime.datetime.now().timestamp()
    if _dynamic_ml_stats and (now - _ml_cache_timestamp) < _ML_CACHE_TTL:
        return _dynamic_ml_stats
    
    if not supabase:
        return {}
    
    try:
        url = f"{supabase['url']}/rest/v1/route_ml_stats?limit=500"
        req = urllib_request.Request(url, headers={"apikey": supabase["key"], "Authorization": f"Bearer {supabase['key']}"})
        with urllib_request.urlopen(req, timeout=10) as resp:
            response_data = json.loads(resp.read())
        response = type('obj', (object,), {'data': response_data})()
        
        stats = {}
        for row in response.data:
            route_name = row.get("route_name", "")
            if route_name:
                stats[route_name] = {
                    "avg_speed": row.get("avg_speed_kmh", 15),
                    "reliability": row.get("reliability_score", 0.7),
                    "wait_time": row.get("avg_wait_time_min", 5),
                    "num_trips": row.get("num_trips", 0),
                }
        
        _dynamic_ml_stats = stats
        _ml_cache_timestamp = now
        logger.info(f"Loaded {len(stats)} ML stats from Supabase")
        return stats
    except Exception as e:
        logger.warning(f"Failed to fetch ML stats: {e}")
        return {}

def apply_ml_weights(adj, ml_stats):
    """
    Apply ML-based weights to graph edges.
    
    For each edge with a route name in ml_stats:
    - Adjust speed based on actual average speed
    - Apply reliability penalty for unreliable routes
    - Add wait time for boarding
    """
    if not ml_stats:
        return adj
    
    adj_weighted = {}
    for node_id, edges in adj.items():
        adjusted_edges = []
        for edge in edges:
            if len(edge) < 4:
                adjusted_edges.append(edge)
                continue
            
            to_node, weight, route_name, mode = edge[0], edge[1], edge[2], edge[3]
            
            # Check if this edge's route has ML stats
            if route_name in ml_stats:
                stats = ml_stats[route_name]
                
                # Adjust speed
                avg_speed = stats.get("avg_speed", 15)
                if avg_speed > 0 and mode in ("jeepney", "jeepney_verified", "jeepney_unverified"):
                    # Base speed for jeepney is 15 km/h
                    speed_factor = 15 / avg_speed
                    weight *= speed_factor
                
                # Apply reliability penalty
                reliability = stats.get("reliability", 0.7)
                if reliability < 0.7:
                    # Unreliable route - add penalty
                    weight *= (1 + (0.7 - reliability) * 2)
                
                # Add wait time for boarding
                wait_time = stats.get("wait_time", 5)
                if mode in ("jeepney", "jeepney_verified", "jeepney_unverified"):
                    weight += wait_time
            
            adjusted_edges.append([to_node, weight, route_name, mode])
        
        adj_weighted[node_id] = adjusted_edges
    
    return adj_weighted

def update_ml_stats_from_commute(route_name, actual_time_min, user_rating=None):
    """
    Update ML stats based on actual user commute data.
    Called when a user completes a journey.
    """
    supabase = get_supabase_client()
    if not supabase:
        return
    
    try:
        # Fetch existing stats
        existing = supabase.table("route_ml_stats").select("*").eq("route_name", route_name).execute()
        
        if existing.data:
            # Update existing stats
            row = existing.data[0]
            old_num_trips = row.get("num_trips", 0)
            old_avg_time = row.get("avg_time_sec", actual_time_min * 60)
            
            new_num_trips = old_num_trips + 1
            new_avg_time = (old_avg_time * old_num_trips + actual_time_min * 60) / new_num_trips
            
            supabase.table("route_ml_stats").update({
                "avg_time_sec": new_avg_time,
                "num_trips": new_num_trips,
                "reliability_score": min(1.0, 0.5 + new_num_trips / 100),
            }).eq("route_name", route_name).execute()
        else:
            # Insert new stats
            supabase.table("route_ml_stats").insert({
                "route_name": route_name,
                "avg_time_sec": actual_time_min * 60,
                "num_trips": 1,
                "reliability_score": 0.51,
            }).execute()
        
        # Invalidate cache
        global _dynamic_ml_stats
        _dynamic_ml_stats = None
        
        logger.info(f"Updated ML stats for {route_name}: {actual_time_min} min")
    except Exception as e:
        logger.warning(f"Failed to update ML stats: {e}")

# ============================================
# DYNAMIC GRAPH REFRESH
# ============================================

def refresh_graph_if_needed():
    """
    Check if graph needs refresh from Supabase.
    Returns True if graph was refreshed.
    """
    global _graph, _nodes, _graph_loaded_at
    
    import datetime
    now = datetime.datetime.now().timestamp()
    
    # Refresh if graph is older than 1 hour
    if (now - _graph_loaded_at) > 3600:
        logger.info("Graph stale (>1 hour), refreshing from Supabase...")
        new_graph, new_nodes = load_graph_from_supabase()
        if new_graph and new_nodes:
            _graph = new_graph
            _nodes = new_nodes
            _graph_loaded_at = now
            return True
    
    return False

def lambda_handler(event, context):
    if isinstance(event, dict) and event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
            },
            'body': ''
        }
    
    try:
        if isinstance(event, str):
            body = json.loads(event)
        elif 'body' in event and event.get('body'):
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            body = event
        
        message = body.get('message', '')
        user_location = body.get('user_location', {})
        
        # Initialize Supabase client for dynamic data
        supabase = get_supabase_client()
        
        # Fetch dynamic data
        dynamic_pois = fetch_dynamic_pois(supabase)
        dynamic_nlp_terms = fetch_dynamic_nlp_terms(supabase)
        dynamic_routes = fetch_dynamic_routes(supabase)
        
        # Apply NLP terms to message
        message = parse_with_nlp_terms(message, dynamic_nlp_terms)
        
        adj, nodes = load_graph()
        
        # Apply dynamic route weights
        if dynamic_routes:
            adj = apply_dynamic_route_weights(adj, dynamic_routes)
        
        origin_lat = None
        origin_lng = None
        dest_lat = None
        dest_lng = None
        
        import re
        
        # Parse "from X to Y"
        m = re.search(r'from\s+(.+?)\s+to\s+(.+)', message, re.IGNORECASE)
        if m:
            origin_name = m.group(1).strip().lower()
            dest_name = m.group(2).strip().lower()
            logger.info(f"Parsed: origin='{origin_name}' dest='{dest_name}'")
            
            if origin_name == 'here' and user_location:
                origin_lat = float(user_location.get('lat', 14.6225))
                origin_lng = float(user_location.get('lng', 121.0538))
                logger.info(f"Using user location: {origin_lat}, {origin_lng}")
            else:
                # Try POIs first
                origin_lat, origin_lng, origin_poi_name = geocode_with_pois(origin_name, dynamic_pois)
                if origin_poi_name:
                    logger.info(f"Origin '{origin_name}' -> POI: {origin_poi_name}")
                else:
                    # Fallback to Nominatim
                    origin_lat, origin_lng, origin_poi_name = geocode_with_nominatim(origin_name)
                    if origin_poi_name:
                        logger.info(f"Origin '{origin_name}' -> Nominatim: {origin_poi_name}")
                    else:
                        logger.warning(f"Failed to geocode origin '{origin_name}'")
            
            # Geocode destination
            dest_lat, dest_lng, dest_poi_name = geocode_with_pois(dest_name, dynamic_pois)
            if dest_poi_name:
                logger.info(f"Destination '{dest_name}' -> POI: {dest_poi_name}")
            else:
                dest_lat, dest_lng, dest_poi_name = geocode_with_nominatim(dest_name)
                if dest_poi_name:
                    logger.info(f"Destination '{dest_name}' -> Nominatim: {dest_poi_name}")
                else:
                    logger.warning(f"Failed to geocode destination '{dest_name}'")
        
        # Parse "X to Y" without "from"
        if (origin_lat is None or dest_lat is None) and ' to ' in message:
            parts = message.lower().split(' to ')
            if len(parts) == 2:
                origin_name = parts[0].strip()
                dest_name = parts[1].strip()
                logger.info(f"Parsed (no 'from'): origin='{origin_name}' dest='{dest_name}'")
                
                # Try POIs first for origin
                origin_lat, origin_lng, origin_poi_name = geocode_with_pois(origin_name, dynamic_pois)
                if not origin_poi_name:
                    # Fallback to Nominatim
                    origin_lat, origin_lng, origin_poi_name = geocode_with_nominatim(origin_name)
                    if origin_poi_name:
                        logger.info(f"Origin '{origin_name}' -> Nominatim")
                
                # Try POIs first for destination
                dest_lat, dest_lng, dest_poi_name = geocode_with_pois(dest_name, dynamic_pois)
                if not dest_poi_name:
                    # Fallback to Nominatim
                    dest_lat, dest_lng, dest_poi_name = geocode_with_nominatim(dest_name)
                    if dest_poi_name:
                        logger.info(f"Destination '{dest_name}' -> Nominatim")
        
        # Destination only with fuzzy matching (only if both still None)
        if origin_lat is None and dest_lat is None:
            dest_name = message.strip().lower()
            if dest_name in KNOWN_PLACES:
                dest_lat, dest_lng = KNOWN_PLACES[dest_name][1], KNOWN_PLACES[dest_name][2]
                if user_location:
                    origin_lat = float(user_location.get('lat', 14.6225))
                    origin_lng = float(user_location.get('lng', 121.0538))
                else:
                    origin_lat, origin_lng = KNOWN_PLACES['cubao'][1], KNOWN_PLACES['cubao'][2]
            else:
                # Try Nominatim for destination only
                dest_lat, dest_lng, dest_poi_name = geocode_with_nominatim(dest_name)
                if dest_poi_name and user_location:
                    origin_lat = float(user_location.get('lat', 14.6225))
                    origin_lng = float(user_location.get('lng', 121.0538))
                elif not dest_poi_name:
                    for name, (label, plat, plng) in KNOWN_PLACES.items():
                        if name in dest_name or dest_name in name or dest_name.startswith(name):
                            dest_lat, dest_lng = plat, plng
                            origin_lat, origin_lng = KNOWN_PLACES['cubao'][1], KNOWN_PLACES['cubao'][2]
                            break
        
        if origin_lat is None or dest_lat is None:
            return error_response(f'Could not find: {message}')
        
        # Try rail station matching first for better connectivity
        start = find_rail_station_node(origin_name if 'origin_name' in dir() else '', nodes)
        end = find_rail_station_node(dest_name if 'dest_name' in dir() else '', nodes)
        
        if not start:
            start = find_nearest_node(origin_lat, origin_lng, nodes)
        if not end:
            end = find_nearest_node(dest_lat, dest_lng, nodes)
        
        if not start or not end:
            return error_response('Could not find route nodes')
        
        # Fetch weather before routing (affects path choice)
        weather_code = 0
        precipitation = 0
        try:
            weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={dest_lat}&longitude={dest_lng}&current=weather_code,precipitation&timezone=Asia/Manila"
            weather_req = ur.Request(weather_url, headers={'User-Agent': 'ParaPH/3.0'})
            with ur.urlopen(weather_req, timeout=3) as wr:
                wd = json.loads(wr.read())
                weather_code = wd.get('current', {}).get('weather_code', 0)
                precipitation = wd.get('current', {}).get('precipitation', 0)
        except:
            weather_code = 0
            precipitation = 0
        
        weather_penalty = 0
        if weather_code >= 95: weather_penalty = 0.35
        elif weather_code >= 61: weather_penalty = 0.25
        elif weather_code >= 51: weather_penalty = 0.15
        elif weather_code in [45, 48]: weather_penalty = 0.10
        elif precipitation > 0: weather_penalty = 0.12
        
        current_hour = datetime.datetime.now().hour
        if 6 <= current_hour <= 9 or 17 <= current_hour <= 20:
            time_of_day_penalty = 0.15
        elif 10 <= current_hour <= 16:
            time_of_day_penalty = 0.05
        elif 21 <= current_hour or current_hour <= 5:
            time_of_day_penalty = 0.10
        else:
            time_of_day_penalty = 0
        
        # ── Dynamic Route Weights from ph_routes ──
        dynamic_route_weights = {}
        try:
            supabase_url = os.environ.get("SUPABASE_URL", "")
            supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
            
            if supabase_url and supabase_key:
                # Fetch verified routes (weight 1.0)
                verified_url = f"{supabase_url}/rest/v1/ph_routes?select=name,reliability_score&is_approved=eq.true&limit=2000"
                verified_req = ur.Request(verified_url, headers={'apikey': supabase_key, 'Authorization': f'Bearer {supabase_key}'})
                with ur.urlopen(verified_req, timeout=5) as vr:
                    verified_routes = json.loads(vr.read())
                    for route in verified_routes:
                        name = route.get('name', '')
                        if name:
                            dynamic_route_weights[name] = {
                                'weight_multiplier': 1.0,
                                'reliability': route.get('reliability_score', 0.5),
                            }
                
                # Fetch unverified routes (weight 1.3)
                unverified_url = f"{supabase_url}/rest/v1/ph_routes?select=name,reliability_score&is_approved=eq.false&limit=2000"
                unverified_req = ur.Request(unverified_url, headers={'apikey': supabase_key, 'Authorization': f'Bearer {supabase_key}'})
                with ur.urlopen(unverified_req, timeout=5) as ur_resp:
                    unverified_routes = json.loads(ur_resp.read())
                    for route in unverified_routes:
                        name = route.get('name', '')
                        if name:
                            dynamic_route_weights[name] = {
                                'weight_multiplier': 3.0,
                                'reliability': route.get('reliability_score', 0.3),
                            }
                
                logger.info(f"Loaded {len(dynamic_route_weights)} dynamic route weights")
        except Exception as e:
            logger.warning(f"Failed to load dynamic route weights: {e}")
        
        # ── ML: Learn from route_ml_stats and adjust edge weights ──
        ml_weights = {}
        try:
            SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
            KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
            
            # Fetch ML stats for routes near origin and destination
            ml_url = f"{SUPABASE_URL}/rest/v1/route_ml_stats?select=route_name,avg_time_sec,num_trips,reliability_score&limit=500"
            ml_req = ur.Request(ml_url, headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}'})
            with ur.urlopen(ml_req, timeout=3) as mr:
                ml_stats = json.loads(mr.read())
                for stat in ml_stats:
                    route_name = stat.get('route_name', '')
                    avg_time = stat.get('avg_time_sec', 0)
                    num_trips = stat.get('num_trips', 0)
                    reliability = stat.get('reliability_score', 0.5)
                    
                    # Build ML weight multiplier for this route
                    # More trips = more reliable = closer to actual avg
                    if num_trips >= 5 and avg_time > 0:
                        ml_weights[route_name] = {
                            'avg_time_min': avg_time / 60,
                            'num_trips': num_trips,
                            'reliability': reliability,
                        }
        except:
            ml_weights = {}
        
        # Build ML-adjusted adjacency for Dijkstra
        adj_ml = {}
        # Use original adj directly (ML weighting is handled by SAKAY cost)
        global _graph
        _graph = adj
        
        path = astar_search(start, end, max_time_min=150)
        
        if not path:
            return error_response('No path found')
        
        # Fetch station-line mapping and smooth track geometry
        station_to_line, line_geoms = fetch_station_line_mapping()
        
        # Build segments
        final_segments = build_segments_from_path(path, nodes, line_geoms)
        
        if not final_segments:
            return error_response('No segments found')
        
        # Fare calculation
        for seg in final_segments:
            seg['fare'] = seg_fare(seg)
        
        total_fare = sum(seg.get('fare', 0) for seg in final_segments)
        
        # Transfer penalty
        TRANSFER_PENALTY_MIN = 5.0
        transfer_count = len(final_segments) - 1
        transfer_time = transfer_count * TRANSFER_PENALTY_MIN
        
        # Wait times
        WAIT_TIMES = {'jeepney': 5, 'bus': 7, 'uv_express': 8, 'train': 3, 'lrt': 3, 'mrt': 3, 'walk': 0}
        wait_time_total = sum(WAIT_TIMES.get(seg.get('mode', 'jeepney'), 5) for seg in final_segments)
        
        total_time = round(sum(s['time_min'] for s in final_segments) + transfer_time + wait_time_total, 1)
        total_dist = round(sum(s['distance_km'] for s in final_segments), 2)
        
        # Weather penalty
        weather_penalty = 0
        try:
            weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={dest_lat}&longitude={dest_lng}&current=weather_code,precipitation&timezone=Asia/Manila"
            weather_req = ur.Request(weather_url, headers={'User-Agent': 'ParaPH/3.0'})
            with ur.urlopen(weather_req, timeout=3) as wr:
                wd = json.loads(wr.read())
                wc = wd.get('current', {}).get('weather_code', 0)
                if wc >= 95: weather_penalty = 0.35
                elif wc >= 61: weather_penalty = 0.25
                elif wc >= 51: weather_penalty = 0.15
                elif wc in [45, 48]: weather_penalty = 0.10
        except:
            weather_penalty = 0
        
        # Time of day
        current_hour = datetime.datetime.now().hour
        if 6 <= current_hour <= 9 or 17 <= current_hour <= 20:
            time_of_day_penalty = 0.15
        elif 10 <= current_hour <= 16:
            time_of_day_penalty = 0.05
        elif 21 <= current_hour or current_hour <= 5:
            time_of_day_penalty = 0.10
        else:
            time_of_day_penalty = 0
        
        # Biyahe Score
        transfer_penalty = min(transfer_count * 0.07, 0.25)
        time_penalty = min(max((total_time - 45) / 180, 0), 0.25)
        # Only apply fare penalty if fare was actually calculated
        # Only apply fare penalty if fare was actually calculated
        if total_fare > 0:
            fare_penalty = min(max((total_fare - 40) / 120, 0), 0.15)
        else:
            fare_penalty = 0
        # ML reliability penalty
        ml_penalty = 0
        for seg in final_segments:
            route_name = seg.get('route', '')
            if route_name in ml_weights:
                reliability = ml_weights[route_name]['reliability']
                ml_penalty += max(0, (0.5 - reliability))  # Routes below 0.5 reliability get penalized
        ml_penalty = min(ml_penalty, 0.15)
        
        total_penalty = transfer_penalty + time_penalty + fare_penalty + weather_penalty + time_of_day_penalty + ml_penalty
        score = max(0, min(100, int((1.0 - total_penalty) * 100)))
        
        # Alternatives
        alternatives = []
        if len(path) > 10:
            for skip_idx in [len(path)//3, 2*len(path)//3]:
                blocked = set()
                if skip_idx < len(path) - 1:
                    blocked.add((path[skip_idx], path[skip_idx+1]))
                alt_path = dijkstra_with_block(adj, start, end, blocked)
                if alt_path and len(alt_path) > 5:
                    alt_segments = build_segments_from_path(alt_path, nodes)
                    if alt_segments:
                        alt_time = round(sum(s['time_min'] for s in alt_segments) + transfer_time + wait_time_total, 1)
                        alt_fare = sum(seg_fare(s) for s in alt_segments)
                        alternatives.append({
                            'segments': alt_segments,
                            'total_time_min': alt_time,
                            'total_fare': round(alt_fare, 2),
                            'biyahe_score': max(0, min(100, int((1.0 - total_penalty) * 100))),
                            'transfers': len(alt_segments) - 1,
                        })
        
        # Mode summary
        mode_counts = {}
        for seg in final_segments:
            mode = seg.get('mode', 'jeepney')
            mode_counts[mode] = mode_counts.get(mode, 0) + 1
        mode_summary = ', '.join(f"{count} {mode}{'s' if count != 1 else ''}" for mode, count in mode_counts.items())
        
        start_name = 'Origin'
        end_name = 'Destination'
        if 'origin_poi_name' in locals() and origin_poi_name:
            start_name = origin_poi_name
        if 'dest_poi_name' in locals() and dest_poi_name:
            end_name = dest_poi_name
        
        start_point = {'lat': origin_lat, 'lng': origin_lng, 'name': start_name}
        end_point = {'lat': dest_lat, 'lng': dest_lng, 'name': end_name}
        
        # HARD LIMIT: Reject routes > 180 min total
        if total_time > 180:
            logger.warning(f"REJECTING absurd route: {total_time} min total")
            return error_response('No reasonable route found. Please try different locations.')
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'status': 'success',
                'route_data': {
                    'segments': final_segments,
                    'total_time_min': total_time,
                    'total_distance_km': total_dist,
                    'total_fare': round(total_fare, 2),
                    'transfers': transfer_count,
                    'biyahe_score': score,
                    'mode_summary': mode_summary,
                    'start_point': start_point,
                    'end_point': end_point,
                    'weather_penalty': weather_penalty,
                    'time_of_day_penalty': time_of_day_penalty,
                },
                'reply_text': 'Here are your commute options:',
                'alternatives': alternatives,
                'path': path,
                'path_length': len(path),
                'graph_nodes': len(adj),
            })
        }
    except Exception as e:
        logger.error(f"Error: {e}")
        return error_response(str(e))

def route_search_with_score(start_node, end_node, nodes, adj, dynamic_routes=None, weather_data=None):
    """
    Complete route search with SAKAY algorithm and BIYAHE score.
    """
    # Find path using A*
    path = astar_search(start_node, end_node, max_time_min=180)
    
    if not path:
        return None
    
    # Build segments
    segments = build_segments_from_path(path, nodes)
    
    # Calculate SAKAY cost
    sakay_cost = sakay_route_cost(path, nodes, adj, dynamic_routes, weather_data)
    
    # Calculate BIYAHE score
    score = biyahe_score(path, nodes, adj, dynamic_routes, weather_data)
    
    # Calculate totals with proper fare calculation
    total_time = 0
    total_fare = 0
    
    for seg in segments:
        total_time += seg.get("time_min", 0)
        
        # Calculate fare for each segment
        if seg.get("mode") == "rail":
            fare = seg_fare(seg)
            seg["fare"] = fare
            total_fare += fare
        elif seg.get("mode") == "jeepney":
            fare = seg.get("fare", 0)
            if fare == 0:
                # Estimate from distance
                dist_km = seg.get("distance_km", 0)
                fare = 13 + (dist_km * 2.20)
                seg["fare"] = round(fare, 2)
            total_fare += fare
    
    return {
        "segments": segments,
        "biyahe_score": round(score, 1),
        "sakay_cost": round(sakay_cost, 1),
        "total_time_min": round(total_time, 1),
        "total_fare": round(total_fare, 2),
        "path": path,
    }



def fetch_dynamic_nlp_terms(supabase):
    """Fetch NLP terms from nlp_terms table."""
    global _dynamic_nlp_terms
    if _dynamic_nlp_terms:
        return _dynamic_nlp_terms
    if not supabase:
        return {}
    try:
        url = f"{supabase['url']}/rest/v1/nlp_terms?limit=500"
        req = urllib_request.Request(url, headers={"apikey": supabase["key"], "Authorization": f"Bearer {supabase['key']}"})
        with urllib_request.urlopen(req, timeout=10) as resp:
            response_data = json.loads(resp.read())
        terms = {}
        for term in response_data:
            key = term.get("term", "").lower()
            if key:
                terms[key] = {"canonical": term.get("canonical_form", key), "type": term.get("term_type", "place"), "weight": term.get("weight", 1.0)}
        _dynamic_nlp_terms = terms
        return terms
    except Exception as e:
        logger.warning(f"Failed to fetch NLP terms: {e}")
        return {}

def fetch_dynamic_routes(supabase):
    """Fetch routes from ph_routes for dynamic weights."""
    global _dynamic_routes_cache
    if _dynamic_routes_cache:
        return _dynamic_routes_cache
    if not supabase:
        return {}
    try:
        url1 = f"{supabase['url']}/rest/v1/ph_routes?select=name,is_approved&is_approved=eq.true&limit=5000"
        req1 = urllib_request.Request(url1, headers={"apikey": supabase["key"], "Authorization": f"Bearer {supabase['key']}"})
        with urllib_request.urlopen(req1, timeout=10) as resp1:
            verified_data = json.loads(resp1.read())
        url2 = f"{supabase['url']}/rest/v1/ph_routes?select=name,is_approved&is_approved=eq.false&limit=5000"
        req2 = urllib_request.Request(url2, headers={"apikey": supabase["key"], "Authorization": f"Bearer {supabase['key']}"})
        with urllib_request.urlopen(req2, timeout=10) as resp2:
            unverified_data = json.loads(resp2.read())
        routes = {}
        for route in verified_data:
            name = route.get("name", "")
            if name:
                routes[name] = {"weight_multiplier": 1.0, "is_verified": True}
        for route in unverified_data:
            name = route.get("name", "")
            if name:
                routes[name] = {"weight_multiplier": 3.0, "is_verified": False}
        _dynamic_routes_cache = routes
        return routes
    except Exception as e:
        logger.warning(f"Failed to fetch routes: {e}")
        return {}


def apply_dynamic_route_weights(adj, dynamic_routes):
    """Apply dynamic weights to graph edges based on Supabase data."""
    if not dynamic_routes:
        return adj
    
    adj_weighted = {}
    for node_id, edges in adj.items():
        adjusted_edges = []
        for edge in edges:
            if len(edge) < 4:
                adjusted_edges.append(edge)
                continue
            
            to_node, weight, route_name, mode = edge[0], edge[1], edge[2], edge[3]
            
            if route_name in dynamic_routes:
                route_info = dynamic_routes[route_name]
                weight *= route_info.get("weight_multiplier", 1.0)
            
            adjusted_edges.append([to_node, weight, route_name, mode])
        
        adj_weighted[node_id] = adjusted_edges
    
    return adj_weighted
