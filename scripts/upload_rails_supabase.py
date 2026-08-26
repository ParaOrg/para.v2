#!/usr/bin/env python3
"""Upload rail data to Supabase via REST API."""
import json
import os
import sys
import urllib.request
import urllib.error

SUPABASE_URL = "https://tcvomrkytxnetzijwqad.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdm9tcmt5dHhuZXR6aWp3cWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzY3NDgsImV4cCI6MjA3MzAxMjc0OH0.ljYfw72N5dm4GsM1yKvV4bNNb8sWEoErTD3TrGz1s0o"

GEOJSON_DIR = "/mnt/nvme-drive/para.v2/para.v2/geojson_data"

def safe_val(v):
    if v is None or v == "":
        return None
    return v

def post_to_supabase(table, records):
    """POST records to Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    
    success = 0
    failed = 0
    
    for i, record in enumerate(records):
        data = json.dumps(record).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        
        try:
            resp = urllib.request.urlopen(req)
            success += 1
        except urllib.error.HTTPError as e:
            failed += 1
            if failed <= 3:
                print(f"  ❌ Failed: {e.code} - {e.read().decode()[:100]}")
        
        if (i + 1) % 50 == 0:
            print(f"  Progress: {i+1}/{len(records)} (✅ {success} ❌ {failed})")
    
    print(f"  Complete: ✅ {success} ❌ {failed}")
    return success, failed

def load_geojson(filename):
    with open(os.path.join(GEOJSON_DIR, filename)) as f:
        return json.load(f)

def main():
    print("🚀 Uploading rail data to Supabase")
    print("=" * 50)
    
    # ── LINES ──────────────────────────────
    print("\n📥 Uploading rail_network_lines...")
    lines_data = load_geojson("rail_network_lines.geojson")
    lines_records = []
    
    for feat in lines_data.get("features", []):
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        coords = geom.get("coordinates", [])
        
        if len(coords) < 2:
            continue
        
        points_wkt = [f"{lng} {lat}" for lng, lat in coords]
        wkt = f"LINESTRING({', '.join(points_wkt)})"
        
        lines_records.append({
            "full_id": safe_val(props.get("full_id")),
            "osm_id": safe_val(props.get("osm_id")),
            "osm_type": safe_val(props.get("osm_type")),
            "railway": safe_val(props.get("railway")),
            "name": safe_val(props.get("name")),
            "geom": wkt,
        })
    
    post_to_supabase("rail_network_lines", lines_records)
    
    # ── POINTS ─────────────────────────────
    print("\n📥 Uploading rail_network_points...")
    points_data = load_geojson("rail_network_points.geojson")
    points_records = []
    
    for feat in points_data.get("features", []):
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        coords = geom.get("coordinates", [])
        
        if len(coords) < 2:
            continue
        
        lng, lat = coords[0], coords[1]
        
        points_records.append({
            "fid": safe_val(props.get("fid")),
            "full_id": safe_val(props.get("full_id")),
            "osm_id": safe_val(props.get("osm_id")),
            "osm_type": safe_val(props.get("osm_type")),
            "railway": safe_val(props.get("railway")),
            "name": safe_val(props.get("name")),
            "geom": f"POINT({lng} {lat})",
        })
    
    post_to_supabase("rail_station_points", points_records)
    
    # ── SHAPES ─────────────────────────────
    print("\n📥 Uploading rail_network_shapes...")
    shapes_data = load_geojson("rail_network_shapes.geojson")
    shapes_records = []
    
    for feat in shapes_data.get("features", []):
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        coords = geom.get("coordinates", [])
        
        if not coords:
            continue
        
        wkt_parts = []
        for polygon in coords:
            ring_parts = []
            for ring in polygon:
                pts = [f"{lng} {lat}" for lng, lat in ring]
                ring_parts.append(f"({', '.join(pts)})")
            wkt_parts.append(f"({', '.join(ring_parts)})")
        wkt = f"MULTIPOLYGON({', '.join(wkt_parts)})"
        
        shapes_records.append({
            "full_id": safe_val(props.get("full_id")),
            "osm_id": safe_val(props.get("osm_id")),
            "osm_type": safe_val(props.get("osm_type")),
            "railway": safe_val(props.get("railway")),
            "wikipedia": safe_val(props.get("wikipedia")),
            "wikidata": safe_val(props.get("wikidata")),
            "type": safe_val(props.get("type")),
            "building": safe_val(props.get("building")),
            "subway": safe_val(props.get("subway")),
            "station": safe_val(props.get("station")),
            "public_transport": safe_val(props.get("public_transport")),
            "start_date": safe_val(props.get("start_date")),
            "operator": safe_val(props.get("operator")),
            "network": safe_val(props.get("network")),
            "name": safe_val(props.get("name")),
            "geom": json.dumps(geom),  # Store as GeoJSON object
        })
    
    post_to_supabase("rail_station_shapes", shapes_records)
    
    print("\n" + "=" * 50)
    print("✅ Upload complete!")

if __name__ == "__main__":
    main()
