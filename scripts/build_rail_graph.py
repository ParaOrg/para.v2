#!/usr/bin/env python3
"""
Para PH - Rail Graph Builder
Builds a transit graph with proper rail/road connections using Supabase data.
- Uses transit_fares for fare matrix
- Uses rail_station_points.line_id for line continuity
- Only creates walk edges at designated interchanges
"""

import json
import gzip
import os
import math
import urllib.request
from typing import Dict, List, Tuple, Optional

SUPABASE_URL = "https://tcvomrkytxnetzijwqad.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdm9tcmt5dHhuZXR6aWp3cWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzY3NDgsImV4cCI6MjA3MzAxMjc0OH0.ljYfw72N5dm4GsM1yKvV4bNNb8sWEoErTD3TrGz1s0o"

# Known interchange stations (fallback if DB query fails)
INTERCHANGES = [
    {"station1": "Doroteo Jose", "line1": "LRT-1", "station2": "Recto", "line2": "LRT-2"},
    {"station1": "EDSA", "line1": "LRT-1", "station2": "Taft Avenue", "line2": "MRT-3"},
    {"station1": "Araneta Center - Cubao", "line1": "LRT-2", "station2": "Araneta Center - Cubao", "line2": "MRT-3"},
]

def fetch_supabase(table, select="*", limit=1000, max_pages=10):
    """Fetch data from Supabase REST API with pagination."""
    all_data = []
    offset = 0
    
    while offset < max_pages * limit:
        url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}&limit={limit}&offset={offset}"
        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
        
        if not data:
            break
        
        all_data.extend(data)
        offset += limit
        
        # If we got less than limit, we've reached the end
        if len(data) < limit:
            break
    
    return all_data

