import math
import os
import json
import networkx as nx
from collections import defaultdict

# --- Speed & Penalty Constants ---
SPEED_JEEP_KMH = 30.0      # Average jeepney speed in PH traffic
SPEED_WALK_KMH = 4.0       # Average walking speed
TRANSFER_PENALTY_MIN = 10.0 # Time penalty to board/transfer vehicles

SPEED_BY_TYPE_KMH = {
    "jeep": SPEED_JEEP_KMH,
    "walk": SPEED_WALK_KMH,
}

# OSM `highway` tags that are pedestrian-only. Used to infer mode for
# features (e.g. walk_paths.geojson) that carry no explicit "type"/"mode"
# property of their own.
PEDESTRIAN_HIGHWAY_TAGS = {"footway", "path", "pedestrian", "steps", "cycleway", "track"}


def _infer_vehicle_type(props: dict) -> str | None:
    """Determine a feature's transit mode.

    Returns None (caller should skip the feature) when the mode can't be
    determined from explicit data — e.g. a raw OSM road segment (highway=
    residential/tertiary/etc.) with no route_long_name/type/mode of its own.
    Silently defaulting those to "jeep" would fabricate jeepney routes out of
    generic street geometry that was never verified as jeepney-served.
    """
    explicit = props.get("type") or props.get("mode")
    if explicit:
        return explicit
    if props.get("highway") in PEDESTRIAN_HIGHWAY_TAGS:
        return "walk"
    return None

# --- Spatial Math ---
def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def snap_coordinate(lat, lng):
    # Round to 5 decimal places (~1 meter) to merge intersections
    return round(lat, 5), round(lng, 5)

# --- GeoJSON Parsing & Graph Building ---
def build_transit_graph(data_dir: str) -> nx.DiGraph:
    G = nx.DiGraph()
    spatial_grid = defaultdict(list)  # For transfer edges: {(grid_x, grid_y): [node_ids]}
    GRID_SIZE = 0.0005  # ~50 meters

    ignore_dirs = {"Archive", "archive", ".git", "node_modules"}
    ignore_files = {"stops.geojson", "package.json", "config.json", ".DS_Store"}

    skipped_unlabeled = 0

    for root, dirs, files in os.walk(data_dir):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        for file in files:
            if file.endswith(".geojson") and file not in ignore_files:
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    geojson_data = json.load(f)

                features = geojson_data.get("features", [])
                for feature in features:
                    props = feature.get("properties", {})
                    geom = feature.get("geometry", {})
                    geom_type = geom.get("type")

                    # Only LineString/MultiLineString features can contribute
                    # edges — skip Points (POIs, schools, etc.) before mode
                    # inference so the skip counter below reflects genuinely
                    # ambiguous line data, not irrelevant Point features.
                    if geom_type not in ("LineString", "MultiLineString"):
                        continue

                    vehicle_type = _infer_vehicle_type(props)
                    if vehicle_type is None:
                        # No explicit type/mode and not a recognized pedestrian
                        # OSM tag — skip rather than fabricate a jeepney route
                        # out of an untyped road segment.
                        skipped_unlabeled += 1
                        continue

                    route_name = props.get("route_long_name") or props.get("name") or file.replace(".geojson", "")
                    is_bidirectional = props.get("bidirectional", False)

                    if geom_type == "MultiLineString":
                        # STRICT RULE: Iterate MultiLineString arrays individually. NEVER flatten.
                        for line_coords in geom.get("coordinates", []):
                            _process_line(G, spatial_grid, line_coords, route_name, vehicle_type, is_bidirectional, GRID_SIZE)
                    else:
                        line_coords = geom.get("coordinates", [])
                        _process_line(G, spatial_grid, line_coords, route_name, vehicle_type, is_bidirectional, GRID_SIZE)

     # Inject Transfer (Walk) Edges using Spatial Hashing
    _inject_transfer_edges(G, spatial_grid)

    # PERFORMANCE FIX: Attach the grid to the graph for fast virtual node lookups
    G.graph['spatial_grid'] = spatial_grid
    G.graph['grid_size'] = GRID_SIZE
    G.graph['skipped_unlabeled_features'] = skipped_unlabeled

    return G

def _process_line(G, spatial_grid, line_coords, route_name, vehicle_type, is_bidirectional, grid_size):
    speed_kmh = SPEED_BY_TYPE_KMH.get(vehicle_type, SPEED_JEEP_KMH)
    prev_node = None
    for coord in line_coords:
        lng, lat = coord[0], coord[1]
        node_id = f"{snap_coordinate(lat, lng)}"

        if not G.has_node(node_id):
            G.add_node(node_id, lat=lat, lng=lng)
            # Add to spatial grid for transfer logic
            gx, gy = int(lat / grid_size), int(lng / grid_size)
            spatial_grid[(gx, gy)].append(node_id)

        if prev_node and prev_node != node_id:
            u_attrs = G.nodes[prev_node]
            v_attrs = G.nodes[node_id]
            dist = haversine(u_attrs['lat'], u_attrs['lng'], v_attrs['lat'], v_attrs['lng'])

            # STRICT RULE: No Teleportation. Prevent GPS gaps from creating straight lines.
            if dist < 500:
                time_min = (dist / 1000) / speed_kmh * 60
                routing_weight = time_min + (dist / 1000) * 0.5
                
                # 1. Add the forward edge
                if not G.has_edge(prev_node, node_id):
                    G.add_edge(prev_node, node_id, distance=dist, time_min=time_min, routing_weight=routing_weight, route=route_name, type=vehicle_type)
                
                # 2. THE FIX: Force the reverse edge for ALL transit (Jeepneys always have a return trip!)
                if not G.has_edge(node_id, prev_node):
                    G.add_edge(node_id, prev_node, distance=dist, time_min=time_min, routing_weight=routing_weight, route=route_name, type=vehicle_type)
        prev_node = node_id

def _inject_transfer_edges(G, spatial_grid):
    # Check adjacent grid cells for nodes from different routes to create walking transfers
    for (gx, gy), nodes in spatial_grid.items():
        neighbors = [(gx-1, gy-1), (gx-1, gy), (gx-1, gy+1), (gx, gy-1), (gx, gy+1), (gx+1, gy-1), (gx+1, gy), (gx+1, gy+1)]
        neighbor_nodes = []
        for n_coord in neighbors:
            neighbor_nodes.extend(spatial_grid.get(n_coord, []))
        
        for node_a in nodes:
            for node_b in neighbor_nodes:
                if node_a != node_b:
                    a_attrs = G.nodes[node_a]
                    b_attrs = G.nodes[node_b]
                    dist = haversine(a_attrs['lat'], a_attrs['lng'], b_attrs['lat'], b_attrs['lng'])
                    
                    # If physically close but different nodes, and not already connected
                    if 0 < dist < 1000 and not G.has_edge(node_a, node_b):
                        # THE FIX: Add the massive 30-minute penalty to the time
                        time_min = ((dist / 100) / SPEED_WALK_KMH * 60) + TRANSFER_PENALTY_MIN
                        
                        # THE FIX: Transfer edges use the penalized time as their weight
                        routing_weight = time_min 
                        
                        G.add_edge(node_a, node_b, distance=dist, time_min=time_min, routing_weight=routing_weight, route="WALK_TRANSFER", type="walk")