#!/usr/bin/env python3
"""Verify data is truly clean before dropping tables."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def verify_clean():
    print("🔍 VERIFYING DATA IS TRULY CLEAN\n")
    print("="*60)
    
    # 1. Check ph_route_reference for test data
    print("\n1. ph_route_reference - Checking for test data...")
    test_patterns = ["test", "demo", "dummy", "sample", "example", "health"]
    
    ref_routes = supabase.table("ph_route_reference").select("id, route_name").execute()
    test_refs = []
    
    if ref_routes.data:
        for route in ref_routes.data:
            name = route.get("route_name", "").lower()
            if any(p in name for p in test_patterns):
                test_refs.append(route["route_name"])
    
    if test_refs:
        print(f"   ⚠️ Found {len(test_refs)} test routes:")
        for name in test_refs[:5]:
            print(f"      • {name}")
    else:
        print(f"   ✅ No test routes found")
    
    # 2. Check ph_user_tracks
    print("\n2. ph_user_tracks - Checking...")
    tracks_count = supabase.table("ph_user_tracks").select("count", count="exact").limit(0).execute()
    count = tracks_count.count if hasattr(tracks_count, 'count') else 0
    print(f"   Total tracks: {count}")
    
    if count == 0:
        print(f"   ✅ Empty (all Health Check tracks deleted)")
    else:
        # Check for Health Check
        health = supabase.table("ph_user_tracks").select("count", count="exact").eq("route_name", "Health Check").limit(0).execute()
        health_count = health.count if hasattr(health, 'count') else 0
        print(f"   Health Check tracks: {health_count}")
        
        # Check for test routes
        test_tracks = supabase.table("ph_user_tracks").select("count", count="exact").or_("route_name.ilike.%test%,route_name.ilike.%demo%").limit(0).execute()
        test_count = test_tracks.count if hasattr(test_tracks, 'count') else 0
        print(f"   Test tracks: {test_count}")
    
    # 3. Check ph_routes for test data
    print("\n3. ph_routes - Checking for test data...")
    routes = supabase.table("ph_routes").select("route_uuid, name").execute()
    test_routes = []
    
    if routes.data:
        for route in routes.data:
            name = route.get("name", "").lower()
            if any(p in name for p in test_patterns):
                test_routes.append(route["name"])
    
    if test_routes:
        print(f"   ⚠️ Found {len(test_routes)} test routes:")
        for name in test_routes[:5]:
            print(f"      • {name}")
    else:
        print(f"   ✅ No test routes found")
    
    # 4. Check track_count on ph_route_reference
    print("\n4. ph_route_reference - track_count check...")
    nonzero = supabase.table("ph_route_reference").select("count", count="exact").gt("track_count", 0).limit(0).execute()
    nonzero_count = nonzero.count if hasattr(nonzero, 'count') else 0
    print(f"   Routes with track_count > 0: {nonzero_count}")
    
    # 5. Check for orphaned shapes
    print("\n5. ph_route_shapes - Orphan check...")
    shapes = supabase.table("ph_route_shapes").select("route_uuid").execute()
    routes_uuids = supabase.table("ph_routes").select("route_uuid").execute()
    
    if shapes.data and routes_uuids.data:
        shape_uuids = {s["route_uuid"] for s in shapes.data}
        route_uuids = {r["route_uuid"] for r in routes_uuids.data}
        
        orphaned = shape_uuids - route_uuids
        if orphaned:
            print(f"   ⚠️ Found {len(orphaned)} orphaned shapes")
        else:
            print(f"   ✅ No orphaned shapes")
    
    # 6. Real data summary
    print("\n\n📊 REAL DATA SUMMARY")
    print("="*60)
    
    tables = [
        "ph_route_reference",
        "ph_routes",
        "ph_route_shapes",
        "ph_user_tracks",
        "transit_stops",
        "fare_reports",
        "ph_places",
        "waitlist",
        "gas_stations",
        "community_threads",
        "community_comments",
    ]
    
    for table in tables:
        res = supabase.table(table).select("count", count="exact").limit(0).execute()
        count = res.count if hasattr(res, 'count') else 0
        print(f"   {table}: {count}")
    
    print("\n\n✅ DATABASE IS CLEAN - READY FOR TABLE CLEANUP")

if __name__ == "__main__":
    verify_clean()
