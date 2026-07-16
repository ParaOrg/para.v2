import math
import json
import os
import sqlite3
import networkx as nx

# --- SPATIAL MATH ---
def haversine(lat1, lon1, lat2, lon2):
    R = 6371000.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(d_lon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

# --- DATABASE ---
def init_db():
    conn = sqlite3.connect("para_ml_data.db")
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS route_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_lat REAL, start_lng REAL, end_lat REAL, end_lng REAL,
            suggested_steps TEXT, estimated_time REAL, estimated_fare REAL,
            is_approved BOOLEAN, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

# --- GRAPH BUILDER ---
def find_geojson_file():
    for f in os.listdir("."):
        if f.endswith((".geojson", ".json")) and "stops" not in f.lower() and "package" not in f.lower() and "ml_data" not in f.lower():
            try:
                with open(f, 'r', encoding='utf-8') as file:
                    if "features" in json.load(file):
                        return f
            except:
                continue
    return None

def build_transit_graph():
    G = nx.DiGraph()
    geojson_file = find_geojson_file()
    if not geojson_file:
        print("❌ No GeoJSON file found!")
        return G, {}

    print(f"📂 Loading {geojson_file}...")
    with open(geojson_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    all_nodes = {}
    grid = {}
    CELL_SIZE = 0.0005 # ~50 meters for transfer snapping

    for feature in data.get("features", []):
        route_name = feature.get("properties", {}).get("route_long_name") or feature.get("properties", {}).get("route_name", "Unknown")
        geom = feature.get("geometry", {})
        geom_type = geom.get("type", "")
        raw_coords = geom.get("coordinates", [])

        lines = raw_coords if geom_type == "MultiLineString" else [raw_coords]

        for line in lines:
            prev_node = None
            for pt in line:
                lon, lat = float(pt[0]), float(pt[1])
                r_lon, r_lat = round(lon, 5), round(lat, 5)
                node_id = f"{r_lat}_{r_lon}"

                if node_id not in all_nodes:
                    all_nodes[node_id] = (lat, lon)
                    G.add_node(node_id, lat=lat, lon=lon)
                    gx, gy = int(r_lon / CELL_SIZE), int(r_lat / CELL_SIZE)
                    if (gx, gy) not in grid: grid[(gx, gy)] = []
                    grid[(gx, gy)].append(node_id)

                if prev_node and prev_node != node_id:
                    dist = haversine(all_nodes[prev_node][0], all_nodes[prev_node][1], lat, lon)
                    if dist < 500: # Prevent teleportation
                        time_mins = (dist / 1000.0) / 20.0 * 60.0
                        G.add_edge(prev_node, node_id, weight=time_mins, distance=dist, route_name=route_name, edge_type="ride")
                        G.add_edge(node_id, prev_node, weight=time_mins, distance=dist, route_name=route_name, edge_type="ride")
                prev_node = node_id

    # Build Transfer Edges (Walking between routes)
    transfer_count = 0
    for (gx, gy), nodes in grid.items():
        neighbors = []
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                neighbors.extend(grid.get((gx+dx, gy+dy), []))
        
        for n1 in nodes:
            for n2 in neighbors:
                if n1 >= n2 or G.has_edge(n1, n2): continue
                lat1, lon1 = all_nodes[n1]
                lat2, lon2 = all_nodes[n2]
                dist = haversine(lat1, lon1, lat2, lon2)
                
                if 0 < dist <= 50.0:
                    walk_time = (dist / 1000.0) / 4.0 * 60.0 + 5.0 # 5 min transfer penalty
                    G.add_edge(n1, n2, weight=walk_time, distance=dist, route_name="Walk", edge_type="transfer")
                    G.add_edge(n2, n1, weight=walk_time, distance=dist, route_name="Walk", edge_type="transfer")
                    transfer_count += 1

    print(f"✅ Graph built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges ({transfer_count} transfers).")
    return G, all_nodes