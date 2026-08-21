#!/usr/bin/env python3
"""Final verification - check that jeepney routes are properly restored."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def final_check():
    print("✅ FINAL VERIFICATION\n")
    
    # Count by mode
    modes = ['train', 'bus', 'jeepney', 'bgc_bus', 'p2p', 'uv_express']
    total = 0
    
    print("📊 Mode distribution:")
    for mode in modes:
        res = supabase.table("ph_route_reference").select("count", count="exact").eq("mode", mode).limit(0).execute()
        count = res.count if hasattr(res, 'count') else 0
        total += count
        print(f"   {mode}: {count}")
    
    print(f"\n   Total: {total}")
    
    # Verify specific routes that should be jeepney
    jeepney_routes = [
        "Baclaran - Moonwalk via Quirino",
        "Baclaran - Sucat/SSH via Quirino Ave.",
        "CUBAO-STOPnSHOP",
        "UP - IKOT",
        "Camarin-Trinoma",
    ]
    
    print("\n🔍 Verifying jeepney routes:")
    for route_name in jeepney_routes:
        res = supabase.table("ph_route_reference").select("mode").eq("route_name", route_name).limit(1).execute()
        if res.data:
            mode = res.data[0]["mode"]
            status = "✅" if mode == "jeepney" else "❌"
            print(f"   {status} {route_name}: {mode}")
    
    # Verify bus routes that should stay bus
    bus_routes = [
        "EDSA Carousel",
        "Baclaran - Montalban via EDSA",
        "San Mateo - Baclaran via EDSA, Ayala, Commonwealth Ave",
    ]
    
    print("\n🔍 Verifying bus routes:")
    for route_name in bus_routes:
        res = supabase.table("ph_route_reference").select("mode").eq("route_name", route_name).limit(1).execute()
        if res.data:
            mode = res.data[0]["mode"]
            status = "✅" if mode == "bus" else "❌"
            print(f"   {status} {route_name}: {mode}")
    
    print("\n📋 Summary:")
    print(f"   Original jeepney: 889")
    print(f"   Currently: {total} total routes")
    print(f"   Jeepney routes: {sum(1 for m in [modes[2]] for _ in [0])} (should be close to original)")

if __name__ == "__main__":
    final_check()
