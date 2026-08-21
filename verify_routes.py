#!/usr/bin/env python3
"""Verify that routes are properly inserted in ph_route_reference."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def verify():
    # Check total count
    res = supabase.table("ph_route_reference").select("count", count="exact").limit(0).execute()
    total_count = res.count if hasattr(res, 'count') else len(res.data or [])
    print(f"\n📊 Total routes in ph_route_reference: {total_count}")
    
    # Check by mode
    modes = ['train', 'bus', 'jeepney', 'bgc_bus', 'p2p', 'uv_express']
    print("\n📈 Routes by mode:")
    for mode in modes:
        mode_res = supabase.table("ph_route_reference").select("count", count="exact").eq("mode", mode).limit(0).execute()
        count = mode_res.count if hasattr(mode_res, 'count') else len(mode_res.data or [])
        print(f"   {mode}: {count}")
    
    # Check for duplicates
    dup_res = supabase.table("ph_route_reference").select("route_name").execute()
    if dup_res.data:
        names = [r['route_name'] for r in dup_res.data]
        duplicates = set([n for n in names if names.count(n) > 1])
        if duplicates:
            print(f"\n⚠️ Found {len(duplicates)} duplicate route names:")
            for d in list(duplicates)[:5]:
                print(f"   - {d}")
        else:
            print("\n✅ No duplicate route names found")
    
    # Verify some specific routes
    test_routes = [
        "UP - IKOT",
        "EDSA Carousel",
        "Taft Avenue - North Avenue",
        "Baclaran - Montalban via EDSA",
        "CUBAO-STOPnSHOP",
        "PITX - Makati",
        "LAGRO - QUIAPO VIA SAUYO",
    ]
    
    print("\n🔍 Verifying specific routes:")
    for route_name in test_routes:
        res = supabase.table("ph_route_reference").select("*").eq("route_name", route_name).limit(1).execute()
        if res.data:
            route = res.data[0]
            print(f"   ✅ {route_name}")
            print(f"      mode: {route.get('mode')}")
            print(f"      origin: {route.get('origin')}")
            print(f"      destination: {route.get('destination')}")
        else:
            print(f"   ❌ {route_name} - NOT FOUND")

if __name__ == "__main__":
    verify()
