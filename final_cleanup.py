#!/usr/bin/env python3
"""Final cleanup - fix train count and verify all modes."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def final_cleanup():
    print("🔧 Final cleanup\n")
    
    # Check for duplicate trains (Taft Ave vs Taft Avenue)
    print("🚆 Checking train routes...")
    train_res = supabase.table("ph_route_reference").select("id, route_name").eq("mode", "train").execute()
    if train_res.data:
        for route in train_res.data:
            print(f"   • {route['route_name']} (id: {route['id']})")
        
        # Check for duplicates
        names = [r["route_name"] for r in train_res.data]
        if "Taft Ave - North Ave" in names and "Taft Avenue - North Avenue" in names:
            print("\n⚠️ Found duplicate Taft route names!")
            # Keep the one from manual_population and update the other
            for route in train_res.data:
                if route["route_name"] == "Taft Ave - North Ave":
                    # This is from GTFS CSV - update to match the proper name
                    supabase.table("ph_route_reference").update({
                        "route_name": "Taft Avenue - North Avenue"
                    }).eq("id", route["id"]).execute()
                    print(f"   ✅ Renamed to: Taft Avenue - North Avenue")
                    break
    
    # Final verification
    print("\n📊 FINAL MODE COUNTS:")
    modes = ['train', 'bus', 'jeepney', 'bgc_bus', 'p2p', 'uv_express']
    total = 0
    
    for mode in modes:
        count_res = supabase.table("ph_route_reference").select("count", count="exact").eq("mode", mode).limit(0).execute()
        count = count_res.count if hasattr(count_res, 'count') else 0
        total += count
        print(f"   {mode}: {count}")
    
    print(f"\n   Total: {total}")
    print(f"   Expected: 889 (jeep) + 4 (train) + 93 (bus) + 5 (bgc) + 38 (p2p) + 65 (uv) = 1094")
    
    # Check for duplicate route names
    print("\n🔍 Checking for duplicates...")
    res = supabase.table("ph_route_reference").select("route_name").execute()
    if res.data:
        from collections import Counter
        names = [r["route_name"] for r in res.data]
        duplicates = [name for name, count in Counter(names).items() if count > 1]
        
        if duplicates:
            print(f"⚠️ Found {len(duplicates)} duplicate route names")
            for dup in duplicates[:10]:
                print(f"   • {dup}")
        else:
            print("✅ No duplicates found")

if __name__ == "__main__":
    final_cleanup()
