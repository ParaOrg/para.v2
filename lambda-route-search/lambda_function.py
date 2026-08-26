import json
import gzip
import heapq
import math
import logging
import urllib.request as ur
import datetime

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

_graph = None
_nodes = None

def load_graph():
    global _graph, _nodes
    if _graph is not None:
        return _graph, _nodes
    with gzip.open('graph_full.json.gz', 'rt') as f:
        data = json.load(f)
    _graph = data['adj']
    _nodes = data['nodes']
    return _graph, _nodes

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

def build_segments_from_path(path, nodes):
    segments = []
    current_route = None
    current_group = []
    for node_id in path:
        if '::' not in node_id:
            continue
        route = node_id.split('::')[0]
        if route != current_route:
            if current_group:
                coords = [nodes[n] for n in current_group if n in nodes]
                if len(coords) >= 2:
                    dist = sum(haversine(coords[i][0], coords[i][1], coords[i+1][0], coords[i+1][1]) for i in range(len(coords)-1)) / 1000
                    time_min = max(dist / 25 * 60, 2)
                    segments.append({'route': current_route, 'mode': 'bus' if 'bus' in current_route.lower() else 'jeepney', 'distance_km': round(dist, 2), 'time_min': round(time_min, 1), 'geometry': coords, 'type': 'transit'})
            current_route = route
            current_group = [node_id]
        else:
            current_group.append(node_id)
    if current_group:
        coords = [nodes[n] for n in current_group if n in nodes]
        if len(coords) >= 2:
            dist = sum(haversine(coords[i][0], coords[i][1], coords[i+1][0], coords[i+1][1]) for i in range(len(coords)-1)) / 1000
            time_min = max(dist / 25 * 60, 2)
            segments.append({'route': current_route, 'mode': 'bus' if 'bus' in current_route.lower() else 'jeepney', 'distance_km': round(dist, 2), 'time_min': round(time_min, 1), 'geometry': coords, 'type': 'transit'})
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
        
        adj, nodes = load_graph()
        
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
            if origin_name == 'here' and user_location:
                origin_lat = float(user_location.get('lat', 14.6225))
                origin_lng = float(user_location.get('lng', 121.0538))
            elif origin_name in KNOWN_PLACES:
                origin_lat, origin_lng = KNOWN_PLACES[origin_name][1], KNOWN_PLACES[origin_name][2]
            if dest_name in KNOWN_PLACES:
                dest_lat, dest_lng = KNOWN_PLACES[dest_name][1], KNOWN_PLACES[dest_name][2]
        
        # Parse "X to Y" without "from"
        if (origin_lat is None or dest_lat is None) and ' to ' in message:
            parts = message.lower().split(' to ')
            if len(parts) == 2:
                origin_name = parts[0].strip()
                dest_name = parts[1].strip()
                for name, (label, plat, plng) in KNOWN_PLACES.items():
                    if name in origin_name or origin_name in name or origin_name.startswith(name):
                        origin_lat, origin_lng = plat, plng
                        break
                for name, (label, plat, plng) in KNOWN_PLACES.items():
                    if name in dest_name or dest_name in name or dest_name.startswith(name):
                        dest_lat, dest_lng = plat, plng
                        break
        
        # Destination only with fuzzy matching
        if dest_lat is None:
            dest_name = message.strip().lower()
            if dest_name in KNOWN_PLACES:
                dest_lat, dest_lng = KNOWN_PLACES[dest_name][1], KNOWN_PLACES[dest_name][2]
                origin_lat, origin_lng = KNOWN_PLACES['cubao'][1], KNOWN_PLACES['cubao'][2]
            else:
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
                
                # Apply ML learned multiplier if we have data
                if route_name in ml_weights:
                    ml_stat = ml_weights[route_name]
                    # Routes with lower reliability get penalty
                    reliability_penalty = 1.0 + (1.0 - ml_stat['reliability']) * 0.3
                    w *= reliability_penalty
                
                adjusted_edges.append([v, w])
            adj_ml[node_id] = adjusted_edges
        
        path = dijkstra(adj_ml, start, end, weather_penalty, time_of_day_penalty, precipitation=precipitation)
        
        if not path:
            return error_response('No path found')
        
        # Build segments
        final_segments = build_segments_from_path(path, nodes)
        
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
        
        start_point = {'lat': origin_lat, 'lng': origin_lng, 'name': 'Origin'}
        end_point = {'lat': dest_lat, 'lng': dest_lng, 'name': 'Destination'}
        
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
