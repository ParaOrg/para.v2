import json
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
    
    with open('graph_lightweight.json', 'r') as f:
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

def geocode_place(place_name):
    """Geocode a place name to coordinates using Nominatim."""
    import urllib.request
    import urllib.parse
    
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={urllib.parse.quote(place_name + ', Metro Manila')}&limit=1"
    req = urllib.request.Request(url, headers={'User-Agent': 'ParaPH-Routing/1.0'})
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read())
        if data:
            return float(data[0]['lat']), float(data[0]['lon'])
    return None

def parse_text_query(message):
    """Parse 'from X to Y' into origin/dest coords."""
    import re
    m = re.search(r'from\s+(.+?)\s+to\s+(.+)', message, re.IGNORECASE)
    if not m:
        return None
    origin_name = m.group(1).strip()
    dest_name = m.group(2).strip()
    
    origin = geocode_place(origin_name)
    dest = geocode_place(dest_name)
    
    if origin and dest:
        return {
            'origin_lat': origin[0], 'origin_lng': origin[1],
            'dest_lat': dest[0], 'dest_lng': dest[1],
        }
    return None

def lambda_handler(event, context):
    try:
        # Parse request
        body = json.loads(event.get('body', '{}'))
        
        # Check if text message provided
        if 'message' in body:
            parsed = parse_text_query(body['message'])
            if parsed:
                origin_lat = parsed['origin_lat']
                origin_lng = parsed['origin_lng']
                dest_lat = parsed['dest_lat']
                dest_lng = parsed['dest_lng']
            else:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'status': 'error', 'message': 'Could not parse query. Use: from X to Y'})
                }
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
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'status': 'success',
                'path': path,
                'path_length': len(path),
                'graph_nodes': len(adj),
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({'status': 'error', 'message': str(e)})
        }
