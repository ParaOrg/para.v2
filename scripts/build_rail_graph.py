#!/usr/bin/env python3
"""
Build rail graph from Supabase and merge with existing transit graph.
Creates graph_full.json.gz with rail stations + connections.
"""

import json
import gzip
import os
import urllib.request
import math

SUPABASE_URL = "https://tcvomrkytxnetzijwqad.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdm9tcmt5dHhuZXR6aWp3cWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzY3NDgsImV4cCI6MjA3MzAxMjc0OH0.ljYfw72N5dm4GsM1yKvV4bNNb8sWEoErTD3TrGz1s0o"

def fetch_supabase(table, select="*"):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def haversine(lat1, lng1, lat2, lng2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmbda = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlmbda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def main():
    print("🚂 Building rail graph...")
    
    # 1. Fetch rail stations
    print("📥 Fetching rail stations...")
    stations = fetch_supabase("rail_station_points", "id,fid,name,railway,geom")
    print(f"  Found {len(stations)} stations")
    
    # 2. Fetch rail lines
    print("📥 Fetching rail lines...")
    lines = fetch_supabase("rail_network_lines", "id,name,railway,geom")
    print(f"  Found {len(lines)} lines")
    
    # 3. Build rail graph nodes
    rail_nodes = {}
    for station in stations:
        geom = station.get("geom", {})
        if isinstance(geom, str):
            geom = json.loads(geom)
        coords = geom.get("coordinates", [])
        if len(coords) >= 2:
            lng, lat = coords[0], coords[1]
            node_id = f"rail::{station['name']}::{lat:.5f}_{lng:.5f}"
            rail_nodes[node_id] = [lat, lng]
    
    print(f"✅ Created {len(rail_nodes)} rail nodes")
    
    # 4. Connect stations on same line
    rail_adj = {node: [] for node in rail_nodes}
    
    # Group stations by line
    for line in lines:
        line_name = line.get("name", "")
        line_geom = line.get("geom", {})
        if isinstance(line_geom, str):
            line_geom = json.loads(line_geom)
        line_coords = line_geom.get("coordinates", [])
        
        # Find stations near this line
        stations_on_line = []
        for station in stations:
            s_geom = station.get("geom", {})
            if isinstance(s_geom, str):
                s_geom = json.loads(s_geom)
            s_coords = s_geom.get("coordinates", [])
            if len(s_coords) < 2:
                continue
            s_lat, s_lng = s_coords[1], s_coords[0]
            
            for lng, lat in line_coords:
                dist = haversine(s_lat, s_lng, lat, lng)
                if dist < 200:  # Within 200m of line
                    stations_on_line.append(station)
                    break
        
        # Connect consecutive stations
        for i in range(len(stations_on_line) - 1):
            s1 = stations_on_line[i]
            s2 = stations_on_line[i + 1]
            
            g1 = s1.get("geom", {})
            g2 = s2.get("geom", {})
            if isinstance(g1, str): g1 = json.loads(g1)
            if isinstance(g2, str): g2 = json.loads(g2)
            
            c1 = g1.get("coordinates", [])
            c2 = g2.get("coordinates", [])
            if len(c1) < 2 or len(c2) < 2:
                continue
            
            lat1, lng1 = c1[1], c1[0]
            lat2, lng2 = c2[1], c2[0]
            dist = haversine(lat1, lng1, lat2, lng2)
            
            node1 = f"rail::{s1['name']}::{lat1:.5f}_{lng1:.5f}"
            node2 = f"rail::{s2['name']}::{lat2:.5f}_{lng2:.5f}"
            
            if node1 in rail_adj and node2 in rail_adj:
                travel_time_min = dist / (30 * 1000 / 60)  # 30 km/h average train speed
                rail_adj[node1].append([node2, travel_time_min])
                rail_adj[node2].append([node1, travel_time_min])
    
    print(f"✅ Built rail connections")
    
    # 5. Load existing graph
    graph_path = "/home/aegis/para-frontend/lambda-route-search/graph_full.json.gz"
    if os.path.exists(graph_path):
        print("📥 Loading existing graph...")
        with gzip.open(graph_path, "rt") as f:
            existing = json.load(f)
        existing_adj = existing.get("adj", {})
        existing_nodes = existing.get("nodes", {})
        print(f"  Existing: {len(existing_nodes)} nodes, {len(existing_adj)} adj entries")
    else:
        existing_adj = {}
        existing_nodes = {}
        print("  No existing graph - starting fresh")
    
    # 5b. Connect rail stations to nearby existing jeepney/bus nodes
    print("🔗 Connecting rail stations to existing graph...")
    connection_count = 0
    
    for rail_node_id, rail_coords in rail_nodes.items():
        rail_lat, rail_lng = rail_coords[0], rail_coords[1]
        
        # Find nearest existing nodes within 500m
        for existing_node_id, existing_coords in existing_nodes.items():
            ex_lat, ex_lng = existing_coords[0], existing_coords[1]
            dist = haversine(rail_lat, rail_lng, ex_lat, ex_lng)
            
            if dist < 500:  # Within 500m walk
                walk_time_min = dist / 80  # 80 m/min walking speed
                
                # Add walk connection using LIST format (matches existing graph)
                # rail -> existing
                if rail_node_id not in rail_adj:
                    rail_adj[rail_node_id] = []
                rail_adj[rail_node_id].append([existing_node_id, walk_time_min])
                
                # existing -> rail
                existing_entry = existing_adj.get(existing_node_id)
                if existing_entry is None:
                    existing_adj[existing_node_id] = [[rail_node_id, walk_time_min]]
                elif isinstance(existing_entry, list):
                    existing_adj[existing_node_id].append([rail_node_id, walk_time_min])
                else:
                    existing_adj[existing_node_id] = [[rail_node_id, walk_time_min]]
                
                connection_count += 1
    
    print(f"  ✅ Created {connection_count} rail-to-graph walk connections")

    # 6. Merge rail nodes and edges
    merged_nodes = {**existing_nodes, **rail_nodes}
    merged_adj = {**existing_adj, **rail_adj}
    
    print(f"✅ Merged: {len(merged_nodes)} nodes total")
    
    # 7. Save merged graph
    output_path = "/home/aegis/para-frontend/lambda-route-search/graph_full_rail.json.gz"
    with gzip.open(output_path, "wt") as f:
        json.dump({"adj": merged_adj, "nodes": merged_nodes}, f)
    
    print(f"✅ Saved merged graph to {output_path}")
    print(f"  Total nodes: {len(merged_nodes)}")
    print(f"  Rail nodes: {len(rail_nodes)}")
    print(f"  Existing nodes: {len(existing_nodes)}")

if __name__ == "__main__":
    main()
