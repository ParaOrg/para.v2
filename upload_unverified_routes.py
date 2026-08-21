#!/usr/bin/env python3
"""Upload unverified jeep routes from GeoJSON to Supabase via route-save Edge Function"""

import json
import sys
import requests

ROUTE_SAVE_URL = "https://tcvomrkytxnetzijwqad.supabase.co/functions/v1/route-save"
GEOJSON_PATH = "geojson_data/cleaned_unverified_routes.geojson"

def load_geojson(path):
    with open(path, "r") as f:
        return json.load(f)

def extract_route_name(feature):
    props = feature.get("properties", {})
    for key in ["name", "route_name", "Name", "ROUTE_NAME", "route", "Route"]:
        if key in props and props[key]:
            return str(props[key])
    return f"Unverified Route {feature.get('id', 'unknown')}"

def extract_coordinates(geometry):
    geom_type = geometry.get("type")
    coords = geometry.get("coordinates", [])
    if geom_type == "LineString":
        return [[lat, lng] for lng, lat in coords]
    elif geom_type == "MultiLineString":
        longest = max(coords, key=len)
        return [[lat, lng] for lng, lat in longest]
    elif geom_type == "Polygon":
        return [[lat, lng] for lng, lat in coords[0]]
    else:
        return []

def upload_route(name, coordinates, mode="jeepney", submitted_by="gabri@para.ph"):
    payload = {
        "route_name": name,
        "mode": mode if mode in ['jeepney', 'bus', 'train', 'rail', 'lrt', 'mrt', 'uv_express', 'trike', 'ferry'] else 'jeepney',
        "path_coordinates": coordinates,
        "submitted_by": submitted_by,
        "region": "ncr",
    }
    try:
        res = requests.post(ROUTE_SAVE_URL, json=payload, timeout=30)
        if res.status_code == 200:
            data = res.json()
            if data.get("success"):
                return True, data.get("route_uuid", "")
            return False, data.get("error", "Unknown")
        return False, f"HTTP {res.status_code}"
    except Exception as e:
        return False, str(e)

def main():
    print(f"Loading: {GEOJSON_PATH}")
    try:
        geojson = load_geojson(GEOJSON_PATH)
    except FileNotFoundError:
        print(f"File not found: {GEOJSON_PATH}")
        sys.exit(1)

    features = geojson.get("features", [])
    print(f"Found {len(features)} features\n")

    ok_count = 0
    fail_count = 0
    skip_count = 0

    for i, feature in enumerate(features, 1):
        name = extract_route_name(feature)
        coords = extract_coordinates(feature.get("geometry", {}))
        if len(coords) < 2:
            print(f"  [{i}/{len(features)}] SKIP {name} — <2 points")
            skip_count += 1
            continue
        print(f"  [{i}/{len(features)}] Uploading: {name} ({len(coords)} pts)...")
        mode = feature.get('properties', {}).get('mode', 'jeepney')
        ok, result = upload_route(name, coords, mode)
        if ok:
            ok_count += 1
            print(f"    OK {result}")
        else:
            fail_count += 1
            print(f"    FAIL {result}")

    print(f"\nDone: {ok_count} OK, {fail_count} FAIL, {skip_count} SKIP")

if __name__ == "__main__":
    main()
