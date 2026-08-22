import json
import gzip
import heapq
import math
import logging

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
    logger.info(f"Loaded graph: {len(_graph)} nodes")
    return _graph, _nodes

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a)) * 1000  # meters

def find_nearest_node(lat, lon, nodes):
    nearest = None
    min_dist = float('inf')
    for node_id, (n_lat, n_lon) in nodes.items():
        d = haversine(lat, lon, n_lat, n_lon)
        if d < min_dist:
            min_dist = d
            nearest = node_id
    return nearest

def dijkstra(adj, start, end):
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
        
        # Parse message
        import re
        
        origin_lat = None
        origin_lng = None
        dest_lat = None
        dest_lng = None
        
        # Check for "from X to Y"
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
            else:
                for name, (label, plat, plng) in KNOWN_PLACES.items():
                    if name in dest_name or dest_name in name or dest_name.startswith(name):
                        dest_lat, dest_lng = plat, plng
                        break
        
        # Check for "X to Y" without "from"
        if (origin_lat is None or dest_lat is None) and ' to ' in message:
            parts = message.lower().split(' to ')
            if len(parts) == 2:
                origin_name = parts[0].strip()
                dest_name = parts[1].strip()
                if origin_name in KNOWN_PLACES:
                    origin_lat, origin_lng = KNOWN_PLACES[origin_name][1], KNOWN_PLACES[origin_name][2]
                if dest_name in KNOWN_PLACES:
                    dest_lat, dest_lng = KNOWN_PLACES[dest_name][1], KNOWN_PLACES[dest_name][2]
        
        # Destination only - with fuzzy matching
        if dest_lat is None:
            dest_name = message.strip().lower()
            if dest_name in KNOWN_PLACES:
                dest_lat, dest_lng = KNOWN_PLACES[dest_name][1], KNOWN_PLACES[dest_name][2]
                origin_lat, origin_lng = KNOWN_PLACES['cubao'][1], KNOWN_PLACES['cubao'][2]
            else:
                # Fuzzy: check if any known place is in the query
                for name, (label, plat, plng) in KNOWN_PLACES.items():
                    if name in dest_name or dest_name in name or dest_name.startswith(name):
                        dest_lat, dest_lng = plat, plng
                        origin_lat, origin_lng = KNOWN_PLACES['cubao'][1], KNOWN_PLACES['cubao'][2]
                        break
        
        if origin_lat is None or dest_lat is None:
            return error_response(f'Could not find: {message}')
        
        # Find nodes
        start = find_nearest_node(origin_lat, origin_lng, nodes)
        end = find_nearest_node(dest_lat, dest_lng, nodes)
        
        if not start or not end:
            return error_response('Could not find route nodes')
        
        path = dijkstra(adj, start, end)
        
        if not path:
            return error_response('No path found')
        
        # Build segments by grouping consecutive nodes on same route
        segments = []
        current_route = None
        current_group = []
        
        for node_id in path:
            if '::' not in node_id:
                continue
            route = node_id.split('::')[0]
            if route != current_route:
                if current_group:
                    segments.append({'route': current_route, 'nodes': current_group})
                current_route = route
                current_group = [node_id]
            else:
                current_group.append(node_id)
        
        if current_group:
            segments.append({'route': current_route, 'nodes': current_group})
        
        # Build final route_data
        final_segments = []
        for seg in segments:
            coords = []
            for node_id in seg['nodes']:
                if node_id in nodes:
                    lat, lon = nodes[node_id]
                    coords.append([lat, lon])
            
            if len(coords) < 2:
                continue
            
            # Simplify
            coords = coords[::max(1, len(coords)//20)]
            
            # Calculate distance
            total_dist_km = 0
            for i in range(len(coords) - 1):
                total_dist_km += haversine(coords[i][0], coords[i][1], coords[i+1][0], coords[i+1][1]) / 1000
            
            time_min = max(total_dist_km / 25 * 60, 2)
            
            final_segments.append({
                'route': seg['route'],
                'mode': 'bus' if 'bus' in seg['route'].lower() else 'jeepney',
                'distance_km': round(total_dist_km, 2),
                'time_min': round(time_min, 1),
                'geometry': coords,
                'type': 'transit',
            })
        
        # Complete Sakay algorithm
        FARES = {
            'jeepney': 13.0,  # base minimum
            'bus': 15.0,      # aircon
            'uv_express': 25.0,
            'train': 20.0,
            'lrt': 20.0,
            'mrt': 20.0,
            'walk': 0.0,
        }
        
        MODE_SPEEDS = {
            'jeepney': 25,    # km/h
            'bus': 30,
            'uv_express': 40,
            'train': 45,
            'lrt': 35,
            'mrt': 40,
            'walk': 4.5,
        }
        
        # Recalculate time with proper speeds
        for seg in final_segments:
            mode = seg.get('mode', 'jeepney')
            speed = MODE_SPEEDS.get(mode, 25)
            seg['time_min'] = round(seg['distance_km'] / speed * 60, 1)
        
        # Transfer penalty
        TRANSFER_PENALTY_MIN = 5.0
        transfer_count = len(final_segments) - 1
        transfer_time = transfer_count * TRANSFER_PENALTY_MIN
        
        # Fare with distance-based jeepney
        for seg in final_segments:
            if seg.get('mode') == 'jeepney':
                # Jeepney: ₱13 first 5km, +₱1.50/km after
                d = seg.get('distance_km', 0)
                seg_fare = 13.0 if d <= 5 else 13.0 + (d - 5) * 1.5
                seg['fare'] = round(seg_fare, 2)
            elif seg.get('mode') == 'bus':
                d = seg.get('distance_km', 0)
                seg_fare = 15.0 if d <= 5 else 15.0 + (d - 5) * 2.0
                seg['fare'] = round(seg_fare, 2)
            else:
                seg['fare'] = FARES.get(seg.get('mode', 'jeepney'), 13.0)
        
        total_fare = 0
        for seg in final_segments:
            mode = seg.get('mode', 'jeepney')
            total_fare += FARES.get(mode, 13.0)
        
        total_time = round(sum(s['time_min'] for s in final_segments) + (len(final_segments) - 1) * 5, 1)  # 5min transfer penalty
        total_dist = round(sum(s['distance_km'] for s in final_segments), 2)
        
        # Biyahe score: 0-100 rating
        transfer_penalty = (len(final_segments) - 1) * 0.15
        walk_penalty = 0  # no walk segments in current graph
        score = max(0, min(100, int((1.0 - transfer_penalty - walk_penalty) * 100)))
        
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
                    'transfers': len(final_segments) - 1,
                    'start_point': {'lat': origin_lat, 'lng': origin_lng, 'name': 'Origin'},
                    'end_point': {'lat': dest_lat, 'lng': dest_lng, 'name': 'Destination'},
                    'biyahe_score': score,
                },
                'reply_text': 'Here are your commute options:',
                'path': path,
                'path_length': len(path),
                'graph_nodes': len(adj),
            })
        }
    except Exception as e:
        logger.error(f"Error: {e}")
        return error_response(str(e))
