#!/usr/bin/env python3
"""Restore ALL 893 routes from CSV and fix modes correctly."""

import csv
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def restore_all_csv_routes():
    print("🔧 Restoring ALL routes from full_jeepney_routes.csv\n")
    
    # Read ALL unique route names from CSV
    csv_routes = {}
    with open("geojson_data/full_jeepney_routes.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            route_name = row.get("route_long_name", "").strip()
            if route_name and route_name not in csv_routes:
                csv_routes[route_name] = {
                    "agency_id": row.get("agency_id", ""),
                    "route_type": row.get("route_type", ""),
                    "route_id": row.get("route_id", ""),
                }
    
    print(f"📄 Unique routes in CSV: {len(csv_routes)}")
    
    # First, restore mode for all existing routes from CSV
    print("\n🚐 Restoring all CSV routes to jeepney mode...")
    
    # Get all route IDs from CSV source
    res = supabase.table("ph_route_reference").select("id, route_name").eq("source_file", "full_jeepney_routes.csv").execute()
    
    if res.data:
        jeepney_count = 0
        for route in res.data:
            route_name = route["route_name"]
            # Check if this is a train route
            is_train = route_name in ["Baclaran - Roosevelt", "Recto - Santolan", 
                                      "Taft Ave - North Ave", "Metro Commuter"]
            
            mode = "train" if is_train else "jeepney"
            
            supabase.table("ph_route_reference").update({"mode": mode}).eq("id", route["id"]).execute()
            jeepney_count += 1
        
        print(f"   ✅ Restored {jeepney_count} routes")
    
    # Now insert missing routes
    print("\n📥 Inserting missing routes...")
    
    # Get existing route names from Supabase
    existing_res = supabase.table("ph_route_reference").select("route_name").eq("source_file", "full_jeepney_routes.csv").execute()
    existing_names = set()
    if existing_res.data:
        existing_names = {r["route_name"] for r in existing_res.data}
    
    # Also check ALL routes (not just CSV source)
    all_res = supabase.table("ph_route_reference").select("route_name").execute()
    all_names = set()
    if all_res.data:
        all_names = {r["route_name"] for r in all_res.data}
    
    missing = []
    for route_name in csv_routes:
        if route_name not in all_names:
            missing.append(route_name)
    
    print(f"   Missing routes to insert: {len(missing)}")
    
    inserted = 0
    for route_name in missing:
        is_train = route_name in ["Baclaran - Roosevelt", "Recto - Santolan", 
                                  "Taft Ave - North Ave", "Metro Commuter"]
        mode = "train" if is_train else "jeepney"
        
        # Parse origin/destination
        parts = route_name.split(" - ")
        origin = parts[0].strip() if len(parts) > 0 else None
        destination = parts[-1].strip() if len(parts) > 1 else None
        
        # Clean destination (remove "via" part)
        if destination and " via " in destination:
            destination = destination.split(" via ")[0].strip()
        
        record = {
            "route_name": route_name,
            "origin": origin,
            "destination": destination,
            "mode": mode,
            "source_file": "full_jeepney_routes.csv",
            "agency": csv_routes[route_name]["agency_id"],
        }
        
        try:
            res = supabase.table("ph_route_reference").insert(record).execute()
            if res.data:
                inserted += 1
                print(f"   ✅ {route_name}")
        except Exception as e:
            print(f"   ⚠️ Error inserting {route_name}: {e}")
    
    print(f"\n📊 Inserted {inserted} missing routes")
    
    # Final verification
    print("\n📊 FINAL COUNTS:")
    jeepney = supabase.table("ph_route_reference").select("count", count="exact").eq("mode", "jeepney").limit(0).execute()
    train = supabase.table("ph_route_reference").select("count", count="exact").eq("mode", "train").limit(0).execute()
    bus = supabase.table("ph_route_reference").select("count", count="exact").eq("mode", "bus").limit(0).execute()
    total = supabase.table("ph_route_reference").select("count", count="exact").limit(0).execute()
    
    print(f"   jeepney: {jeepney.count if hasattr(jeepney, 'count') else 0}")
    print(f"   train: {train.count if hasattr(train, 'count') else 0}")
    print(f"   bus: {bus.count if hasattr(bus, 'count') else 0}")
    print(f"   total: {total.count if hasattr(total, 'count') else 0}")

if __name__ == "__main__":
    restore_all_csv_routes()
