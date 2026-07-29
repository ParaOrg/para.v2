import json
import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def prepare_jeep_routes(input_file: str, output_file: str):
    with open(input_file, 'r', encoding='utf-8') as f:
        geojson_data = json.load(f)

    for feature in geojson_data.get("features", []):
        props = feature.setdefault("properties", {})
        
        if "type" not in props:
            props["type"] = "jeep"
        if "mode" not in props:
            props["mode"] = "jeep"
        
        # Detect if this is a loop route (start and end within 100m)
        geom = feature.get("geometry", {})
        coords = geom.get("coordinates", [])
        if geom.get("type") == "MultiLineString":
            coords = coords[0] if coords else []
        
        is_loop = False
        if len(coords) >= 3:
            first = coords[0]
            last = coords[-1]
            dist = haversine(last[1], last[0], first[1], first[0])
            is_loop = dist < 100  # within 100m = loop
        
        # Loops are one-way, non-loops are bidirectional
        props["bidirectional"] = not is_loop
        if is_loop:
            props["loop"] = True

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(geojson_data, f, indent=2)
    print(f"✅ Processed {len(geojson_data['features'])} routes. Saved to {output_file}")

if __name__ == "__main__":
    prepare_jeep_routes("routes.geojson", "routes_processed.geojson")