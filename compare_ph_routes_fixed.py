#!/usr/bin/env python3
"""Compare ph_routes with ph_route_reference - FIXED for actual schema."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def compare_tables():
    print("🔍 COMPARING ph_routes vs ph_route_reference\n")
    
    # First check ph_routes schema
    sample = supabase.table("ph_routes").select("*").limit(1).execute()
    if not sample.data:
        print("No data in ph_routes")
        return
    
    columns = list(sample.data[0].keys())
    print(f"ph_routes columns: {columns}\n")
    
    # Determine the correct name column
    name_col = None
    if "name" in columns:
        name_col = "name"
    elif "route_name" in columns:
        name_col = "route_name"
    elif "route_long_name" in columns:
        name_col = "route_long_name"
    
    if not name_col:
        print("Could not find route name column")
        return
    
    print(f"Using name column: {name_col}\n")
    
    # Get all routes from ph_routes
    print("📥 Fetching ph_routes...")
    ph_routes = {}
    page_size = 1000
    start = 0
    
    while True:
        res = supabase.table("ph_routes").select(f"route_uuid, {name_col}, mode, is_approved, status").range(start, start + page_size - 1).execute()
        if not res.data:
            break
        
        for route in res.data:
            name = route.get(name_col, "")
            if name:
                ph_routes[name] = {
                    "route_uuid": route.get("route_uuid"),
                    "mode": route.get("mode"),
                    "is_approved": route.get("is_approved"),
                    "status": route.get("status"),
                }
        
        if len(res.data) < page_size:
            break
        start += page_size
    
    print(f"   ph_routes: {len(ph_routes)} routes")
    
    # Get all routes from ph_route_reference
    print("📥 Fetching ph_route_reference...")
    reference_routes = {}
    start = 0
    
    while True:
        res = supabase.table("ph_route_reference").select("id, route_name, mode").range(start, start + page_size - 1).execute()
        if not res.data:
            break
        
        for route in res.data:
            name = route.get("route_name", "")
            if name:
                reference_routes[name] = {
                    "id": route.get("id"),
                    "mode": route.get("mode"),
                }
        
        if len(res.data) < page_size:
            break
        start += page_size
    
    print(f"   ph_route_reference: {len(reference_routes)} routes")
    
    # Find routes in ph_routes but NOT in ph_route_reference
    missing_from_reference = set(ph_routes.keys()) - set(reference_routes.keys())
    print(f"\n❌ Routes in ph_routes but MISSING from ph_route_reference: {len(missing_from_reference)}")
    
    if missing_from_reference:
        for name in sorted(missing_from_reference)[:30]:
            route_info = ph_routes[name]
            print(f"   • {name} (mode: {route_info['mode']}, status: {route_info.get('status', 'unknown')})")
    
    # Mode comparison for matching routes
    print(f"\n📊 Mode comparison for matching routes:")
    mode_mismatches = []
    
    for name in set(ph_routes.keys()) & set(reference_routes.keys()):
        ph_mode = ph_routes[name]["mode"]
        ref_mode = reference_routes[name]["mode"]
        
        if ph_mode != ref_mode:
            mode_mismatches.append((name, ph_mode, ref_mode))
    
    print(f"   Mode mismatches: {len(mode_mismatches)}")
    
    if mode_mismatches:
        print(f"\n   Mode mismatches (first 20):")
        for name, ph_mode, ref_mode in mode_mismatches[:20]:
            print(f"   • {name}: ph_routes={ph_mode}, reference={ref_mode}")
    
    # Summary
    print(f"\n📋 SUMMARY:")
    print(f"   ph_routes total: {len(ph_routes)}")
    print(f"   ph_route_reference total: {len(reference_routes)}")
    print(f"   Missing from reference: {len(missing_from_reference)}")
    print(f"   Mode mismatches: {len(mode_mismatches)}")

if __name__ == "__main__":
    compare_tables()
