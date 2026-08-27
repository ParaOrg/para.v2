#!/usr/bin/env python3
"""
Build rail graph with proper station chaining.
"""

import json
import gzip
import os
import urllib.request
import math

SUPABASE_URL = "https://tcvomrkytxnetzijwqad.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdm9tcmt5dHhuZXR6aWp3cWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzY3NDgsImV4cCI6MjA3MzAxMjc0OH0.ljYfw72N5dm4GsM1yKvV4bNNb8sWEoErTD3TrGz1s0o"

LRT1_ORDER = [
    "Fernando Poe Jr.", "Balintawak", "Yamaha Monumento", "5th Avenue",
    "R. Papa", "Abad Santos", "Blumentritt", "Tayuman", "Bambang",
    "Doroteo Jose", "Carriedo", "United Nations", "Pedro Gil", "Quirino",
    "Vito Cruz", "Gil Puyat", "Libertad", "EDSA", "Baclaran"
]

LRT2_ORDER = [
    "Antipolo", "Marikina-Pasig", "Santolan", "Katipunan", "Anonas",
    "Araneta Center - Cubao", "Betty Go - Belmonte", "Gilmore", "J. Ruiz",
    "V. Mapa", "Pureza", "Legarda", "Recto"
]

MRT3_ORDER = [
    "North Avenue", "Quezon Avenue", "GMA Kamuning", "Araneta Center - Cubao",
    "Santolan-Annapolis", "Ortigas", "Shaw Boulevard", "Boni", "Guadalupe",
    "Buendia", "Ayala", "Magallanes", "Taft Avenue"
]

def fetch_supabase(table, select="*", limit=1000):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}&limit={limit}"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def haversine_m(lat1, lng1, lat2, lng2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmbda = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlmbda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def parse_geom(geom):
    if isinstance(geom, str):
        try:
            geom = json.loads(geom)
        except:
            return []
    if geom is None:
        return []
    return geom.get("coordinates", [])

def build_rail_graph():
    print("🚂 Building rail graph...")
    
    stations = fetch_supabase("rail_station_points", "id,fid,name,railway,geom", 200)
    station_coords = {}
    for station in stations:
        name = station.get("name")
        railway = station.get("railway")
        if not name or railway != "stop":
            continue
        coords = parse_geom(station.get("geom", {}))
        if len(coords) >= 2:
            lng, lat = coords[0], coords[1]
            station_coords[name] = (lat, lng)
    
    print(f"  Found {len(station_coords)} station stops")
    
    nodes = {}
    adj = {}
    
    def add_station(name, lat, lng, line_name):
        node_id = f"rail::{name}::{lat:.5f}_{lng:.5f}"
        nodes[node_id] = [lat, lng]
        if node_id not in adj:
            adj[node_id] = []
        return node_id, lat, lng
    
    def connect_line(stations_ordered, line_name, speed_kmh=35):
        chain = []
        for name in stations_ordered:
            if name not in station_coords:
                print(f"  ⚠️  Missing: {name}")
                continue
            lat, lng = station_coords[name]
            node_id, _, _ = add_station(name, lat, lng, line_name)
            chain.append((node_id, lat, lng, name))
        
        for i in range(len(chain) - 1):
            node1, lat1, lng1, name1 = chain[i]
            node2, lat2, lng2, name2 = chain[i+1]
            dist_m = haversine_m(lat1, lng1, lat2, lng2)
            time_min = dist_m / 1000 / speed_kmh * 60
            weight = max(time_min, 0.5)
            adj[node1].append([node2, weight, line_name, 'rail'])
            adj[node2].append([node1, weight, line_name, 'rail'])
        
        print(f"  ✅ Connected {len(chain)} stations on {line_name}")
        return chain
    
    lrt1_chain = connect_line(LRT1_ORDER, "LRT Line 1")
    lrt2_chain = connect_line(LRT2_ORDER, "LRT Line 2")
    mrt3_chain = connect_line(MRT3_ORDER, "MRT Line 3")
    
    # Transfer connections
    print("🔗 Connecting transfers...")
    all_rail_nodes = {}
    for chain in [lrt1_chain, lrt2_chain, mrt3_chain]:
        for node_id, lat, lng, name in chain:
            all_rail_nodes[node_id] = (lat, lng, name)
    
    transfer_pairs = [
        ("Doroteo Jose", "Recto"),
        ("EDSA", "Taft Avenue"),
    ]
    
    for station_a, station_b in transfer_pairs:
        nodes_a = [nid for nid, (lat, lng, name) in all_rail_nodes.items() if name == station_a]
        nodes_b = [nid for nid, (lat, lng, name) in all_rail_nodes.items() if name == station_b]
        for na in nodes_a:
            for nb in nodes_b:
                if na != nb:
                    adj[na].append([nb, 3.0, "Transfer Walk", "walk"])
                    adj[nb].append([na, 3.0, "Transfer Walk", "walk"])
        print(f"  {station_a} ↔ {station_b}")
    
    # Load existing graph
    graph_path = "graph_full.json.gz"
    if os.path.exists(graph_path):
        with gzip.open(graph_path, 'rt') as f:
            existing = json.load(f)
        existing_adj = existing.get("adj", {})
        existing_nodes = existing.get("nodes", {})
    else:
        existing_adj = {}
        existing_nodes = {}
    
    # Walk connections to road
    print("🚶 Connecting rail to road...")
    WALK_SPEED_KMH = 5
    MAX_WALK_M = 500
    
    for node_id, (lat, lng, name) in all_rail_nodes.items():
        nearest_road = []
        for road_node_id, (road_lat, road_lng) in existing_nodes.items():
            if 'rail::' in road_node_id:
                continue
            dist = haversine_m(lat, lng, road_lat, road_lng)
            if dist < MAX_WALK_M:
                nearest_road.append((road_node_id, dist))
        
        nearest_road.sort(key=lambda x: x[1])
        for road_node_id, dist in nearest_road[:3]:
            walk_time = (dist / 1000) / WALK_SPEED_KMH * 60
            adj[node_id].append([road_node_id, walk_time, "Walk", "walk"])
            if road_node_id not in existing_adj:
                existing_adj[road_node_id] = []
            existing_adj[road_node_id].append([node_id, walk_time, "Walk", "walk"])
    
    merged_adj = {**existing_adj, **adj}
    merged_nodes = {**existing_nodes, **nodes}
    
    output = {"adj": merged_adj, "nodes": merged_nodes}
    
    with gzip.open("graph_full_rail.json.gz", 'wt') as f:
        json.dump(output, f)
    
    print(f"✅ Saved: {len(merged_nodes)} nodes")
    return output

if __name__ == "__main__":
    build_rail_graph()