def haversine_m(lat1, lng1, lat2, lng2):
    """Calculate distance in meters between two coordinates."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmbda = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlmbda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def parse_geom(geom):
    """Parse geometry from Supabase response."""
    if isinstance(geom, str):
        try:
            geom = json.loads(geom)
        except:
            return []
    if geom is None:
        return []
    return geom.get("coordinates", [])

def get_rail_lines():
    """Fetch rail line names and IDs from rail_network_lines."""
    lines = fetch_supabase("rail_network_lines", "id,name", 100)
    line_map = {}
    for line in lines:
        line_map[line["id"]] = line.get("name", f"Line-{line['id']}")
    return line_map


def fetch_jeepney_routes():
    """Fetch ALL jeepney routes (verified AND unverified) with their shapes."""
    # Get ALL jeepney routes (both verified and unverified) - with pagination
    routes = fetch_supabase("ph_routes", "route_uuid,name,mode,is_approved,status", 1000, 10)
    
    # Separate verified and unverified
    verified_jeepneys = [r for r in routes if r.get("mode") == "jeepney" and r.get("is_approved")]
    unverified_jeepneys = [r for r in routes if r.get("mode") == "jeepney" and not r.get("is_approved")]
    
    print(f"  Verified jeepney routes: {len(verified_jeepneys)}")
    print(f"  Unverified jeepney routes: {len(unverified_jeepneys)}")
    
    # Combine all routes with verification flag
    all_jeepneys = []
    for r in verified_jeepneys:
        r["_verified"] = True
        all_jeepneys.append(r)
    for r in unverified_jeepneys:
        r["_verified"] = False
        all_jeepneys.append(r)
    
    # Fetch ALL shapes - with pagination
    shapes = fetch_supabase("ph_route_shapes", "shape_uuid,route_uuid,geom_geojson,length_m", 1000, 10)
    
    # Build route shapes mapping
    route_shapes = {}
    for shape in shapes:
        route_uuid = shape.get("route_uuid")
        geom_geojson = shape.get("geom_geojson")
        
        # Find matching route
        for route in all_jeepneys:
            if route["route_uuid"] == route_uuid:
                route_shapes[route["name"]] = {
                    "geom_geojson": geom_geojson,
                    "length_m": shape.get("length_m"),
                    "route_uuid": route_uuid,
                    "is_verified": route.get("_verified", False),
                }
                break
    
    print(f"  Found {len(route_shapes)} shapes for jeepney routes")
    
    return all_jeepneys, route_shapes

def build_jeepney_graph(nodes, adj):
    """Add jeepney routes to the graph."""
    print("🚐 Building jeepney graph...")
    
    jeepney_routes, route_shapes = fetch_jeepney_routes()
    print(f"  Found {len(jeepney_routes)} approved jeepney routes")
    print(f"  Found {len(route_shapes)} route shapes")
    
    # Jeepney speed: 15 km/h average
    JEEPNEY_SPEED_KMH = 15
    
    jeepney_nodes_added = 0
    jeepney_edges_added = 0
    
    for route_name, shape_info in route_shapes.items():
        geom_geojson = shape_info.get("geom_geojson")
        is_verified = shape_info.get("is_verified", False)
        
        if not geom_geojson:
            continue
        
        # Parse GeoJSON geometry
        coords = []
        if isinstance(geom_geojson, str):
            try:
                geom_geojson = json.loads(geom_geojson)
            except:
                continue
        
        if isinstance(geom_geojson, dict):
            raw_coords = geom_geojson.get("coordinates", [])
            
            # Handle MultiLineString vs LineString
            if raw_coords and isinstance(raw_coords[0], list):
                if isinstance(raw_coords[0][0], list):
                    # MultiLineString - flatten
                    for line in raw_coords:
                        coords.extend(line)
                else:
                    # LineString
                    coords = raw_coords
        
        if len(coords) < 2:
            continue
        
        # Apply speed based on verification status
        speed_kmh = 15 if is_verified else 10  # Unverified routes are slower
        weight_multiplier = 1.0 if is_verified else 3.0  # SAKAY unverified penalty
        
        # Create nodes for each coordinate (or use existing road nodes)
        route_nodes = []
        for i, coord in enumerate(coords):
            if len(coord) < 2:
                continue
            
            lng, lat = coord[0], coord[1]
            
            # Create a node ID for this route point
            node_id = f"jeep::{route_name}::point{i}::{lat:.5f}_{lng:.5f}"
            
            # Add node if not exists
            if node_id not in nodes:
                nodes[node_id] = [lat, lng]
                adj[node_id] = []
                jeepney_nodes_added += 1
            
            route_nodes.append(node_id)
        
        # Connect consecutive nodes with edges
        for i in range(len(route_nodes) - 1):
            node1 = route_nodes[i]
            node2 = route_nodes[i + 1]
            
            # Calculate distance
            lat1, lng1 = nodes[node1]
            lat2, lng2 = nodes[node2]
            dist_m = haversine_m(lat1, lng1, lat2, lng2)
            
            # Calculate time based on jeepney speed and verification
            time_min = dist_m / 1000 / speed_kmh * 60
            weight = max(time_min * weight_multiplier, 0.5)  # Apply SAKAY penalty
            
            # Store verification status in edge
            edge_mode = 'jeepney_verified' if is_verified else 'jeepney_unverified'
            
            # Add bidirectional edges
            adj[node1].append([node2, weight, route_name, edge_mode])
            adj[node2].append([node1, weight, route_name, edge_mode])
            jeepney_edges_added += 2
        
        status = "✅" if is_verified else "⚠️ "
        print(f"  {status} {route_name}: {len(route_nodes)} nodes, {len(route_nodes)-1} edges ({'verified' if is_verified else 'UNVERIFIED 3x penalty'})")
    
    print(f"  Total jeepney nodes added: {jeepney_nodes_added}")
    print(f"  Total jeepney edges added: {jeepney_edges_added}")
    
    return nodes, adj

def build_rail_graph():
    print("🚂 Building rail graph with proper line continuity...")
    
    # Fetch rail lines for name mapping
    line_map = get_rail_lines()
    print(f"  Found {len(line_map)} rail lines: {list(line_map.values())}")
    
    # Fetch stations with line_id
    stations = fetch_supabase("rail_station_points", "id,name,railway,geom,line_id", 200)
    print(f"  Found {len(stations)} station points")
    
    # Build station coordinates and line assignments
    station_coords = {}
    station_lines = {}
    station_names_by_line = {}
    
    for station in stations:
        name = station.get("name")
        railway = station.get("railway")
        line_id = station.get("line_id")
        
        if not name or railway != "stop":
            continue
        if name.lower() in ('none', 'null', '') or 'entrance' in name.lower():
            continue
        if name == 'Santa Mesa':  # PNR station, skip
            continue
        
        coords = parse_geom(station.get("geom", {}))
        if len(coords) >= 2:
            lng, lat = coords[0], coords[1]
            
            # Use station name patterns to determine line
            # (line_id is often NULL in the database)
            name_lower = name.lower()
            
            # LRT-1 stations
            if any(s in name_lower for s in ['fernando poe', 'balintawak', 'monumento', '5th avenue', 
                                              'r. papa', 'abad santos', 'blumentritt', 'tayuman', 
                                              'bambang', 'doroteo jose', 'carriedo', 'central terminal',
                                              'united nations', 'pedro gil', 'quirino', 'vito cruz',
                                              'gil puyat', 'libertad', 'edsa', 'baclaran', 
                                              'redemptorist', 'mia road', 'pitx', 'ninoy aquino', 'dr. santos']):
                line_name = "LRT-1"
            # LRT-2 stations
            elif any(s in name_lower for s in ['antipolo', 'marikina', 'santolan', 'katipunan', 
                                                'anonas', 'cubao', 'betty go', 'gilmore', 'j. ruiz',
                                                'v. mapa', 'pureza', 'legarda', 'recto']):
                line_name = "LRT-2"
            # MRT-3 stations
            elif any(s in name_lower for s in ['north avenue', 'quezon avenue', 'gma kamuning', 
                                                'ortigas', 'shaw', 'boni', 'guadalupe', 'buendia',
                                                'ayala', 'magallanes', 'taft']):
                line_name = "MRT-3"
            else:
                # Unknown line, use line_id if available
                line_name = line_map.get(line_id, f"Line-{line_id}") if line_id else None
                if line_name and "LRT" in str(line_name).upper() and "1" in str(line_name):
                    line_name = "LRT-1"
                elif line_name and "LRT" in str(line_name).upper() and "2" in str(line_name):
                    line_name = "LRT-2"
                elif line_name and "MRT" in str(line_name).upper():
                    line_name = "MRT-3"
            
            if name not in station_coords:
                station_coords[name] = (lat, lng)
                station_lines[name] = line_name
                
                if line_name not in station_names_by_line:
                    station_names_by_line[line_name] = []
                station_names_by_line[line_name].append(name)
    
    print(f"  Station lines: {station_names_by_line.keys()}")
    for line, names in station_names_by_line.items():
        print(f"    {line}: {len(names)} stations")
    
    # Build graph structure
    nodes = {}
    adj = {}
    
    def add_node(name, lat, lng, line_name):
        node_id = f"rail::{name}::{lat:.5f}_{lng:.5f}"
        nodes[node_id] = [lat, lng]
        if node_id not in adj:
            adj[node_id] = []
        return node_id
    
    # Connect stations on same line
    print("🔗 Connecting stations on same line...")
    for line_name, station_names in station_names_by_line.items():
        # Sort stations by name (we don't have explicit order, but proximity works)
        # Actually, let's connect ALL pairs on same line within reasonable distance
        valid_stations = [(name, station_coords[name]) for name in station_names]
        
        for i in range(len(valid_stations)):
            for j in range(i+1, len(valid_stations)):
                name1, (lat1, lng1) = valid_stations[i]
                name2, (lat2, lng2) = valid_stations[j]
                
                dist = haversine_m(lat1, lng1, lat2, lng2)
                if dist < 8000:  # Max 8km between stations on same line
                    node1 = add_node(name1, lat1, lng1, line_name)
                    node2 = add_node(name2, lat2, lng2, line_name)
                    
                    # Rail speed: 35 km/h
                    time_min = dist / 1000 / 35 * 60
                    weight = max(time_min, 1.0)
                    
                    # Add bidirectional edges
                    adj[node1].append([node2, weight, line_name, 'rail'])
                    adj[node2].append([node1, weight, line_name, 'rail'])
        
        print(f"  ✅ {line_name}: {len(valid_stations)} stations connected")
    
    # Add transfer connections
    print("🚶 Adding interchange walk connections...")
    for interchange in INTERCHANGES:
        station1 = interchange["station1"]
        station2 = interchange["station2"]
        
        if station1 in station_coords and station2 in station_coords:
            lat1, lng1 = station_coords[station1]
            lat2, lng2 = station_coords[station2]
            
            node1 = add_node(station1, lat1, lng1, interchange["line1"])
            node2 = add_node(station2, lat2, lng2, interchange["line2"])
            
            # Walk speed: 5 km/h
            dist = haversine_m(lat1, lng1, lat2, lng2)
            walk_time = max(dist / 1000 / 5 * 60, 3.0)  # Minimum 3 minutes
            
            adj[node1].append([node2, walk_time, "Transfer Walk", "walk"])
            adj[node2].append([node1, walk_time, "Transfer Walk", "walk"])
            
            print(f"  ✅ {station1} ↔ {station2} ({dist:.0f}m, {walk_time:.1f}min)")
    
    # Load existing road graph
    print("🛣️ Loading existing road graph...")
    graph_path = "lambda-route-search/graph_full.json.gz"
    if os.path.exists(graph_path):
        with gzip.open(graph_path, 'rt') as f:
            existing = json.load(f)
        existing_adj = existing.get("adj", {})
        existing_nodes = existing.get("nodes", {})
        print(f"  Loaded {len(existing_nodes)} road nodes, {len(existing_adj)} road edges")
    else:
        existing_adj = {}
        existing_nodes = {}
        print("  No existing graph found, building rail-only graph")
    
    # Merge graphs (keep rail nodes, add road nodes)
    # Remove old rail nodes from existing graph
    filtered_existing_nodes = {k: v for k, v in existing_nodes.items() if 'rail::' not in k}
    filtered_existing_adj = {k: v for k, v in existing_adj.items() if 'rail::' not in k}
    
    merged_nodes = {**filtered_existing_nodes, **nodes}
    merged_adj = {**filtered_existing_adj, **adj}
    
    # Add jeepney routes to the graph
    merged_nodes, merged_adj = build_jeepney_graph(merged_nodes, merged_adj)
    
    # Connect jeepney route endpoints to nearby rail stations
    print("🔗 Connecting jeepney routes to rail stations...")
    WALK_SPEED_KMH = 5
    MAX_WALK_M = 800  # 800m max walk to rail station
    
    # Get all rail station coordinates
    rail_station_coords = {}
    for node_id in nodes:
        if 'rail::' in node_id:
            station_name = node_id.split('::')[1] if '::' in node_id else ''
            rail_station_coords[node_id] = (nodes[node_id][0], nodes[node_id][1], station_name)
    
    # Connect ALL jeepney route nodes to nearby rail stations (not just endpoints)
    walk_connections_added = 0
    connection_count = 0
    
    for node_id in merged_nodes:
        if 'jeep::' not in node_id:
            continue
        
        ep_lat, ep_lng = merged_nodes[node_id]
        
        # Find nearest rail station
        nearest_rail = None
        nearest_dist = float('inf')
        
        for rail_node, (rail_lat, rail_lng, station_name) in rail_station_coords.items():
            dist = haversine_m(ep_lat, ep_lng, rail_lat, rail_lng)
            if dist < nearest_dist and dist < MAX_WALK_M:
                nearest_dist = dist
                nearest_rail = rail_node
        
        if nearest_rail:
            # Add walk connection
            walk_time = max(nearest_dist / 1000 / WALK_SPEED_KMH * 60, 2.0)
            
            # Add edge from jeepney node to rail station
            if node_id not in merged_adj:
                merged_adj[node_id] = []
            merged_adj[node_id].append([nearest_rail, walk_time, "Walk to rail", "walk"])
            
            # Add reverse edge
            if nearest_rail not in merged_adj:
                merged_adj[nearest_rail] = []
            merged_adj[nearest_rail].append([node_id, walk_time, "Walk to jeepney", "walk"])
            
            walk_connections_added += 2
            connection_count += 1
    
    print(f"  ✅ Added {walk_connections_added} walk connections (jeepney ↔ rail)")
    
    # Save graph
    output_path = "lambda-route-search/graph_full_rail.json.gz"
    output = {"adj": merged_adj, "nodes": merged_nodes}
    
    with gzip.open(output_path, 'wt') as f:
        json.dump(output, f)
    
    print(f"✅ Saved graph to {output_path}")
    print(f"   Total nodes: {len(merged_nodes)}")
    print(f"   Rail nodes: {len(nodes)}")
    print(f"   Total adjacency entries: {len(merged_adj)}")
    return output

if __name__ == "__main__":
    build_rail_graph()
