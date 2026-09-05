import json
import math
import heapq
import os
import time
import urllib.request
import urllib.parse

_graph = None
_nodes = None
_last_nominatim_call = 0

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def load_graph():
    global _graph, _nodes
    if _graph is None:
        try:
            with open("graph_data.json", "r") as f:
                data = json.load(f)
            _graph = data["graph"]
            _nodes = data["nodes"]
        except:
            _graph, _nodes = {}, {}
    return _graph, _nodes

def geocode_with_cache(place_name):
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    
    place_name = place_name.strip()
    for suffix in [' cbd', ' central business district', ' street', ' st.', ' st', ' avenue', ' ave', ' road', ' rd']:
        if place_name.lower().endswith(suffix):
            place_name = place_name[:-len(suffix)].strip()
            break
    
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
    except:
        pass
    
    global _last_nominatim_call
    elapsed = time.time() - _last_nominatim_call
    if elapsed < 1.0:
        time.sleep(1.0 - elapsed)
    
    try:
        query = f"{place_name}, Metro Manila, Philippines"
        url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(query)}&format=json&limit=1"
        req = urllib.request.Request(url, headers={'User-Agent': 'ParaPH/1.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        _last_nominatim_call = time.time()
        if data:
            return {"name": data[0].get("display_name", place_name).split(',')[0], "lat": float(data[0]["lat"]), "lng": float(data[0]["lon"])}
    except:
        pass
    
    try:
        words = place_name.split()
        if len(words) > 1:
            short_query = ' '.join(words[-2:])
            query = f"{short_query}, Metro Manila, Philippines"
            url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(query)}&format=json&limit=1"
            req = urllib.request.Request(url, headers={'User-Agent': 'ParaPH/1.0'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read())
            _last_nominatim_call = time.time()
            if data:
                return {"name": data[0].get("display_name", short_query).split(',')[0], "lat": float(data[0]["lat"]), "lng": float(data[0]["lon"])}
    except:
        pass
    
    return None

def find_nearest_node(lat, lng, graph_nodes, max_dist_km=5.0):
    nearest = None
    min_dist = float('inf')
    for node_id, coords in graph_nodes.items():
        dist = haversine(lat, lng, coords[0], coords[1])
        if dist < min_dist and dist <= max_dist_km:
            min_dist = dist
            nearest = node_id
    return nearest, min_dist

def dijkstra(graph, start, end, max_time_min=300):
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
            v, w = edge[0], edge[1]
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
        
        dest_text = message.split(' to ')[-1].strip() if ' to ' in message else message.strip()
        
        if not user_lat or not user_lng:
            origin_text = None
            if ' to ' in message:
                parts = message.split(' to ')
                origin_text = parts[0].replace('from ', '').strip()
            if origin_text:
                origin_result = geocode_with_cache(origin_text)
                if origin_result:
                    user_lat = origin_result['lat']
                    user_lng = origin_result['lng']
        
        if not user_lat or not user_lng:
            return {'statusCode': 200, 'headers': cors_headers, 'body': json.dumps({'status': 'error', 'message': 'No location'})}
        
        dest_result = geocode_with_cache(dest_text)
        if not dest_result:
            return {'statusCode': 200, 'headers': cors_headers, 'body': json.dumps({'status': 'error', 'message': f'Cannot find: {dest_text}'})}
        
        graph, nodes = load_graph()
        start_node, _ = find_nearest_node(user_lat, user_lng, nodes, 5.0)
        end_node, _ = find_nearest_node(dest_result['lat'], dest_result['lng'], nodes, 5.0)
        
        if not start_node or not end_node:
            dist_km = haversine(user_lat, user_lng, dest_result['lat'], dest_result['lng'])
            walk_min = round(dist_km * 12, 1)
            return {'statusCode': 200, 'headers': cors_headers, 'body': json.dumps({'status': 'success', 'route_data': {'total_time_min': walk_min, 'segments': [{'type': 'walk', 'route': f'Walk to {dest_result["name"]}', 'time_min': walk_min, 'distance_km': round(dist_km, 1)}], 'message': 'No transit nearby.'}})}
        
        path = dijkstra(graph, start_node, end_node, max_time_min=300)
        
        if not path:
            dist_km = haversine(user_lat, user_lng, dest_result['lat'], dest_result['lng'])
            walk_min = round(dist_km * 12, 1)
            return {'statusCode': 200, 'headers': cors_headers, 'body': json.dumps({'status': 'success', 'route_data': {'total_time_min': walk_min, 'segments': [{'type': 'walk', 'route': f'Walk to {dest_result["name"]}', 'time_min': walk_min, 'distance_km': round(dist_km, 1)}], 'message': 'No transit route.'}})}
        
        raw = []
        for i in range(len(path) - 1):
            u, v = path[i], path[i+1]
            for edge in graph.get(u, []):
                if edge[0] == v:
                    u_coords = nodes.get(u)
                    v_coords = nodes.get(v)
                    raw.append({
                        'type': edge[3] if len(edge) > 3 else 'transit',
                        'route': edge[2] if len(edge) > 2 else 'Unknown',
                        'time_min': edge[1],
                        'coords': [u_coords, v_coords] if u_coords and v_coords else None,
                    })
                    break
        
        segments = []
        for seg in raw:
            if segments and segments[-1]['route'] == seg['route'] and segments[-1]['type'] == seg['type']:
                segments[-1]['time_min'] += seg['time_min']
                if seg['coords'] and segments[-1].get('coords'):
                    segments[-1]['coords'].append(seg['coords'][1])
            else:
                segments.append(seg.copy())
        
        for seg in segments:
            coords = seg.get('coords', [])
            seg['path'] = [[c[0], c[1]] for c in coords if c]
            seg.pop('coords', None)
            seg['reliability'] = 0.5
            seg['fare'] = 0
            seg['is_verified'] = False
        
        total_time = sum(s['time_min'] for s in segments)
        
        return {'statusCode': 200, 'headers': cors_headers, 'body': json.dumps({'status': 'success', 'route_data': {'total_time_min': round(total_time, 1), 'total_fare': 0, 'biyahe_score': max(0, round(100 - min(total_time/120*30, 30) - min(len(segments)*7.5, 15) - 25)), 'segments': segments, 'destination': dest_result['name'], 'alternatives': []}})}
    
    except Exception as e:
        return {'statusCode': 200, 'headers': cors_headers, 'body': json.dumps({'status': 'error', 'message': str(e)})}
