#!/usr/bin/env python3
"""Upload only rail shapes to Supabase."""
import json
import os
import urllib.request
import urllib.error

SUPABASE_URL = "https://tcvomrkytxnetzijwqad.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdm9tcmt5dHhuZXR6aWp3cWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzY3NDgsImV4cCI6MjA3MzAxMjc0OH0.ljYfw72N5dm4GsM1yKvV4bNNb8sWEoErTD3TrGz1s0o"
GEOJSON_DIR = "/mnt/nvme-drive/para.v2/para.v2/geojson_data"

def safe_val(v):
    return v if v not in (None, "") else None

def main():
    with open(os.path.join(GEOJSON_DIR, "rail_network_shapes.geojson")) as f:
        data = json.load(f)
    
    features = data.get("features", [])
    print(f"Uploading {len(features)} shapes...")
    
    success = 0
    failed = 0
    
    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        
        record = {
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
            "geom": json.dumps(geom),
        }
        
        url = f"{SUPABASE_URL}/rest/v1/rail_network_shapes"
        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }
        
        req = urllib.request.Request(url, data=json.dumps(record).encode(), headers=headers, method="POST")
        
        try:
            urllib.request.urlopen(req)
            success += 1
        except urllib.error.HTTPError as e:
            failed += 1
            if failed <= 2:
                print(f"  Failed: {e.code} - {e.read().decode()[:100]}")
    
    print(f"Complete: ✅ {success} ❌ {failed}")

if __name__ == "__main__":
    main()
