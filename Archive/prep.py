import json
import os

ROUTE_FILE = "jeep_routes_07162026.geojson"

def build_stops():
    if not os.path.exists(ROUTE_FILE):
        print(f"Error: {ROUTE_FILE} not found!")
        return

    with open(ROUTE_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    stops = {"type": "FeatureCollection", "features": []}
    seen = set()
    counter = 1

    for feature in data.get("features", []):
        geom = feature["geometry"]
        geom_type = geom["type"]
        coords = []

        # Handle LineString OR MultiLineString
        if geom_type == "LineString":
            coords = geom["coordinates"]
        elif geom_type == "MultiLineString":
            # Just take the first line segment if it's multi-part
            coords = geom["coordinates"][0]

        if coords:
            for pt in [coords[0], coords[-1]]:
                lng = round(float(pt[0]), 5)
                lat = round(float(pt[1]), 5)
                if (lng, lat) not in seen:
                    seen.add((lng, lat))
                    stops["features"].append({
                        "type": "Feature",
                        "properties": {"id": f"STOP_{counter:04d}", "name": f"Terminal_{counter:04d}"},
                        "geometry": {"type": "Point", "coordinates": [lng, lat]}
                    })
                    counter += 1

    with open("stops.geojson", "w", encoding="utf-8") as f:
        json.dump(stops, f, indent=4)
    print(f"Success! Created stops.geojson with {counter-1} unique stops.")

if __name__ == "__main__":
    build_stops()