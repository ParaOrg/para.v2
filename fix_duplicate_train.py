#!/usr/bin/env python3
"""Remove duplicate train route."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def fix_train_duplicate():
    print("🔧 Fixing duplicate train route...\n")
    
    # Check for Taft Ave - North Ave (the duplicate)
    res = supabase.table("ph_route_reference").select("id, route_name, mode, source_file").eq("route_name", "Taft Ave - North Ave").execute()
    
    if res.data:
        for route in res.data:
            print(f"   Found: {route['route_name']} (ID: {route['id']}, mode: {route['mode']}, source: {route.get('source_file')})")
            
            # Delete this duplicate since we already have "Taft Avenue - North Avenue"
            if route.get("source_file") == "full_jeepney_routes.csv":
                supabase.table("ph_route_reference").delete().eq("id", route["id"]).execute()
                print(f"   ✅ Deleted duplicate")
    else:
        print("   No duplicate found")
    
    # Final train count
    train_res = supabase.table("ph_route_reference").select("route_name").eq("mode", "train").execute()
    print(f"\n🚆 Train routes ({len(train_res.data)}):")
    if train_res.data:
        for route in train_res.data:
            print(f"   • {route['route_name']}")
    
    # Final counts
    print(f"\n📊 FINAL COUNTS:")
    modes = ['train', 'bus', 'jeepney', 'bgc_bus', 'p2p', 'uv_express']
    for mode in modes:
        count_res = supabase.table("ph_route_reference").select("count", count="exact").eq("mode", mode).limit(0).execute()
        count = count_res.count if hasattr(count_res, 'count') else 0
        print(f"   {mode}: {count}")

if __name__ == "__main__":
    fix_train_duplicate()
