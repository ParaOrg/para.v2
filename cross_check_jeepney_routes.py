#!/usr/bin/env python3
"""Cross-check full_jeepney_routes.csv against ph_route_reference to find missing routes."""

import csv
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def cross_check():
    print("🔍 CROSS-CHECKING full_jeepney_routes.csv vs ph_route_reference\n")
    
    # Read all route names from CSV
    csv_routes = set()
    csv_route_details = {}
    
    with open("geojson_data/full_jeepney_routes.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            route_name = row.get("route_long_name", "").strip()
            if route_name:
                csv_routes.add(route_name)
                if route_name not in csv_route_details:
                    csv_route_details[route_name] = {
                        "agency": row.get("agency_id", ""),
                        "route_type": row.get("route_type", ""),
                        "route_id": row.get("route_id", ""),
                    }
    
    print(f"📄 Routes in CSV: {len(csv_routes)}")
    
    # Get all routes from Supabase that came from full_jeepney_routes.csv
    db_routes = set()
    db_route_details = {}
    
    # Fetch in pages
    page_size = 1000
    start = 0
    while True:
        res = supabase.table("ph_route_reference").select("route_name, mode, source_file").eq("source_file", "full_jeepney_routes.csv").range(start, start + page_size - 1).execute()
        if not res.data:
            break
        for route in res.data:
            route_name = route.get("route_name", "").strip()
            if route_name:
                db_routes.add(route_name)
                db_route_details[route_name] = {
                    "mode": route.get("mode", ""),
                    "source_file": route.get("source_file", ""),
                }
        if len(res.data) < page_size:
            break
        start += page_size
    
    print(f"📊 Routes in Supabase (from full_jeepney_routes.csv): {len(db_routes)}")
    
    # Find missing routes
    missing_routes = csv_routes - db_routes
    extra_routes = db_routes - csv_routes
    
    print(f"\n❌ MISSING from Supabase: {len(missing_routes)}")
    if missing_routes:
        for route_name in sorted(missing_routes)[:50]:
            print(f"   • {route_name}")
            if route_name in csv_route_details:
                print(f"     Agency: {csv_route_details[route_name]['agency']}, Type: {csv_route_details[route_name]['route_type']}")
    
    print(f"\n⚠️ EXTRA in Supabase (not in CSV): {len(extra_routes)}")
    if extra_routes:
        for route_name in sorted(extra_routes)[:20]:
            print(f"   • {route_name}")
    
    # Check mode distribution of what's in Supabase
    print(f"\n📊 Mode distribution of routes from full_jeepney_routes.csv:")
    mode_counts = {}
    for route_name, details in db_route_details.items():
        mode = details.get("mode", "unknown")
        mode_counts[mode] = mode_counts.get(mode, 0) + 1
    
    for mode, count in sorted(mode_counts.items(), key=lambda x: -x[1]):
        print(f"   {mode}: {count}")
    
    # Check what the CSV actually says about route types
    print(f"\n📋 CSV Route Type distribution:")
    type_counts = {}
    for route_name, details in csv_route_details.items():
        route_type = details.get("route_type", "unknown")
        type_counts[route_type] = type_counts.get(route_type, 0) + 1
    
    for route_type, count in sorted(type_counts.items()):
        type_name = {
            "0": "Tram/Light Rail",
            "1": "Subway/Metro",
            "2": "Rail",
            "3": "Bus",
        }.get(route_type, f"Type {route_type}")
        print(f"   {type_name} ({route_type}): {count}")

if __name__ == "__main__":
    cross_check()
