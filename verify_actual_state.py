#!/usr/bin/env python3
"""Verify actual state - cross-check CSV vs database properly."""

import csv
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def verify():
    print("🔍 PROPER VERIFICATION\n")
    
    # Get all routes from CSV
    csv_routes = set()
    with open("geojson_data/full_jeepney_routes.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            route_name = row.get("route_long_name", "").strip()
            if route_name:
                csv_routes.add(route_name)
    
    print(f"📄 CSV routes: {len(csv_routes)}")
    
    # Get all routes from database (regardless of source_file)
    db_routes = {}
    res = supabase.table("ph_route_reference").select("route_name, mode, source_file").execute()
    if res.data:
        for route in res.data:
            db_routes[route["route_name"]] = {
                "mode": route.get("mode"),
                "source": route.get("source_file"),
            }
    
    print(f"📊 Database routes: {len(db_routes)}")
    
    # Find routes in CSV but NOT in database
    truly_missing = csv_routes - set(db_routes.keys())
    print(f"\n❌ Truly missing from database: {len(truly_missing)}")
    if truly_missing:
        for name in sorted(truly_missing)[:20]:
            print(f"   • {name}")
    
    # Find routes in database but NOT in CSV
    extra = set(db_routes.keys()) - csv_routes
    print(f"\n⚠️ Extra in database (not in CSV): {len(extra)}")
    if extra:
        for name in sorted(extra)[:20]:
            print(f"   • {name}")
    
    # Check mode distribution of CSV routes in database
    csv_modes = {}
    for route_name in csv_routes:
        if route_name in db_routes:
            mode = db_routes[route_name]["mode"]
            csv_modes[mode] = csv_modes.get(mode, 0) + 1
    
    print(f"\n📊 Mode distribution of CSV routes in database:")
    for mode, count in sorted(csv_modes.items(), key=lambda x: -x[1]):
        print(f"   {mode}: {count}")
    
    # The real question: what's the jeepney count?
    jeepney_count = csv_modes.get("jeepney", 0)
    bus_count = csv_modes.get("bus", 0)
    train_count = csv_modes.get("train", 0)
    
    print(f"\n📋 Summary for CSV routes:")
    print(f"   Jeepney in CSV: {jeepney_count}")
    print(f"   Bus in CSV: {bus_count}")
    print(f"   Train in CSV: {train_count}")
    print(f"   Total in CSV: {jeepney_count + bus_count + train_count}")
    
    # What your message says
    print(f"\n📋 Your message says:")
    print(f"   Jeep: ~889 routes")
    print(f"   Bus: 93 routes")
    print(f"   Train: 4 routes")
    
    # Check if the numbers make sense
    if jeepney_count >= 800:
        print(f"\n✅ Jeepney count looks correct: {jeepney_count}")
    else:
        print(f"\n⚠️ Jeepney count seems low: {jeepney_count}")

if __name__ == "__main__":
    verify()
