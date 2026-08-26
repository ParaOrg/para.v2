#!/usr/bin/env python3
"""Ingest rail GeoJSON files into PostGIS."""
import os
import json
import sys
import subprocess

GEOJSON_DIR = "/mnt/nvme-drive/para.v2/para.v2/geojson_data"

# Supabase connection string (from .env)
SUPABASE_URL = "https://tcvomrkytxnetzijwqad.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdm9tcmt5dHhuZXR6aWp3cWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzY3NDgsImV4cCI6MjA3MzAxMjc0OH0.ljYfw72N5dm4GsM1yKvV4bNNb8sWEoErTD3TrGz1s0o"

def safe_val(v):
    if v is None or v == "":
        return None
    if isinstance(v, float) and (v != v):  # NaN
        return None
    return v

def load_geojson(filename):
    filepath = os.path.join(GEOJSON_DIR, filename)
    with open(filepath) as f:
        return json.load(f)

def main():
    print("🚀 Para PH Rail Ingestion")
    print("=" * 50)
    
    # ── LINES ──────────────────────────────
    print("\n📥 Ingesting rail_network_lines...")
    lines_data = load_geojson("rail_network_lines.geojson")
    lines_features = lines_data.get("features", [])
    print(f"  Features: {len(lines_features)}")
    
    lines_records = []
    for feat in lines_features:
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        coords = geom.get("coordinates", [])
        
        if len(coords) < 2:
            continue
        
        # Convert to WKT LineString
        points = [f"{lng} {lat}" for lng, lat in coords]
        wkt = f"LINESTRING({', '.join(points)})"
        
        lines_records.append({
            "full_id": safe_val(props.get("full_id")),
            "osm_id": safe_val(props.get("osm_id")),
            "osm_type": safe_val(props.get("osm_type")),
            "railway": safe_val(props.get("railway")),
            "name": safe_val(props.get("name")),
            "geom_wkt": wkt,
        })
    
    print(f"  ✅ Prepared {len(lines_records)} line records")
    
    # ── POINTS ─────────────────────────────
    print("\n📥 Ingesting rail_network_points...")
    points_data = load_geojson("rail_network_points.geojson")
    points_features = points_data.get("features", [])
    print(f"  Features: {len(points_features)}")
    
    points_records = []
    for feat in points_features:
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
            "lat": lat,
            "lng": lng,
        })
    
    print(f"  ✅ Prepared {len(points_records)} point records")
    
    # ── SHAPES ─────────────────────────────
    print("\n📥 Ingesting rail_network_shapes...")
    shapes_data = load_geojson("rail_network_shapes.geojson")
    shapes_features = shapes_data.get("features", [])
    print(f"  Features: {len(shapes_features)}")
    
    shapes_records = []
    for feat in shapes_features:
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        coords = geom.get("coordinates", [])
        
        if not coords:
            continue
        
        # MultiPolygon: [[ [ [lng, lat], ... ] ]]
        wkt_parts = []
        for polygon in coords:
            ring_parts = []
            for ring in polygon:
                points = [f"{lng} {lat}" for lng, lat in ring]
                ring_parts.append(f"({', '.join(points)})")
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
            "geom_wkt": wkt,
        })
    
    print(f"  ✅ Prepared {len(shapes_records)} shape records")
    
    # ── OUTPUT SUMMARY ─────────────────────
    print("\n" + "=" * 50)
    print("📊 INGESTION SUMMARY")
    print(f"  Lines:  {len(lines_records)}")
    print(f"  Points: {len(points_records)}")
    print(f"  Shapes: {len(shapes_records)}")
    print("\n🔗 To load into Supabase, use the Supabase SQL editor")
    print("   with the generated SQL statements, or use the REST API.")
    print("\n✅ Data inspection complete.")

if __name__ == "__main__":
    main()
