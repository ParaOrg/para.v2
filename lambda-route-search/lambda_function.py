import json
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
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    print("Supabase client not available, using static graph only")

logger = logging.getLogger()
logger.setLevel(logging.INFO)

KNOWN_PLACES = {
    'naia': ('NAIA Terminal 3', 14.5086, 121.0194),
    'cubao': ('Cubao', 14.6225, 121.0538),
    'makati': ('Makati', 14.5547, 121.0244),
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
    """Create Supabase client if credentials are available."""
    if not SUPABASE_AVAILABLE:
        return None
    
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    
    if not url or not key:
        return None
    
    try:
        return create_client(url, key)
    except:
        return None

def fetch_dynamic_pois(supabase):
    """Fetch POIs from ph_places table for geocoding."""
    global _dynamic_pois, _cache_timestamp
    
    if _dynamic_pois and (datetime.datetime.now().timestamp() - _cache_timestamp) < _CACHE_TTL:
        return _dynamic_pois
    
    if not supabase:
        return {}
    
    try:
        response = supabase.table("ph_places").select("name,lat,lng,poi_type,relevance_score").gte("relevance_score", 10).execute()
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
        logger.warning(f"Failed to fetch POIs: {e}")
        return {}

def fetch_dynamic_nlp_terms(supabase):
    """Fetch NLP terms from nlp_terms table for Taglish parsing."""
    global _dynamic_nlp_terms
    
    if _dynamic_nlp_terms:
        return _dynamic_nlp_terms
    
    if not supabase:
        return {}
    
    try:
        response = supabase.table("nlp_terms").select("term,canonical_form,term_type,weight").execute()
        terms = {}
        for term in response.data:
            key = term.get("term", "").lower()
            if key:
                terms[key] = {
                    "canonical": term.get("canonical_form", key),
                    "type": term.get("term_type", "place"),
                    "weight": term.get("weight", 1.0),
                }
        _dynamic_nlp_terms = terms
        logger.info(f"Loaded {len(terms)} NLP terms from Supabase")
        return terms
    except Exception as e:
        logger.warning(f"Failed to fetch NLP terms: {e}")
        return {}

def fetch_dynamic_routes(supabase):
    """Fetch verified and unverified routes from ph_routes for dynamic weights."""
    global _dynamic_routes_cache
    
    if _dynamic_routes_cache:
        return _dynamic_routes_cache
    
    if not supabase:
        return {}
    
    try:
        # Fetch verified routes (weight 1.0)
        verified = supabase.table("ph_routes").select("route_name,is_approved,avg_speed_kmh").eq("is_approved", True).execute()
        
        # Fetch unverified routes (weight 1.3)
        unverified = supabase.table("ph_routes").select("route_name,is_approved,avg_speed_kmh").eq("is_approved", False).execute()
        
        routes = {}
        for route in verified.data:
            name = route.get("route_name", "")
            if name:
                routes[name] = {
                    "weight_multiplier": 1.0,
                    "is_verified": True,
                    "avg_speed": route.get("avg_speed_kmh", 15),
                }
        
        for route in unverified.data:
            name = route.get("route_name", "")
            if name:
                routes[name] = {
                    "weight_multiplier": 3.0,  # Unverified penalty (was 1.3, too weak)
                    "is_verified": False,
                    "avg_speed": route.get("avg_speed_kmh", 12),
                }
        
        _dynamic_routes_cache = routes
        logger.info(f"Loaded {len(routes)} routes from Supabase (verified: {sum(1 for r in routes.values() if r['is_verified'])}, unverified: {sum(1 for r in routes.values() if not r['is_verified'])})")
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
            v, w = edge[0], edge[1]
            route_name = v.split('::')[0] if '::' in v else ''
            
            if route_name in dynamic_routes:
                route_info = dynamic_routes[route_name]
                w *= route_info["weight_multiplier"]
                
                # Adjust for speed if available
                avg_speed = route_info.get("avg_speed", 15)
                if avg_speed > 0:
                    # Speed adjustment: faster routes get lower effective weight
                    speed_factor = 15 / avg_speed
                    w *= speed_factor
            
            adjusted_edges.append([v, w])
        adj_weighted[node_id] = adjusted_edges
    
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
    if _graph is not None:
        return _graph, _nodes
    with gzip.open('graph_full.json.gz', 'rt') as f:
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

def find_nearest_node(lat, lon, nodes):
    nearest = None
    min_dist = float('inf')
    for node_id, (n_lat, n_lon) in nodes.items():
        d = haversine(lat, lon, n_lat, n_lon)
        if d < min_dist:
            min_dist = d
            nearest = node_id
    return nearest

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


def build_segments_from_path(path, nodes, line_geoms=None):
    segments = []
    current_route = None
    current_group = []
    
    def append_segment(route_name, group, node_list):
        """Build and append a segment from a group of nodes."""
        if not route_name or not group:
            return
        coords = [node_list[n] for n in group if n in node_list]
        if len(coords) < 2:
            return
        
        route_lower = route_name.lower()
        # Only treat as rail if route_name is EXACTLY "rail" (graph node prefix)
        # Bus routes like "Alabang - Malanday via EDSA LRT" should NOT be rail
        if route_lower == 'rail' or route_lower.startswith('rail::'):
            mode = 'rail'
            # Extract station names, filtering out None and entrances
            stations = []
            for n in group:
                if '::' not in n:
                    continue
                station = n.split('::')[1].replace('_', ' ').replace('  ', ' ').strip()
                # Skip coordinate-looking names and None
                if station and station.lower() not in ('none', 'null', '') and 'entrance' not in station.lower():
                    # Skip if station looks like coordinates (contains digits and dots)
                    # Only skip if the ENTIRE station name is a coordinate (contains dots AND digits)
                    if not ('.' in station and any(c.isdigit() for c in station)):
                        if station not in stations:
                            stations.append(station)
            
            if stations:
                # Determine line from station names
                first_station = stations[0].lower()
                last_station = stations[-1].lower()
                
                # Dynamic line detection based on station names
                line_name = None
                # The station_to_line dict is fetched dynamically in the handler
                # But for the label, we can infer from station positions
                if any(s in first_station for s in ('katipunan', 'anonas', 'santolan', 'marikina', 'antipolo', 'recto', 'legarda', 'pureza', 'v. mapa', 'j. ruiz', 'gilmore', 'betty go')):
                    line_name = 'LRT-2'
                elif any(s in first_station for s in ('north avenue', 'quezon avenue', 'gma kamuning', 'araneta center - cubao', 'ortigas', 'shaw', 'boni', 'guadalupe', 'buendia', 'ayala', 'magallanes', 'taft')):
                    line_name = 'MRT-3'
                elif any(s in first_station for s in ('fernando poe', 'balintawak', 'monumento', '5th avenue', 'r. papa', 'abad santos', 'blumentritt', 'tayuman', 'bambang', 'doroteo jose', 'carriedo', 'united nations', 'pedro gil', 'quirino', 'vito cruz', 'gil puyat', 'libertad', 'edsa', 'baclaran', 'redemptorist', 'mia road', 'pitx', 'ninoy aquino', 'dr. santos')):
                    line_name = 'LRT-1'
                
                if line_name:
                    route_label = f"Take {line_name} from {stations[0]} to {stations[-1]}"
                else:
                    route_label = f"Take Rail from {stations[0]} to {stations[-1]}"
            else:
                route_label = route_name
            
            # Use smooth rail geometry from Supabase - subset to between start/end stations
            if line_geoms and line_name and stations:
                supabase_line_map = {
                    'LRT-1': 'LRT Line 1',
                    'LRT-2': 'LRT Line 2',
                    'MRT-3': 'MRT Line 3',
                }
                supabase_line = supabase_line_map.get(line_name)
                if supabase_line and supabase_line in line_geoms:
                    line_coords = line_geoms[supabase_line]
                    smooth = [[c[1], c[0]] for c in line_coords if len(c) >= 2]
                    if len(smooth) >= 2:
                        # Find the station coordinates in the smooth geometry
                        first_st = stations[0]
                        last_st = stations[-1]
                        first_coord = None
                        last_coord = None
                        # Find nearest smooth geometry points to start/end stations
                        for n in group:
                            if '::' in n:
                                st_name = n.split('::')[1].strip()
                                if st_name == first_st:
                                    node_coords = node_list.get(n)
                                    if node_coords:
                                        first_coord = node_coords
                                if st_name == last_st:
                                    node_coords = node_list.get(n)
                                    if node_coords:
                                        last_coord = node_coords
                        
                        if first_coord and last_coord:
                            # Find indices in smooth geometry closest to station coords
                            min_start_dist = float('inf')
                            min_end_dist = float('inf')
                            start_idx = 0
                            end_idx = len(smooth) - 1
                            for i, sc in enumerate(smooth):
                                d_start = haversine(first_coord[0], first_coord[1], sc[0], sc[1])
                                d_end = haversine(last_coord[0], last_coord[1], sc[0], sc[1])
                                if d_start < min_start_dist:
                                    min_start_dist = d_start
                                    start_idx = i
                                if d_end < min_end_dist:
                                    min_end_dist = d_end
                                    end_idx = i
                            
                            # Subset between start and end (handle both directions)
                            if start_idx <= end_idx:
                                coords = smooth[start_idx:end_idx+1]
                            else:
                                coords = smooth[end_idx:start_idx+1][::-1]
                            
                            # ALWAYS ensure first and last points are EXACTLY the station coords
                            if coords and len(coords) >= 2:
                                coords[0] = first_coord
                                coords[-1] = last_coord
                            else:
                                coords = [first_coord, last_coord]
        else:
            mode = 'bus' if 'bus' in route_lower else 'jeepney'
            route_label = route_name
        
        dist = sum(haversine(coords[i][0], coords[i][1], coords[i+1][0], coords[i+1][1]) for i in range(len(coords)-1)) / 1000
        time_min = max(dist / 25 * 60, 2)
        
        # SANITY CHECK: REJECT rail segments >60min entirely
        if mode == 'rail' and time_min > 60:
            logger.warning(f"REJECTING absurd rail segment: {route_label} ({time_min} min)")
            return  # Skip this segment entirely, don't add it
        
        segments.append({
            'route': route_label,
            'mode': mode,
            'distance_km': round(dist, 2),
            'time_min': round(time_min, 1),
            'geometry': coords,
            'type': 'transit'
        })
    
    # Transfer stations only split when the LINE changes
    # Araneta Center-Cubao = LRT-2/MRT-3 transfer
    # Doroteo Jose/Recto = LRT-1/LRT-2 transfer (but LRT-1 continues through Doroteo Jose)
    # EDSA/Taft = LRT-1/MRT-3 transfer
    transfer_stations = {'araneta center - cubao', 'recto', 'edsa', 'taft avenue'}
    
    for node_id in path:
        if '::' not in node_id:
            continue
        route = node_id.split('::')[0]
        station = node_id.split('::')[1].lower() if len(node_id.split('::')) > 1 else ''
        
        # Split at transfer stations to separate rail lines
        if route == 'rail' and station in transfer_stations and current_group:
            append_segment(current_route, current_group, nodes)
            current_route = route
            current_group = [node_id]
        elif route != current_route:
            append_segment(current_route, current_group, nodes)
            current_route = route
            current_group = [node_id]
        else:
            current_group.append(node_id)
    
    append_segment(current_route, current_group, nodes)
    return segments


def seg_fare(seg):
    mode = seg.get('mode', 'jeepney')
    d = seg.get('distance_km', 0)
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
        
        start = find_nearest_node(origin_lat, origin_lng, nodes)
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
        for node_id, edges in adj.items():
            adjusted_edges = []
            for edge in edges:
                v, w = edge[0], edge[1]
                route_name = v.split('::')[0] if '::' in v else ''
                
                # Apply dynamic route weights from ph_routes
                if route_name in dynamic_route_weights:
                    route_info = dynamic_route_weights[route_name]
                    w *= route_info['weight_multiplier']
                    
                    # Apply reliability penalty
                    reliability = route_info.get('reliability', 0.5)
                    if reliability < 0.5:
                        w *= (1.0 + (0.5 - reliability) * 0.5)
                
                # Apply ML learned multiplier if we have data
                if route_name in ml_weights:
                    ml_stat = ml_weights[route_name]
                    reliability_penalty = 1.0 + (1.0 - ml_stat['reliability']) * 0.3
                    w *= reliability_penalty
                
                adjusted_edges.append([v, w])
            adj_ml[node_id] = adjusted_edges
        
        path = dijkstra(adj_ml, start, end, weather_penalty, time_of_day_penalty, precipitation=precipitation)
        
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
        fare_penalty = min(max((total_fare - 40) / 120, 0), 0.15)
        
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
