#!/usr/bin/env python3
"""Check source files and route types from the GTFS CSV."""

import csv
from collections import Counter
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def check_gtfs_route_types():
    print("📁 GTFS Route Types from full_jeepney_routes.csv\n")
    
    # Read the CSV to understand route types
    route_types = {}
    with open("geojson_data/full_jeepney_routes.csv", "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            route_id = row.get("route_id", "")
            route_long_name = row.get("route_long_name", "")
            route_type = row.get("route_type", "")
            
            if route_long_name not in route_types:
                route_types[route_long_name] = {
                    "route_type": route_type,
                    "route_id": route_id,
                    "agency_id": row.get("agency_id", ""),
                }
    
    # Count route types
    type_counts = Counter()
    type_names = {}
    
    for route_name, info in route_types.items():
        route_type = info["route_type"]
        type_counts[route_type] += 1
        
        # Map route type to name
        type_map = {
            "0": "Tram/Light Rail",
            "1": "Subway/Metro",
            "2": "Rail",
            "3": "Bus",
        }
        type_names[route_type] = type_map.get(route_type, f"Type {route_type}")
    
    print("GTFS Route Types:")
    for route_type, count in sorted(type_counts.items()):
        print(f"   {type_names.get(route_type, route_type)} ({route_type}): {count} routes")
    
    # Now check what we have in Supabase
    print("\n\nSupabase current state:")
    res = supabase.table("ph_route_reference").select("route_name, mode").execute()
    if res.data:
        mode_counts = Counter()
        for route in res.data:
            mode_counts[route.get("mode", "unknown")] += 1
        
        for mode, count in sorted(mode_counts.items(), key=lambda x: -x[1]):
            print(f"   {mode}: {count}")
    
    # Check specific routes that should be train
    print("\n\n🔍 Routes that should be TRAIN (route_type 0-2):")
    train_routes = [name for name, info in route_types.items() if info["route_type"] in ["0", "1", "2"]]
    for route_name in train_routes:
        print(f"   • {route_name}")
        print(f"     GTFS type: {route_types[route_name]['route_type']}")
        print(f"     Agency: {route_types[route_name]['agency_id']}")
    
    # Check specific routes that should be BUS (route_type 3)
    print("\n\n🔍 Sample routes that should be BUS (route_type 3):")
    bus_routes = [name for name, info in route_types.items() if info["route_type"] == "3"]
    for route_name in bus_routes[:10]:
        print(f"   • {route_name}")
        print(f"     GTFS type: {route_types[route_name]['route_type']}")
        print(f"     Agency: {route_types[route_name]['agency_id']}")

if __name__ == "__main__":
    check_gtfs_route_types()
