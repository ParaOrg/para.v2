import json
import gzip
import heapq
import os
import boto3
from collections import defaultdict

# Load graph from S3 or Lambda layer
# For now, load from local file (will be uploaded as part of deployment package)

# Global cache - Lambda keeps this warm between invocations
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
    import math
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

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
        if d > dist.get(u, float('inf')):
            continue
        
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

KNOWN_PLACES = {
    'naia': ('NAIA Terminal 3', 14.5086, 121.0194),
    'naia terminal 3': ('NAIA Terminal 3', 14.5086, 121.0194),
    'airport': ('NAIA Terminal 3', 14.5086, 121.0194),
    'cubao': ('Cubao', 14.6225, 121.0538),
    'katipunan': ('Katipunan', 14.6225, 121.0785),
    'makati': ('Makati', 14.5547, 121.0244),
    'manila': ('Manila', 14.5995, 120.9842),
    'quezon city': ('Quezon City', 14.6760, 121.0437),
    'qc': ('Quezon City', 14.6760, 121.0437),
    'ortigas': ('Ortigas', 14.6091, 121.0223),
    'bgc': ('BGC', 14.5547, 121.0244),
    'alabang': ('Alabang', 14.4450, 121.0254),
    'pasay': ('Pasay', 14.5378, 120.9910),
    'upd': ('UPD', 14.6561, 121.0648),
    'ust': ('UST', 14.6101, 120.9894),
}

def geocode_place(place_name, nodes):
    """Find nearest graph node by place name substring match."""
    import re
    place_lower = place_name.lower().strip()
    
    # Check known places first
    if place_lower in KNOWN_PLACES:
        return KNOWN_PLACES[place_lower][1], KNOWN_PLACES[place_lower][2]
    
    matches = []
    for node_id, (n_lat, n_lon) in nodes.items():
        node_lower = node_id.lower()
        if place_lower in node_lower or node_lower in place_lower:
            matches.append((node_id, n_lat, n_lon))
    
    if matches:
        # Return the first match (or could average)
        return matches[0][1], matches[0][2]
    return None

def parse_text_query(message, nodes):
    """Parse 'from X to Y' into nearest node IDs."""
    import re
    m = re.search(r'from\s+(.+?)\s+to\s+(.+)', message, re.IGNORECASE)
    if not m:
        return None
    origin_name = m.group(1).strip()
    dest_name = m.group(2).strip()
    
    origin = geocode_place(origin_name, nodes)
    dest = geocode_place(dest_name, nodes)
    
    if origin and dest:
        return {
            'origin_lat': origin[0], 'origin_lng': origin[1],
            'dest_lat': dest[0], 'dest_lng': dest[1],
        }
    return None

def error_response(message):
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'status': 'error', 'message': message})
    }

import logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    logger.info(f"Event type: {type(event)}, keys: {list(event.keys()) if isinstance(event, dict) else 'N/A'}")
    try:
        # Parse request - handle both direct Lambda invoke and API Gateway
        if isinstance(event, str):
            body = json.loads(event)
        elif 'body' in event and event.get('body'):
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body']
        elif isinstance(event, dict) and 'message' in event:
            body = event
        else:
            body = event
        
        # Load graph first
        adj, nodes = load_graph()
        
        # Check if text message provided
        if 'message' in body:
            message = body['message']
            user_location = body.get('user_location', {})
            
            parsed = parse_text_query(message, nodes)
            if parsed:
                origin_lat = parsed['origin_lat']
                origin_lng = parsed['origin_lng']
                dest_lat = parsed['dest_lat']
                dest_lng = parsed['dest_lng']
            elif 'from here' in message.lower() and user_location:
                # GPS origin + destination
                origin_lat = float(user_location.get('lat', 14.6225))
                origin_lng = float(user_location.get('lng', 121.0538))
                dest_name = message.lower().replace('from here to', '').replace('here to', '').strip()
                dest = geocode_place(dest_name, nodes)
                if dest:
                    dest_lat, dest_lng = dest
                else:
                    return error_response('Could not find destination: ' + dest_name)
            else:
                # Check if it's "X to Y" without "from"
                import re
                m = re.search(r'(.+?)\s+to\s+(.+)', message, re.IGNORECASE)
                if m:
                    origin_name = m.group(1).strip()
                    dest_name = m.group(2).strip()
                    origin = geocode_place(origin_name, nodes)
                    dest = geocode_place(dest_name, nodes)
                    if origin and dest:
                        origin_lat, origin_lng = origin
                        dest_lat, dest_lng = dest
                    else:
                        return error_response(f'Could not find: {origin_name} or {dest_name}')
                else:
                    # Destination only - use default origin
                    dest = geocode_place(message.strip(), nodes)
                    if dest:
                        origin = geocode_place('Cubao', nodes)
                        if origin:
                            origin_lat, origin_lng = origin
                            dest_lat, dest_lng = dest
                        else:
                            return error_response('Could not find Cubao')
                    else:
                        return error_response(f'Could not find: {message}')
        else:
            origin_lat = float(body.get('origin_lat', 0))
            origin_lng = float(body.get('origin_lng', 0))
            dest_lat = float(body.get('dest_lat', 0))
            dest_lng = float(body.get('dest_lng', 0))
        
        # Load graph (cached between warm invocations)
        adj, nodes = load_graph()
        
        # Find nearest nodes
        start = find_nearest_node(origin_lat, origin_lng, nodes)
        end = find_nearest_node(dest_lat, dest_lng, nodes)
        
        # Run Dijkstra
        path = dijkstra(adj, start, end)
        
        # Build segments with geometry
        segments = []
        for i in range(len(path) - 1):
            u = path[i]
            v = path[i + 1]
            if u in nodes and v in nodes:
                u_lat, u_lon = nodes[u]
                v_lat, v_lon = nodes[v]
                dist = haversine(u_lat, u_lon, v_lat, v_lon)
                time_min = (dist / 1000) / 4.5 * 60  # walk speed fallback
                segments.append({
                    'from_node': u,
                    'to_node': v,
                    'distance_km': round(dist / 1000, 3),
                    'time_min': round(time_min, 1),
                    'geometry': [[u_lat, u_lon], [v_lat, v_lon]],
                    'type': 'walk' if 'WALK' in u else 'transit',
                })
        
        total_time = round(sum(s['time_min'] for s in segments), 1)
        total_dist = round(sum(s['distance_km'] for s in segments), 2)
        
        route_data = {
            'segments': segments,
            'total_time_min': total_time,
            'total_distance_km': total_dist,
            'total_fare': 0,
            'transfers': 0,
        }
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'status': 'success',
                'route_data': route_data,
                'reply_text': f'Here are your commute options:',
                'path': path,
                'path_length': len(path),
                'graph_nodes': len(adj),
            })
        }
    except Exception as e:
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({'status': 'error', 'message': str(e)})
        }
