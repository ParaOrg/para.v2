#!/usr/bin/env python3
"""Verify total route count and identify any missing routes."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def check_totals():
    print("📊 Checking route totals...\n")
    
    # Total count
    total_res = supabase.table("ph_route_reference").select("count", count="exact").limit(0).execute()
    total = total_res.count if hasattr(total_res, 'count') else 0
    print(f"Total routes in ph_route_reference: {total}")
    
    # Count by mode
    modes = ['train', 'bus', 'jeepney', 'bgc_bus', 'p2p', 'uv_express']
    mode_counts = {}
    total_by_mode = 0
    
    for mode in modes:
        res = supabase.table("ph_route_reference").select("count", count="exact").eq("mode", mode).limit(0).execute()
        count = res.count if hasattr(res, 'count') else 0
        mode_counts[mode] = count
        total_by_mode += count
        print(f"  {mode}: {count}")
    
    print(f"\n  Sum of all modes: {total_by_mode}")
    print(f"  Actual total: {total}")
    
    if total_by_mode != total:
        print(f"\n⚠️ Discrepancy found! Difference: {total - total_by_mode}")
        print("Some routes may have NULL or empty mode values")
        
        # Check for null/empty modes
        null_modes = supabase.table("ph_route_reference").select("count", count="exact").is_("mode", "null").limit(0).execute()
        null_count = null_modes.count if hasattr(null_modes, 'count') else 0
        print(f"  Routes with NULL mode: {null_count}")
        
        empty_modes = supabase.table("ph_route_reference").select("count", count="exact").eq("mode", "").limit(0).execute()
        empty_count = empty_modes.count if hasattr(empty_modes, 'count') else 0
        print(f"  Routes with empty mode: {empty_count}")
    
    # Check for recent additions
    print("\n🕐 Recent additions (last 24 hours):")
    from datetime import datetime, timedelta
    yesterday = (datetime.utcnow() - timedelta(hours=24)).isoformat()
    
    try:
        recent = supabase.table("ph_route_reference").select("route_name, mode, created_at").gte("created_at", yesterday).order("created_at", desc=True).limit(30).execute()
        if recent.data:
            for route in recent.data:
                print(f"  • {route['route_name']} ({route['mode']})")
        else:
            print("  No recent additions found")
    except Exception as e:
        print(f"  Could not check recent additions: {e}")
    
    # Check if the 26 new routes are there
    print("\n🔍 Checking for the 26 newly added routes:")
    new_routes = [
        "Taft Avenue - North Avenue",
        "Baclaran - Roosevelt",
        "Recto - Santolan",
        "Metro Commuter",
        "EDSA Carousel",
        "Baclaran - Montalban via EDSA",
        "Ayala Quiapo via Kamagong Taft",
        "Baclaran SM Fairview via Lagro",
        "Sta Maria - Baclaran NLEX EDSA",
    ]
    
    found = 0
    for route_name in new_routes:
        res = supabase.table("ph_route_reference").select("id").eq("route_name", route_name).limit(1).execute()
        if res.data:
            found += 1
    
    print(f"  Found {found}/{len(new_routes)} sample new routes")

if __name__ == "__main__":
    check_totals()
