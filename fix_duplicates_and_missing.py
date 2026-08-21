#!/usr/bin/env python3
"""Fix duplicate train route and find missing jeepney routes."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def fix_duplicate():
    print("🔧 Fixing duplicate train route...\n")
    
    # Find the duplicate
    res = supabase.table("ph_route_reference").select("id, route_name, source_file, created_at").eq("route_name", "Taft Avenue - North Avenue").execute()
    
    if res.data and len(res.data) > 1:
        print(f"Found {len(res.data)} duplicates:")
        for route in res.data:
            print(f"   • ID: {route['id']}, source: {route.get('source_file')}, created: {route.get('created_at')}")
        
        # Keep the one from manual_population, delete the other
        for route in res.data:
            if route.get("source_file") != "manual_population":
                supabase.table("ph_route_reference").delete().eq("id", route["id"]).execute()
                print(f"   ✅ Deleted duplicate (ID: {route['id']}, source: {route.get('source_file')})")
                break
    else:
        print("No duplicates found or only one exists")
    
    # Check train count
    train_res = supabase.table("ph_route_reference").select("route_name").eq("mode", "train").execute()
    if train_res.data:
        print(f"\n🚆 Train routes after fix:")
        for route in train_res.data:
            print(f"   • {route['route_name']}")

def find_missing_jeepney():
    print("\n🔍 Finding missing jeepney routes...")
    
    # Get all jeepney routes from CSV
    import csv
    csv_jeepney = set()
    
    with open("geojson_data/full_jeepney_routes.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            route_name = row.get("route_long_name", "").strip()
            if route_name:
                csv_jeepney.add(route_name)
    
    # Get all routes currently in database
    db_routes = set()
    res = supabase.table("ph_route_reference").select("route_name").execute()
    if res.data:
        db_routes = {r["route_name"] for r in res.data}
    
    # Find missing
    missing = csv_jeepney - db_routes
    print(f"Missing from CSV: {len(missing)}")
    
    if missing:
        for route_name in sorted(missing)[:20]:
            print(f"   • {route_name}")

def final_counts():
    print("\n📊 FINAL COUNTS:")
    modes = ['train', 'bus', 'jeepney', 'bgc_bus', 'p2p', 'uv_express']
    total = 0
    
    for mode in modes:
        count_res = supabase.table("ph_route_reference").select("count", count="exact").eq("mode", mode).limit(0).execute()
        count = count_res.count if hasattr(count_res, 'count') else 0
        total += count
        print(f"   {mode}: {count}")
    
    print(f"   Total: {total}")

if __name__ == "__main__":
    fix_duplicate()
    find_missing_jeepney()
    final_counts()
